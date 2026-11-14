// Server-side proxy for the receipt-scanner AI providers.
// API keys are read from server-only env vars (no VITE_ prefix), so they are never shipped to the browser.

type Provider = 'openrouter' | 'openai' | 'gemini'

const MAX_BODY_BYTES = 8 * 1024 * 1024
const MAX_PROMPT_CHARS = 60_000

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

const key = (name: string): string | undefined => process.env[name]?.trim() || undefined

const chatCompletion = async (
  url: string,
  headers: Record<string, string>,
  model: string,
  prompt: string,
  imageUrl: string,
): Promise<string> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
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

const callOpenRouter = async (apiKey: string, origin: string, prompt: string, imageUrl: string) => {
  const headers = { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': origin, 'X-Title': 'Logta' }
  const url = 'https://openrouter.ai/api/v1/chat/completions'
  try {
    return await chatCompletion(url, headers, 'openai/gpt-4o-mini', prompt, imageUrl)
  } catch {
    return await chatCompletion(url, headers, 'google/gemini-2.5-flash', prompt, imageUrl)
  }
}

const callOpenAI = (apiKey: string, prompt: string, imageUrl: string) =>
  chatCompletion(
    'https://api.openai.com/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    'gpt-4o-mini',
    prompt,
    imageUrl,
  )

const callGemini = async (apiKey: string, prompt: string, imageUrl: string): Promise<string> => {
  const match = /^data:(.+?);base64,(.*)$/.exec(imageUrl)
  if (!match) throw new Error('Unsupported image encoding')
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    },
  )
  if (!res.ok) throw new Error(`gemini-2.5-flash request failed (${res.status})`)
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
  if (!text) throw new Error('gemini-2.5-flash returned an empty response')
  return text
}

const sameOrigin = (request: Request): boolean => {
  const origin = request.headers.get('origin')
  if (!origin) return true // non-browser callers; browsers always send Origin on POST
  try {
    return new URL(origin).host === request.headers.get('host')
  } catch {
    return false
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403)

  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > MAX_BODY_BYTES) return json({ error: 'Image too large' }, 413)

  let body: { prompt?: unknown; imageUrl?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const { prompt, imageUrl } = body
  if (
    typeof prompt !== 'string' ||
    typeof imageUrl !== 'string' ||
    prompt.length > MAX_PROMPT_CHARS ||
    !imageUrl.startsWith('data:image/')
  ) {
    return json({ error: 'Invalid request' }, 400)
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin
  const attempts: { provider: Provider; run: () => Promise<string> }[] = []
  const openrouter = key('OPENROUTER_API_KEY')
  const openai = key('OPENAI_API_KEY')
  const gemini = key('GEMINI_API_KEY')
  if (openrouter) attempts.push({ provider: 'openrouter', run: () => callOpenRouter(openrouter, origin, prompt, imageUrl) })
  if (openai) attempts.push({ provider: 'openai', run: () => callOpenAI(openai, prompt, imageUrl) })
  if (gemini) attempts.push({ provider: 'gemini', run: () => callGemini(gemini, prompt, imageUrl) })

  if (attempts.length === 0) return json({ error: 'No API key configured' }, 503)

  let lastError = ''
  for (const attempt of attempts) {
    try {
      return json({ provider: attempt.provider, text: await attempt.run() })
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  return json({ error: lastError || 'All providers failed' }, 502)
}
