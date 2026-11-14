import { MOCK_RECEIPTS, type MockReceipt } from '../data/mockReceipts'
import type {
  Category,
  DocumentType,
  ExtractedItem,
  ExtractionProvider,
  ExtractionResult,
  NewProductDraft,
  Product,
  Store,
} from '../data/types'
import { roundKwd, todayIso } from '../utils/formatters'
import { matchStore, matchToProduct } from './productMatcher'

export type ExtractionInput =
  | { kind: 'image'; dataUrl: string }
  | { kind: 'sample'; receipt: MockReceipt }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

let uidCounter = 0
const uid = () => `item-${Date.now().toString(36)}-${uidCounter++}`

// ---------------------------------------------------------------------------
// Provider calls
// ---------------------------------------------------------------------------

class NoProviderError extends Error {}

// The API keys live on the server (api/extract.ts); the browser only ever talks to this endpoint.
// Only the image is sent; the server builds the prompt from the fixed catalogue.
const callProxy = async (imageUrl: string): Promise<{ provider: ExtractionProvider; text: string }> => {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  })
  // 503 = no key configured on the server, 404 = no API available (e.g. plain static hosting)
  if (res.status === 503 || res.status === 404) throw new NoProviderError('No API key configured')
  const data = (await res.json().catch(() => null)) as
    | { provider?: ExtractionProvider; text?: string; error?: string }
    | null
  if (res.status === 429) throw new Error(data?.error ?? 'Too many scans, please wait a moment')
  if (!res.ok || !data?.text || !data.provider) {
    throw new Error(data?.error ?? `extraction request failed (${res.status})`)
  }
  return { provider: data.provider, text: data.text }
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

/**
 * When the model found no catalogue match, only accept a local match that is near-exact (known alias or
 * identical name). Looser fuzzy matches (shared generic words like "spread 350g") would attach the price
 * to the wrong product, and the user can no longer correct a match, only confirm or reject it.
 */
const MIN_LOCAL_MATCH = 80

const CATEGORIES: Category[] = ['Dairy', 'Pantry', 'Beverages', 'Household']
const ARABIC = /[\u0600-\u06FF]/

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Builds the details of a product that is missing from the database, from the model output / printed text. */
const draftProduct = (raw: Record<string, unknown>, rawText: string): NewProductDraft => {
  const en = str(raw.canonical_name_en)
  const ar = str(raw.canonical_name_ar)
  // Prefer the model's clean names; fall back to whatever was printed.
  const nameEn = en || (ARABIC.test(rawText) ? '' : rawText) || ar || rawText
  const nameAr = ar || (ARABIC.test(rawText) ? rawText : '')
  const category = CATEGORIES.find((c) => c === raw.category) ?? 'Pantry'
  return { nameEn, nameAr, category, unitSize: str(raw.unit_size) }
}

const toExtractedItem = (raw: Record<string, unknown>, products: Product[]): ExtractedItem | null => {
  const rawText = String(raw.raw_text ?? '').trim()
  const price = roundKwd(toNumber(raw.price_kwd))
  if (!rawText && !price) return null

  let conf = toNumber(raw.confidence_score)
  if (conf > 0 && conf <= 1) conf *= 100

  let product = products.find((p) => p.id === raw.matched_product_id)
  if (!product) {
    // Try the printed text, then the model's clean name, against the whole database
    // (including products added by earlier scans) before treating it as new.
    const candidates = [rawText, str(raw.canonical_name_en), str(raw.canonical_name_ar)].filter(Boolean)
    let best = { productId: null as string | null, confidence: 0 }
    for (const text of candidates) {
      const m = matchToProduct(text, products)
      if (m.productId && m.confidence >= MIN_LOCAL_MATCH && m.confidence > best.confidence) best = m
    }
    product = products.find((p) => p.id === best.productId)
    if (product) conf = Math.min(conf || 100, best.confidence)
  }

  const newProduct = product ? undefined : draftProduct(raw, rawText)
  if (!product && !newProduct?.nameEn && !newProduct?.nameAr) return null

  return {
    uid: uid(),
    rawText: rawText || product?.nameEn || 'Unknown item',
    matchedProductId: product?.id ?? null,
    canonicalNameEn: product?.nameEn ?? newProduct?.nameEn ?? '',
    canonicalNameAr: product?.nameAr ?? newProduct?.nameAr ?? '',
    priceKwd: price,
    confidenceScore: Math.max(0, Math.min(100, Math.round(conf || 60))),
    newProduct,
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
  const currency = String(data.currency ?? 'KWD').trim().toUpperCase()
  const foreign = currency && !['KWD', 'KD', 'KUWAITI DINAR'].includes(currency)
  return {
    storeId,
    storeNameRaw: storeRaw,
    receiptDate: validDate(data.receipt_date),
    documentType,
    items,
    provider,
    notice: foreign
      ? `This document is priced in ${currency}, not KWD. Prices are shown as printed and NOT converted - check them before confirming.`
      : undefined,
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
      const newProduct = product ? undefined : draftProduct({}, line.raw)
      return {
        uid: uid(),
        rawText: line.raw,
        matchedProductId: product?.id ?? null,
        canonicalNameEn: product?.nameEn ?? newProduct?.nameEn ?? '',
        canonicalNameAr: product?.nameAr ?? newProduct?.nameAr ?? '',
        priceKwd: roundKwd(line.price),
        confidenceScore: product ? match.confidence : 60,
        newProduct,
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

  let lastError = ''
  try {
    const { provider, text } = await callProxy(input.dataUrl)
    return parseModelResult(text, provider, products, stores)
  } catch (e) {
    if (e instanceof NoProviderError) {
      await wait(1500)
      return simulate(input, products, stores, 'No API key configured - showing simulated extraction.')
    }
    lastError = e instanceof Error ? e.message : String(e)
  }
  await wait(500)
  return simulate(input, products, stores, `AI extraction failed (${lastError}) - showing simulated extraction.`)
}
