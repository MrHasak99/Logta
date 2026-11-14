import { MOCK_RECEIPTS, type MockReceipt } from '../data/mockReceipts'
import type {
  DocumentType,
  ExtractedItem,
  ExtractionProvider,
  ExtractionResult,
  Product,
  Store,
} from '../data/types'
import { roundKwd, todayIso } from '../utils/formatters'
import { matchStore, matchToProduct } from './productMatcher'

export type ExtractionInput =
  | { kind: 'image'; dataUrl: string }
  | { kind: 'sample'; receipt: MockReceipt }

const env = import.meta.env as Record<string, string | undefined>
const OPENROUTER_KEY = env.VITE_OPENROUTER_API_KEY?.trim()
const OPENAI_KEY = env.VITE_OPENAI_API_KEY?.trim()
const GEMINI_KEY = env.VITE_GEMINI_API_KEY?.trim()

export const configuredProvider = (): ExtractionProvider =>
  OPENROUTER_KEY ? 'openrouter' : OPENAI_KEY ? 'openai' : GEMINI_KEY ? 'gemini' : 'simulated'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

let uidCounter = 0
const uid = () => `item-${Date.now().toString(36)}-${uidCounter++}`

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const buildPrompt = (products: Product[], stores: Store[]): string => `You are an OCR + data extraction engine for Kuwait grocery receipts and shelf price tags (English and Arabic).
Read the attached image and return ONE JSON object, no markdown, with this exact shape:
{
  "store_name": string,            // MUST be exactly one of the store ids below, or "unknown"
  "receipt_date": string,          // YYYY-MM-DD, or "" if not visible
  "document_type": "receipt" | "shelf_tag",
  "items": [
    {
      "raw_text": string,                 // line text exactly as printed
      "matched_product_id": string|null,  // product id from the catalogue below, or null if no confident match
      "canonical_name_en": string,        // catalogue English name, or "" if null
      "canonical_name_ar": string,        // catalogue Arabic name, or "" if null
      "price_kwd": number,                // price in Kuwaiti Dinar, 3 decimals (e.g. 0.550). Never fils-as-integers.
      "confidence_score": number          // 0-100
    }
  ]
}
Rules:
- Only include purchasable product lines. Skip totals, VAT, change, cash, card, and discount summary lines.
- Use the unit price (price for one pack) when a quantity is shown.
- Lower confidence_score for blurry, partial or ambiguous lines.

STORES (use the id):
${stores.map((s) => `- ${s.id}: ${s.nameEn} / ${s.nameAr} (${s.area})`).join('\n')}

PRODUCT CATALOGUE (id | English | Arabic):
${products.map((p) => `- ${p.id} | ${p.nameEn} | ${p.nameAr}`).join('\n')}`

// ---------------------------------------------------------------------------
// Provider calls
// ---------------------------------------------------------------------------

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
        // Catalogue + schema live in the system prompt so the model returns matched_product_id directly.
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
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error(`${model} returned an empty response`)
  return content
}

const callOpenRouter = async (prompt: string, imageUrl: string): Promise<string> => {
  const headers = {
    Authorization: `Bearer ${OPENROUTER_KEY}`,
    'HTTP-Referer': window.location.origin,
    'X-Title': 'Logta',
  }
  const url = 'https://openrouter.ai/api/v1/chat/completions'
  try {
    return await chatCompletion(url, headers, 'openai/gpt-4o-mini', prompt, imageUrl)
  } catch {
    return await chatCompletion(url, headers, 'google/gemini-2.5-flash', prompt, imageUrl)
  }
}

const callOpenAI = (prompt: string, imageUrl: string): Promise<string> =>
  chatCompletion(
    'https://api.openai.com/v1/chat/completions',
    { Authorization: `Bearer ${OPENAI_KEY}` },
    'gpt-4o-mini',
    prompt,
    imageUrl,
  )

const callGemini = async (prompt: string, imageUrl: string): Promise<string> => {
  const match = /^data:(.+?);base64,(.*)$/.exec(imageUrl)
  if (!match) throw new Error('Unsupported image encoding')
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY ?? '' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    },
  )
  if (!res.ok) throw new Error(`gemini-2.5-flash request failed (${res.status})`)
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
  if (!text) throw new Error('gemini-2.5-flash returned an empty response')
  return text
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const parseJson = (text: string): unknown => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('Model did not return valid JSON')
  }
}

const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^\d.,-]/g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

