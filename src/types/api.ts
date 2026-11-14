/**
 * Frontend copies of the JSON shapes served by the Logta API (see docs/API.md).
 *
 * Why copies: `src/lib` and `src/db` are Node-only and excluded from the app build, so React code cannot import
 * their types. Dates arrive as ISO strings. These types are presentation contracts: the frontend developer maps
 * API responses onto them and passes them to the components as props. Nothing here fetches anything.
 */

export type StoreType = 'coop' | 'hypermarket' | 'supermarket' | 'online'
export type SizeUnit = 'g' | 'kg' | 'ml' | 'L' | 'pcs'

/** GET /api/stores rows. The online store (Taw9eel) has lat/lng = null. */
export interface ApiStore {
  id: number
  slug: string
  nameEn: string
  nameAr: string
  type: StoreType
  areaEn: string | null
  areaAr: string | null
  lat: number | null
  lng: number | null
  deliveryFeeKwd: number | null
  minOrderKwd: number | null
  coordsApproximate: boolean
}

/** The fields of a product row the UI uses (GET /api/products, /api/watchlist). */
export interface ApiProduct {
  id: number
  nameEn: string
  nameAr: string
  brand: string | null
  sizeValue: number
  sizeUnit: SizeUnit
  packCount: number
}

export interface SourceMix {
  receipt: number
  shelf_tag: number
  manual: number
  seed: number
  seedEstimate: number
  seedWebSnapshot: number
}

/** One current price per product x store (GET /api/products/:id -> prices[], and `bestPrice` in the product list). */
export interface PriceCell {
  productId: number
  storeId: number
  priceKwd: number
  /** 0-1. Labels: < 0.6 Estimate, 0.6 to < 0.8 Recent, >= 0.8 Verified. */
  trust: number
  lastObservedAt: string
  observationCount: number
  isPromo: boolean
  sourceMix: SourceMix
}

/** GET /api/products?q= rows. */
export interface ProductListItem extends ApiProduct {
  bestPrice: PriceCell | null
  storeCount: number
}

// ---------------------------------------------------------------------------
// Basket optimiser: POST /api/optimize -> BasketPlan[]
// ---------------------------------------------------------------------------

export interface PlanLine {
  requestedProductId: number
  productId: number
  nameEn: string
  nameAr: string
  /** Packs bought. */
  qty: number
  unitPriceKwd: number
  lineTotalKwd: number
  trust: number
  isPromo: boolean
  substituted: boolean
}

export interface StorePlan {
  storeId: number
  slug: string
  nameEn: string
  nameAr: string
  type: StoreType
  items: PlanLine[]
  subtotal: number
  deliveryFee: number
}

export interface BasketPlan {
  stores: { id: number; slug: string; nameEn: string; nameAr: string; type: StoreType }[]
  itemsPerStore: StorePlan[]
  subtotal: number
  /** Driving cost (fuel + time) plus delivery fees for online stores. An estimate. */
  travelCost: number
  travelKm: number
  total: number
  /** Positive = cheaper than the best single-store plan. */
  savingsVsBestSingleStore: number
  missingItems: { productId: number; nameEn: string; nameAr: string }[]
  /** English names only in the API. */
  substitutions: { requestedProductId: number; requestedNameEn: string; productId: number; nameEn: string; storeId: number }[]
  avgTrust: number
}

/** UI-side basket row (the frontend keeps this state; the API only sees productId/qty/allowSubstitute). */
export interface BasketItem {
  product: ProductListItem
  qty: number
  allowSubstitute: boolean
}

/** A place the user can shop from. Built by the frontend from geolocation or from stores' areaEn / areaAr. */
export interface LocationOption {
  id: string
  labelEn: string
  labelAr: string
  lat: number
  lng: number
}

// ---------------------------------------------------------------------------
// Price alerts
// ---------------------------------------------------------------------------

export type AlertHint = 'buy_now' | 'lower_seen_recently'

/** GET /api/alerts rows (newest first). `hint` and `stats` are null on alerts created before migration 0003. */
export interface AlertEntry {
  alert: { id: number; seen: boolean; triggeredAt: string; messageEn: string; messageAr: string }
  watch: { id: number; targetPriceKwd: number }
  product: { id: number; nameEn: string; nameAr: string; sizeValue: number; sizeUnit: SizeUnit }
  store: { id: number; nameEn: string; nameAr: string }
  /** The price that triggered the alert. */
  priceKwd: number
  observedAt: string
  hint: AlertHint | null
  stats: { min: number; avg: number; max: number } | null
}

/** GET /api/watchlist rows (active watches). */
export interface WatchEntry {
  watch: { id: number; productId: number; targetPriceKwd: number; createdAt: string; active: boolean }
  product: ApiProduct
}

/** WatchEntry plus the current best price, which the frontend joins in (the watchlist response does not include it). */
export interface WatchCardData extends WatchEntry {
  currentBest?: PriceCell | null
}

// ---------------------------------------------------------------------------
// Receipts: GET /api/receipts, GET /api/receipts/:id
// ---------------------------------------------------------------------------

export type ReceiptStatus = 'processed' | 'partial' | 'failed'
export type LineStatus = 'matched' | 'needs_review' | 'unmatched'
export type MatchMethod = 'alias_exact' | 'alias_fuzzy' | 'llm' | 'none'
export type ObservationStatus = 'accepted' | 'quarantined' | 'rejected'

export interface ReceiptLineView {
  lineId: number
  rawText: string
  qty: number
  unitPriceKwd: number | null
  status: LineStatus
  method: MatchMethod
  confidence: number
  product: { id: number; nameEn: string; nameAr: string } | null
  observation: { id: number; status: ObservationStatus } | null
}

export interface ReceiptSummary {
  lines: number
  /** accepted prices */
  saved: number
  /** quarantined prices */
  held: number
  /** needs_review lines (waiting for the AI) */
  waiting: number
  /** unmatched lines (unknown items) */
  newItems: number
}

export interface ReceiptListItem {
  id: number
  status: ReceiptStatus
  store: { id: number; nameEn: string; nameAr: string } | null
  storeTextRaw: string | null
  purchasedAt: string | null
  uploadedAt: string
  totalKwd: number | null
  summary: ReceiptSummary
}

export interface ReceiptDetail extends ReceiptListItem {
  lines: ReceiptLineView[]
}

/** Items of `autoPromoted[]` in the POST /api/scan report. */
export interface AutoPromotion {
  pendingId: number
  rawText: string
  action: 'created' | 'merged'
  productId: number
  productNameEn: string
  backfilledLines: number
  backfilledObservations: number
}

/** Why a request failed, in UI terms. The frontend maps HTTP status / network errors onto one of these. */
export type ScanErrorKind =
  | 'badFile'
  | 'unreadable'
  | 'tooLarge'
  | 'rateLimitMinute'
  | 'rateLimitHour'
  | 'aiFailed'
  | 'unavailable'
  | 'forbidden'
  | 'network'
  | 'timeout'
  | 'server'

/** Where the basket is planned from: the device's position, or a chosen area. */
export type SelectedLocation =
  | { kind: 'gps'; lat: number; lng: number }
  | { kind: 'area'; option: LocationOption }

/** A price alert from the POST /api/scan report, already filtered by the frontend to this device (`userId`). */
export interface ScanReportAlert {
  messageEn: string
  messageAr: string
  hint: AlertHint | null
}
