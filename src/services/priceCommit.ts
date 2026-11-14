import type {
  AppData,
  DocumentType,
  ExtractedItem,
  PriceDelta,
  PriceEntry,
  PriceSource,
  Product,
  ScanRecord,
  ScanSummary,
} from '../data/types'
import { roundKwd } from '../utils/formatters'
import { normalize } from './productMatcher'

export const TRUST_WEIGHT: Record<DocumentType, number> = {
  receipt: 95,
  shelf_tag: 80,
}

/** Latest price entry for a product at a store (by timestamp). */
export const latestEntry = (
  entries: PriceEntry[],
  productId: string,
  storeId: string,
): PriceEntry | undefined => {
  let best: PriceEntry | undefined
  for (const e of entries) {
    if (e.productId !== productId || e.storeId !== storeId) continue
    if (!best || e.timestamp > best.timestamp) best = e
  }
  return best
}

let idCounter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${idCounter++}`

export interface CommitInput {
  storeId: string
  documentType: DocumentType
  receiptDate: string
  items: ExtractedItem[]
}

/** Pure function: applies verified items to the data set and returns the new data + summary. */
export const applyScan = (data: AppData, input: CommitInput): { data: AppData; summary: ScanSummary } => {
  const now = new Date().toISOString()
  const trust = TRUST_WEIGHT[input.documentType]
  const source: PriceSource = input.documentType === 'receipt' ? 'Receipt Scan' : 'Shelf Tag'

  // Resolve every item to a product. Items with no database match create a new product
  // (or reuse one with the same name, e.g. when the same new item appears twice in a scan).
  const products: Product[] = [...data.products]
  const newProductIds: string[] = []
  const resolveProductId = (item: ExtractedItem): string | null => {
    if (item.matchedProductId) return item.matchedProductId
    const draft = item.newProduct
    if (!draft) return null
    const names = [draft.nameEn, draft.nameAr, item.rawText].map(normalize).filter(Boolean)
    const existing = products.find((p) =>
      [p.nameEn, p.nameAr, ...p.aliases].some((text) => names.includes(normalize(text))),
    )
    if (existing) return existing.id
    const product: Product = {
      id: newId('prod'),
      nameEn: draft.nameEn || draft.nameAr,
      nameAr: draft.nameAr || draft.nameEn,
      category: draft.category,
      unitSize: draft.unitSize,
      // The printed text lets future scans of the same receipt line match this product directly.
      aliases: item.rawText && item.rawText !== draft.nameEn ? [item.rawText] : [],
    }
    products.push(product)
    newProductIds.push(product.id)
    return product.id
  }

  // De-duplicate by product: last occurrence wins.
  const byProduct = new Map<string, ExtractedItem>()
  for (const item of input.items) {
    if (item.priceKwd <= 0) continue
    const productId = resolveProductId(item)
    if (productId) byProduct.set(productId, item)
  }

  const newEntries: PriceEntry[] = []
  const deltas: PriceDelta[] = []
  let added = 0
  let updated = 0

  for (const [productId, item] of byProduct) {
    const prev = latestEntry(data.priceEntries, productId, input.storeId)
    const newPrice = roundKwd(item.priceKwd)
    const previousPrice = prev ? prev.priceKwd : null
    if (prev) updated++
    else added++
    deltas.push({
      productId,
      storeId: input.storeId,
      newPrice,
      previousPrice,
      delta: previousPrice === null ? null : roundKwd(newPrice - previousPrice),
    })
    newEntries.push({
      id: newId('price'),
      productId,
      storeId: input.storeId,
      priceKwd: newPrice,
      timestamp: now,
      source,
      confidence: Math.round((item.confidenceScore * trust) / 100),
      inStock: true, // a price seen on a receipt/shelf means the item was available
    })
  }

  const record: ScanRecord = {
    id: newId('scan'),
    storeId: input.storeId,
    documentType: input.documentType,
    receiptDate: input.receiptDate,
    scannedAt: now,
    itemCount: byProduct.size,
  }

  return {
    data: {
      ...data,
      products,
      priceEntries: [...data.priceEntries, ...newEntries],
      scanRecords: [record, ...data.scanRecords],
    },
    summary: { storeId: input.storeId, documentType: input.documentType, added, updated, deltas, newProductIds },
  }
}