const toExtractedItem = (raw: Record<string, unknown>, products: Product[]): ExtractedItem | null => {
  const rawText = String(raw.raw_text ?? '').trim()
  const price = roundKwd(toNumber(raw.price_kwd))
  if (!rawText && !price) return null

  let conf = toNumber(raw.confidence_score)
  if (conf > 0 && conf <= 1) conf *= 100

  let product = products.find((p) => p.id === raw.matched_product_id)
  if (!product) {
    const local = matchToProduct(rawText, products)
    product = products.find((p) => p.id === local.productId)
    if (product) conf = Math.min(conf || 100, local.confidence)
    else conf = Math.min(conf || 40, 45)
  }

  return {
    uid: uid(),
    rawText: rawText || product?.nameEn || 'Unknown item',
    matchedProductId: product?.id ?? null,
    canonicalNameEn: product?.nameEn ?? '',
    canonicalNameAr: product?.nameAr ?? '',
    priceKwd: price,
    confidenceScore: Math.max(0, Math.min(100, Math.round(conf))),
  }
}

const validDate = (d: unknown): string => {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d))) {
    return d > todayIso() ? todayIso() : d
  }
  return todayIso()
}

const parseModelResult = (
  text: string,
  provider: ExtractionProvider,
  products: Product[],
  stores: Store[],
): ExtractionResult => {
  const data = parseJson(text) as Record<string, unknown>
  const storeRaw = String(data.store_name ?? '')
  const storeId = stores.find((s) => s.id === storeRaw)?.id ?? matchStore(storeRaw, stores)
  const items = (Array.isArray(data.items) ? data.items : [])
    .map((i) => toExtractedItem(i as Record<string, unknown>, products))
    .filter((i): i is ExtractedItem => i !== null)
  const documentType: DocumentType = data.document_type === 'shelf_tag' ? 'shelf_tag' : 'receipt'
  return {
    storeId,
    storeNameRaw: storeRaw,
    receiptDate: validDate(data.receipt_date),
    documentType,
    items,
    provider,
  }
}

// ---------------------------------------------------------------------------
// Simulated parser (no API key / failure fallback)
// ---------------------------------------------------------------------------

const simulate = (
  input: ExtractionInput,
  products: Product[],
  stores: Store[],
  notice?: string,
): ExtractionResult => {
  const receipt =
    input.kind === 'sample'
      ? input.receipt
      : MOCK_RECEIPTS[input.dataUrl.length % MOCK_RECEIPTS.length]
  const items = receipt.lines
    .map((line) => {
      const match = matchToProduct(line.raw, products)
      const product = products.find((p) => p.id === match.productId)
      return {
        uid: uid(),
        rawText: line.raw,
        matchedProductId: product?.id ?? null,
        canonicalNameEn: product?.nameEn ?? '',
        canonicalNameAr: product?.nameAr ?? '',
        priceKwd: roundKwd(line.price),
        confidenceScore: product ? match.confidence : 30,
      } satisfies ExtractedItem
    })
  const store = stores.find((s) => s.id === receipt.storeId)
  return {
    storeId: store?.id ?? null,
    storeNameRaw: receipt.storeHeader,
    receiptDate: todayIso(),
    documentType: receipt.documentType,
    items,
    provider: 'simulated',
    notice,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const extractReceipt = async (
  input: ExtractionInput,
  products: Product[],
  stores: Store[],
): Promise<ExtractionResult> => {
  // Built-in samples have no real image, so they always use the simulated parser.
  if (input.kind === 'sample') {
    await wait(1500)
    return simulate(input, products, stores)
  }

  const attempts: { provider: ExtractionProvider; run: (p: string, img: string) => Promise<string> }[] = []
  if (OPENROUTER_KEY) attempts.push({ provider: 'openrouter', run: callOpenRouter })
  if (OPENAI_KEY) attempts.push({ provider: 'openai', run: callOpenAI })
  if (GEMINI_KEY) attempts.push({ provider: 'gemini', run: callGemini })

  if (attempts.length === 0) {
    await wait(1500)
    return simulate(input, products, stores, 'No API key configured - showing simulated extraction.')
  }

  const prompt = buildPrompt(products, stores)
  let lastError = ''
  for (const attempt of attempts) {
    try {
      const text = await attempt.run(prompt, input.dataUrl)
      return parseModelResult(text, attempt.provider, products, stores)
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  await wait(500)
  return simulate(input, products, stores, `AI extraction failed (${lastError}) - showing simulated extraction.`)
}
