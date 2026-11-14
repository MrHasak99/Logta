// Server-side proxy for the receipt-scanner AI providers (Vercel serverless function; also served by
// the dev middleware in vite.config.ts).
//
// Security model:
// - API keys come from server-only env vars (no VITE_ prefix) and never reach the browser.
// - The browser sends ONLY an image. The prompt is built here from the fixed seed catalogue, so the
//   endpoint can't be used as a general-purpose AI relay: whatever the caller sends, the model is
//   only ever asked to extract a receipt, and only a parsed JSON object is returned.
// - Requests must come from this site (Origin / Referer / Sec-Fetch-Site), and the body size is
//   enforced while reading (not just from Content-Length).
// - Only JPEG / PNG / WEBP data URLs whose bytes match the declared type are accepted.
// - Per-IP rate limit, output-token cap and provider timeout bound the cost of any abuse.
//   (The in-memory limiter is per warm instance; add a Vercel Firewall rate-limit rule on
//   /api/extract for a global limit.)
import { buildExtractionPrompt } from '../src/services/extractionPrompt.js'

type Provider = 'openrouter' | 'openai' | 'gemini'

export const MAX_BODY_BYTES = 8 * 1024 * 1024 // base64 JSON body
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024 // decoded image
const MAX_OUTPUT_TOKENS = 4000
const PROVIDER_TIMEOUT_MS = 45_000
export const RATE_LIMIT = { perMinute: 6, perHour: 40 }

const PROMPT = buildExtractionPrompt()

const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  })

const key = (name: string): string | undefined => process.env[name]?.trim() || undefined

// ---------------------------------------------------------------------------
// Request checks
// ---------------------------------------------------------------------------

/** True only for requests made by this site's own pages. Requests with no Origin/Referer are rejected. */
export const sameOrigin = (request: Request): boolean => {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!host) return false
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') return false
  const source = request.headers.get('origin') ?? request.headers.get('referer')
  if (!source) return false
  try {
    return new URL(source).host === host
  } catch {
    return false
  }
}

const hits = new Map<string, number[]>()
/** Sliding-window limiter. Returns seconds to wait, or 0 when allowed. */
export const rateLimit = (ip: string, now = Date.now()): number => {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000)
  const lastMinute = recent.filter((t) => now - t < 60_000)
  if (lastMinute.length >= RATE_LIMIT.perMinute) return Math.ceil((60_000 - (now - lastMinute[0]!)) / 1000)
  if (recent.length >= RATE_LIMIT.perHour) return Math.ceil((3_600_000 - (now - recent[0]!)) / 1000)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 10_000) hits.clear() // bound memory on a long-lived instance
  return 0
}
export const resetRateLimit = () => hits.clear()

const clientIp = (request: Request): string =>
  request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

/** Read the body with a hard byte cap (Content-Length can be absent or wrong). */
const readBody = async (request: Request): Promise<string | null> => {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

const MAGIC: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
}

/** Validates a data URL; returns its normalised form or an error message. */
export const checkImage = (imageUrl: unknown): { ok: true; url: string; mime: string; base64: string } | { ok: false; error: string } => {
  if (typeof imageUrl !== 'string') return { ok: false, error: 'imageUrl must be a string' }
  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(imageUrl)
  if (!m) return { ok: false, error: 'Only JPEG, PNG or WEBP images are accepted' }
  const mime = m[1] === 'image/jpg' ? 'image/jpeg' : m[1]!
  const base64 = m[2]!
  if ((base64.length * 3) / 4 > MAX_IMAGE_BYTES) return { ok: false, error: 'Image too large' }
  const head = Buffer.from(base64.slice(0, 24), 'base64')
  if (!MAGIC[mime]!(head)) return { ok: false, error: 'Image content does not match its type' }
  return { ok: true, url: `data:${mime};base64,${base64}`, mime, base64 }
}

/** The model must return a JSON object with an items array; anything else is discarded. */
export const parseModelJson = (text: string): Record<string, unknown> | null => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as unknown
    } catch {
      return null
    }
  }
  let data = tryParse(cleaned)
  if (data === null) {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) data = tryParse(cleaned.slice(start, end + 1))
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const obj = data as Record<string, unknown>
  return Array.isArray(obj.items) ? obj : null
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

const chatCompletion = async (
  url: string,
  headers: Record<string, string>,
  model: string,
  imageUrl: string,
): Promise<string> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the items from this Kuwait receipt / shelf tag image. Return JSON only.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`${model} request failed (${res.status})`)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error(`${model} returned an empty response`)
  return content
}

const callOpenRouter = async (apiKey: string, origin: string, imageUrl: string) => {
  const headers = { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': origin, 'X-Title': 'Logta' }
  const url = 'https://openrouter.ai/api/v1/chat/completions'
  try {
    return await chatCompletion(url, headers, 'openai/gpt-4o-mini', imageUrl)
  } catch {
    return await chatCompletion(url, headers, 'google/gemini-2.5-flash', imageUrl)
  }
}

const callOpenAI = (apiKey: string, imageUrl: string) =>
  chatCompletion('https://api.openai.com/v1/chat/completions', { Authorization: `Bearer ${apiKey}` }, 'gpt-4o-mini', imageUrl)

const callGemini = async (apiKey: string, mime: string, base64: string): Promise<string> => {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PROMPT }] },
      contents: [{ parts: [{ text: 'Extract the items from this Kuwait receipt / shelf tag image. Return JSON only.' }, { inline_data: { mime_type: mime, data: base64 } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: MAX_OUTPUT_TOKENS },
    }),
  })
  if (!res.ok) throw new Error(`gemini-2.5-flash request failed (${res.status})`)
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
  if (!text) throw new Error('gemini-2.5-flash returned an empty response')
  return text
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403)

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return json({ error: 'Image too large' }, 413)

  const openrouter = key('OPENROUTER_API_KEY')
  const openai = key('OPENAI_API_KEY')
  const gemini = key('GEMINI_API_KEY')
  if (!openrouter && !openai && !gemini) return json({ error: 'No API key configured' }, 503)

  const wait = rateLimit(clientIp(request))
  if (wait > 0) return json({ error: 'Too many scans, please wait a moment' }, 429, { 'Retry-After': String(wait) })

  const raw = await readBody(request)
  if (raw === null) return json({ error: 'Image too large' }, 413)
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const image = checkImage((body as { imageUrl?: unknown } | null)?.imageUrl)
  if (!image.ok) return json({ error: image.error }, 400)

  const origin = request.headers.get('origin') ?? new URL(request.url).origin
  const attempts: { provider: Provider; run: () => Promise<string> }[] = []
  if (openrouter) attempts.push({ provider: 'openrouter', run: () => callOpenRouter(openrouter, origin, image.url) })
  if (openai) attempts.push({ provider: 'openai', run: () => callOpenAI(openai, image.url) })
  if (gemini) attempts.push({ provider: 'gemini', run: () => callGemini(gemini, image.mime, image.base64) })

  let lastError = ''
  for (const attempt of attempts) {
    try {
      const data = parseModelJson(await attempt.run())
      if (!data) throw new Error(`${attempt.provider} returned an unexpected format`)
      return json({ provider: attempt.provider, text: JSON.stringify(data) })
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  return json({ error: lastError || 'All providers failed' }, 502)
}
