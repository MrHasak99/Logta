export type Category = 'Dairy' | 'Pantry' | 'Beverages' | 'Household'

/** 'Demo Estimate' = invented seed price shown in the feed for the demo; never a real scan. */
export type PriceSource = 'Receipt Scan' | 'Shelf Tag' | 'Initial Index' | 'Demo Estimate'

export type DocumentType = 'receipt' | 'shelf_tag'

export interface Store {
  id: string
  nameEn: string
  nameAr: string
  area: string
  lat: number
  lng: number
  isOnline: boolean
  /** Extra spellings used when matching AI-detected store names */
  aliases: string[]
}

export interface Product {
  id: string
  nameEn: string
  nameAr: string
  category: Category
  unitSize: string
  /** Common receipt abbreviations / alternative spellings */
  aliases: string[]
}

export interface PriceEntry {
  id: string
  productId: string
  storeId: string
  /** Price in Kuwaiti Dinar. Always displayed with 3 decimals. */
  priceKwd: number
  /** ISO timestamp */
  timestamp: string
  source: PriceSource
  /** 0-100 */
  confidence: number
  /** Stock status at this store (used by Basket Optimizer / Price Alerts) */
  inStock: boolean
}

export interface ExtractedItem {
  /** Local id for React keys / editing; not persisted as a product id */
  uid: string
  rawText: string
  matchedProductId: string | null
  canonicalNameEn: string
  canonicalNameAr: string
  priceKwd: number
  /** 0-100 */
  confidenceScore: number
  /** True once the user changed the product or price */
  userEdited?: boolean
}

export type ExtractionProvider = 'openrouter' | 'openai' | 'gemini' | 'simulated'

export interface ExtractionResult {
  storeId: string | null
  storeNameRaw: string
  receiptDate: string
  documentType: DocumentType
  items: ExtractedItem[]
  provider: ExtractionProvider
  /** Optional human readable note (e.g. fallback reason) */
  notice?: string
}

export interface ScanRecord {
  id: string
  storeId: string
  documentType: DocumentType
  receiptDate: string
  scannedAt: string
  itemCount: number
}

export interface PriceDelta {
  productId: string
  storeId: string
  newPrice: number
  previousPrice: number | null
  /** newPrice - previousPrice, null when there was no previous price */
  delta: number | null
}

export interface ScanSummary {
  storeId: string
  documentType: DocumentType
  added: number
  updated: number
  deltas: PriceDelta[]
}

export interface AppData {
  version: number
  products: Product[]
  priceEntries: PriceEntry[]
  scanRecords: ScanRecord[]
}
