/**
 * Browser client for the Logta API server (docs/API.md).
 *
 * Automatic mode is ON only when VITE_API_BASE is set (e.g. https://logta.replit.app). Without it the app keeps the
 * original manual/local flow, so a deployment without a reachable server never breaks.
 */
import type {
  AlertEntry,
  ApiStore,
  AutoPromotion,
  BasketPlan,
  ProductListItem,
  PriceCell,
  ReceiptDetail,
  ReceiptListItem,
  ScanErrorKind,
  WatchEntry,
} from '../types/api'

const RAW_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.trim() ?? ''
export const API_BASE = RAW_BASE.replace(/\/+$/, '')
export const isApiMode = API_BASE.length > 0

// ---------------------------------------------------------------------------- device id (no accounts)

const DEVICE_KEY = 'logta:deviceId'
let cachedDeviceId: string | null = null

/** Stable anonymous id per browser, so the server can count distinct shoppers and keep "my" lists/alerts. */
export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing) return (cachedDeviceId = existing)
  } catch {
    // storage blocked: fall through to an in-memory id for this session
  }
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  try {
    localStorage.setItem(DEVICE_KEY, id)
  } catch {
    // ignore
  }
  return (cachedDeviceId = id)
}

// ---------------------------------------------------------------------------- errors

export class ApiError extends Error {
  status: number
  retryAfter?: number
  constructor(status: number, message: string, retryAfter?: number) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

/** Map an ApiError / network failure onto the UI's error vocabulary (ScanError component). */
export function scanErrorKind(e: unknown): ScanErrorKind {
  if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError')) return 'timeout'
  if (!(e instanceof ApiError)) return 'network'
  switch (e.status) {
    case 400:
      return /JPEG|PNG|WEBP|image/i.test(e.message) ? 'badFile' : 'unreadable'
    case 403:
      return 'forbidden'
    case 413:
      return 'tooLarge'
    case 429:
      return /hour/i.test(e.message) ? 'rateLimitHour' : 'rateLimitMinute'
    case 502:
      return 'aiFailed'
    case 503:
      return 'unavailable'
    case 0:
      return 'network'
    default:
      return 'server'
  }
}

async function request<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 20_000, ...rest } = init
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: { ...(rest.body ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) },
      signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    if (e instanceof DOMException) throw e
    throw new ApiError(0, e instanceof Error ? e.message : 'Network error')
  }
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`
    const ra = Number(res.headers.get('retry-after'))
    throw new ApiError(res.status, msg, Number.isFinite(ra) && ra > 0 ? ra : undefined)
  }
  return body as T
}

const q = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')

// ---------------------------------------------------------------------------- scan report (POST /api/scan, /api/ingest)

export interface ScanReport {
  userId: number
  receiptId: number
  storeId: number | null
  storeNameEn: string | null
  status: 'processed' | 'partial' | 'failed'
  learnedAliases: number
  quarantined: number
  autoPromoted: AutoPromotion[]
  alerts: { userId: number; hint: 'buy_now' | 'lower_seen_recently'; alert: { id: number; messageEn: string; messageAr: string } }[]
  llmCalls: number
  llmSkipped: number
}

/** Extraction JSON as accepted by POST /api/ingest (same shape the LLM returns). */
export interface ExtractionInput {
  store_text: string | null
  purchased_at: string | null
  total_kwd: number | null
  lines: { raw_text: string; qty: number; unit_price_kwd: number | null; line_total_kwd: number | null }[]
}

export const api = {
  health: () => request<{ ok: boolean; llm: string | null }>('/api/health', { timeoutMs: 8_000 }),
  stores: () => request<ApiStore[]>('/api/stores'),

  scanImage: (imageUrl: string, storeId?: number | null) =>
    request<ScanReport>('/api/scan', { method: 'POST', body: JSON.stringify({ deviceId: getDeviceId(), imageUrl, storeId: storeId ?? undefined }), timeoutMs: 120_000 }),
  ingest: (extraction: ExtractionInput, storeId?: number | null) =>
    request<ScanReport>('/api/ingest', { method: 'POST', body: JSON.stringify({ deviceId: getDeviceId(), extraction, storeId: storeId ?? undefined }), timeoutMs: 120_000 }),
  receipts: (limit = 20) => request<ReceiptListItem[]>(`/api/receipts?${q({ deviceId: getDeviceId(), limit })}`),
  receipt: (id: number) => request<ReceiptDetail>(`/api/receipts/${id}?${q({ deviceId: getDeviceId() })}`),

  searchProducts: (query: string, limit = 20, signal?: AbortSignal) => request<ProductListItem[]>(`/api/products?${q({ q: query, limit })}`, { signal }),
  product: (id: number) => request<{ prices: PriceCell[] }>(`/api/products/${id}`),
  optimize: (items: { productId: number; qty: number; allowSubstitute: boolean }[], location: { lat: number; lng: number }) =>
    request<BasketPlan[]>('/api/optimize', { method: 'POST', body: JSON.stringify({ items, location }), timeoutMs: 30_000 }),

  alerts: (unseenOnly = false) => request<AlertEntry[]>(`/api/alerts?${q({ deviceId: getDeviceId(), unseen: unseenOnly ? 1 : undefined })}`),
  markAlertSeen: (id: number) => request<{ ok: true }>(`/api/alerts/${id}/seen`, { method: 'POST', body: JSON.stringify({ deviceId: getDeviceId() }) }),
  watches: () => request<WatchEntry[]>(`/api/watchlist?${q({ deviceId: getDeviceId() })}`),
  addWatch: (productId: number, targetPriceKwd: number) =>
    request<unknown>('/api/watchlist', { method: 'POST', body: JSON.stringify({ deviceId: getDeviceId(), productId, targetPriceKwd }) }),
  removeWatch: (id: number) => request<{ ok: true }>(`/api/watchlist/${id}?${q({ deviceId: getDeviceId() })}`, { method: 'DELETE' }),
}

/** Fired after a scan so the Alerts badge refreshes immediately. */
export const ALERTS_CHANGED_EVENT = 'logta:alerts-changed'
export const notifyAlertsChanged = () => window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT))
