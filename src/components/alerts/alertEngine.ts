/**
 * Browser Price Alerts engine (Feature 3).
 *
 * `src/lib/alerts.ts` is the reference engine but it reads SQLite (better-sqlite3), which cannot run in the
 * browser, and the app's live data (AppContext: string ids, price history) is not in that DB. This module
 * applies the same rules to the AppContext data set:
 *   - a new price fires an alert when it is <= the watch target OR lower than the previous lowest price,
 *   - each alert carries 30-day min/avg/max and a "buy now" / "lower seen recently" hint,
 *   - watches and alerts live in localStorage (LOGTA_WATCHES / LOGTA_ALERTS).
 * Nothing here imports Node-only code. The adapters at the bottom reshape the string-id browser data into the
 * numeric-id API shapes the presentational AlertsScreen already renders.
 */
import type { PriceEntry, Product, Store } from '../../data/types'
import type { AlertEntry, ApiProduct, PriceCell, ProductListItem, SizeUnit, WatchCardData, WatchInsight } from '../../types/api'
import { roundKwd } from '../../utils/formatters'
import { currentEntries } from '../optimizer/engine'
import { resolveProduct } from '../optimizer/demo'

export const WATCHES_KEY = 'LOGTA_WATCHES'
export const ALERTS_KEY = 'LOGTA_ALERTS'
/** Fired (on window) whenever watches or alerts are written, so badges and screens refresh immediately. */
export const LOCAL_ALERTS_EVENT = 'logta:local-alerts-changed'

/** "Buy now" if the price is within this fraction of the 30-day minimum (same constant as src/lib/alerts.ts). */
export const BUY_NOW_TOLERANCE = 0.03
const DAY = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 30

export interface LocalWatch {
  id: number
  productId: string
  targetPriceKwd: number
  createdAt: string
  active: boolean
}

export interface LocalAlert {
  id: number
  watchId: number
  productId: string
  storeId: string
  /** The price that triggered the alert. */
  priceKwd: number
  /** Target of the watch when the alert fired. */
  targetPriceKwd: number
  triggeredAt: string
  observedAt: string
  seen: boolean
  hint: 'buy_now' | 'lower_seen_recently'
  stats: { min: number; avg: number; max: number }
  /** True for alerts created by the "Simulate Price Drop" test action. */
  simulated?: boolean
}

// ---------------------------------------------------------------------------
// localStorage
// ---------------------------------------------------------------------------

const readRaw = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const rawWatches = () => readRaw(WATCHES_KEY)
export const rawAlerts = () => readRaw(ALERTS_KEY)

/** null = never saved (first run), so the demo watches should be pre-seeded. */
export const parseWatches = (raw: string | null): LocalWatch[] | null => {
  if (raw === null) return null
  try {
    const v = JSON.parse(raw) as unknown
    return Array.isArray(v) ? (v as LocalWatch[]) : null
  } catch {
    return null
  }
}

export const parseAlerts = (raw: string | null): LocalAlert[] => {
  if (raw === null) return []
  try {
    const v = JSON.parse(raw) as unknown
    return Array.isArray(v) ? (v as LocalAlert[]) : []
  } catch {
    return []
  }
}

export const loadWatches = () => parseWatches(rawWatches())
export const loadAlerts = () => parseAlerts(rawAlerts())

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable: nothing else to do.
  }
  window.dispatchEvent(new Event(LOCAL_ALERTS_EVENT))
}

export const saveWatches = (watches: LocalWatch[]) => write(WATCHES_KEY, watches)
export const saveAlerts = (alerts: LocalAlert[]) => write(ALERTS_KEY, alerts)

/** Called by resetDemoData(): the next evaluation pass re-seeds the demo watches. */
export const clearAlertsStorage = () => {
  try {
    localStorage.removeItem(WATCHES_KEY)
    localStorage.removeItem(ALERTS_KEY)
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(LOCAL_ALERTS_EVENT))
}

const nextId = (items: { id: number }[]) => items.reduce((m, i) => Math.max(m, i.id), 0) + 1

// ---------------------------------------------------------------------------
// Price maths
// ---------------------------------------------------------------------------

export interface PriceStats {
  min: number
  avg: number
  max: number
}

/** min / avg / max of every price seen for the product (all stores) in the last 30 days. */
export const stats30d = (productId: string, entries: PriceEntry[], now = Date.now()): PriceStats | null => {
  const since = now - WINDOW_DAYS * DAY
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let n = 0
  for (const e of entries) {
    if (e.productId !== productId) continue
    const ts = new Date(e.timestamp).getTime()
    if (!(ts >= since)) continue
    min = Math.min(min, e.priceKwd)
    max = Math.max(max, e.priceKwd)
    sum += e.priceKwd
    n++
  }
  return n ? { min: roundKwd(min), avg: roundKwd(sum / n), max: roundKwd(max) } : null
}

/** Cheapest in-stock current price (latest entry per store) for a product. */
export const bestCurrent = (productId: string, entries: PriceEntry[]): PriceEntry | null => {
  let best: PriceEntry | null = null
  for (const e of currentEntries(entries.filter((x) => x.productId === productId)).values()) {
    if (!e.inStock) continue
    if (!best || e.priceKwd < best.priceKwd) best = e
  }
  return best
}

const hintFor = (price: number, stats: PriceStats): LocalAlert['hint'] =>
  price <= stats.min * (1 + BUY_NOW_TOLERANCE) ? 'buy_now' : 'lower_seen_recently'

/**
 * Timing advice for a watch card. "Buy now" only when the best current price is within 3% of the 30-day low
 * AND already meets the user's target; otherwise the advice is to wait.
 */
export const computeInsight = (watch: LocalWatch, entries: PriceEntry[], now = Date.now()): WatchInsight | null => {
  const stats = stats30d(watch.productId, entries, now)
  if (!stats) return null
  const best = bestCurrent(watch.productId, entries)
  const atLow = !!best && best.priceKwd <= stats.min * (1 + BUY_NOW_TOLERANCE)
  const reached = !!best && best.priceKwd <= watch.targetPriceKwd
  return { low: stats.min, high: stats.max, timing: atLow && reached ? 'buy_now' : 'wait' }
}

// ---------------------------------------------------------------------------
// Alert creation
// ---------------------------------------------------------------------------

const fmt = (n: number) => n.toFixed(3)

interface BuildArgs {
  id: number
  watch: LocalWatch
  entry: Pick<PriceEntry, 'storeId' | 'priceKwd' | 'timestamp'>
  entries: PriceEntry[]
  now: Date
  simulated?: boolean
}

const buildAlert = ({ id, watch, entry, entries, now, simulated }: BuildArgs): LocalAlert => {
  const base = stats30d(watch.productId, entries, now.getTime())
  // The triggering price always counts toward the range it is compared with.
  const stats: PriceStats = base
    ? { min: Math.min(base.min, entry.priceKwd), avg: base.avg, max: Math.max(base.max, entry.priceKwd) }
    : { min: entry.priceKwd, avg: entry.priceKwd, max: entry.priceKwd }
  return {
    id,
    watchId: watch.id,
    productId: watch.productId,
    storeId: entry.storeId,
    priceKwd: roundKwd(entry.priceKwd),
    targetPriceKwd: watch.targetPriceKwd,
    triggeredAt: now.toISOString(),
    observedAt: entry.timestamp,
    seen: false,
    hint: hintFor(entry.priceKwd, stats),
    stats,
    ...(simulated ? { simulated: true } : {}),
  }
}

/** Mirrors the server rule: no repeat alert for the same watch + store at the same or a lower price within 24h. */
const isDuplicate = (alerts: LocalAlert[], watchId: number, storeId: string, price: number, now: Date) =>
  alerts.some(
    (a) =>
      !a.simulated &&
      a.watchId === watchId &&
      a.storeId === storeId &&
      a.priceKwd <= price &&
      now.getTime() - new Date(a.triggeredAt).getTime() < DAY,
  )

/**
 * Evaluates freshly added price entries against the active watches and returns the NEW alerts (not yet saved).
 * An alert fires when the new price is <= the target or lower than the previous lowest current price.
 */
export function evaluateNewEntries(args: {
  watches: LocalWatch[]
  newEntries: PriceEntry[]
  allEntries: PriceEntry[]
  alerts: LocalAlert[]
  now?: Date
}): LocalAlert[] {
  const now = args.now ?? new Date()
  const active = args.watches.filter((w) => w.active)
  if (!active.length || !args.newEntries.length) return []

  // Newest new entry per product x store (only in-stock prices count).
  const latestNew = new Map<string, PriceEntry>()
  for (const e of args.newEntries) {
    if (!e.inStock) continue
    const k = `${e.productId}|${e.storeId}`
    const prev = latestNew.get(k)
    if (!prev || e.timestamp >= prev.timestamp) latestNew.set(k, e)
  }
  if (!latestNew.size) return []

  const newIds = new Set(args.newEntries.map((e) => e.id))
  const previous = currentEntries(args.allEntries.filter((e) => !newIds.has(e.id)))
  const previousLowest = (productId: string) => {
    let low = Infinity
    for (const e of previous.values()) if (e.productId === productId && e.inStock) low = Math.min(low, e.priceKwd)
    return low
  }

  const out: LocalAlert[] = []
  let id = nextId(args.alerts)
  for (const w of active) {
    const low = previousLowest(w.productId)
    for (const e of latestNew.values()) {
      if (e.productId !== w.productId) continue
      if (!(e.priceKwd <= w.targetPriceKwd || e.priceKwd < low)) continue
      if (isDuplicate([...args.alerts, ...out], w.id, e.storeId, e.priceKwd, now)) continue
      out.push(buildAlert({ id: id++, watch: w, entry: e, entries: args.allEntries, now }))
    }
  }
  return out
}

/** Alert for a watch against today's cheapest price (used right after a watch is created or edited). */
export function alertForCurrentBest(watch: LocalWatch, entries: PriceEntry[], alerts: LocalAlert[], now = new Date()): LocalAlert | null {
  const best = bestCurrent(watch.productId, entries)
  if (!best || best.priceKwd > watch.targetPriceKwd) return null
  if (isDuplicate(alerts, watch.id, best.storeId, best.priceKwd, now)) return null
  return buildAlert({ id: nextId(alerts), watch, entry: best, entries, now })
}

/** "Simulate Price Drop": a test alert just below the target at the cheapest store. Price data is not modified. */
export function simulateDrop(watch: LocalWatch, entries: PriceEntry[], stores: Store[], alerts: LocalAlert[], now = new Date()): LocalAlert | null {
  const best = bestCurrent(watch.productId, entries)
  const storeId = best?.storeId ?? stores[0]?.id
  if (!storeId) return null
  const price = roundKwd(Math.max(0.001, watch.targetPriceKwd - 0.01))
  return buildAlert({
    id: nextId(alerts),
    watch,
    entry: { storeId, priceKwd: price, timestamp: now.toISOString() },
    entries,
    now,
    simulated: true,
  })
}

// ---------------------------------------------------------------------------
// Demo pre-seed
// ---------------------------------------------------------------------------

interface DemoWatchSpec {
  id: string
  keyword: string
  targetPriceKwd: number
  /** Create an alert straight away (the target is already met at the cheapest store). */
  alertNow: boolean
}

export const DEMO_WATCHES: DemoWatchSpec[] = [
  // Just above the 0.550 KD on the Mishref Co-op sample receipt: confirming that scan fires a live alert.
  { id: 'almarai-fresh-milk-1l', keyword: 'fresh milk', targetPriceKwd: 0.56, alertNow: false },
  // Already met at the cheapest store: shows an active alert card immediately.
  { id: 'kiri-square-24', keyword: 'kiri', targetPriceKwd: 1.35, alertNow: true },
  // Still monitoring: shows the 30-day range and a "wait" hint.
  { id: 'sadia-chicken-breast-1kg', keyword: 'chicken breast', targetPriceKwd: 2.0, alertNow: false },
]

export function seedDemo(products: Product[], entries: PriceEntry[], now = new Date()): { watches: LocalWatch[]; alerts: LocalAlert[] } {
  const watches: LocalWatch[] = []
  const alerts: LocalAlert[] = []
  for (const spec of DEMO_WATCHES) {
    const p = resolveProduct(spec, products)
    if (!p || watches.some((w) => w.productId === p.id)) continue
    const watch: LocalWatch = {
      id: watches.length + 1,
      productId: p.id,
      targetPriceKwd: spec.targetPriceKwd,
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      active: true,
    }
    watches.push(watch)
    if (spec.alertNow) {
      const best = bestCurrent(p.id, entries)
      if (best && best.priceKwd <= watch.targetPriceKwd) {
        const triggered = new Date(now.getTime() - 2 * 60 * 60 * 1000)
        alerts.push(buildAlert({ id: alerts.length + 1, watch, entry: best, entries, now: triggered }))
      }
    }
  }
  return { watches, alerts }
}

// ---------------------------------------------------------------------------
// Adapters: browser data (string ids) -> the numeric-id API shapes AlertsScreen renders
// ---------------------------------------------------------------------------

export interface AdapterCtx {
  products: Product[]
  stores: Store[]
  entries: PriceEntry[]
  /** string id -> numeric id (catalogue index + 1; the catalogue is append-only). */
  pNum: Map<string, number>
  sNum: Map<string, number>
  pById: Map<string, Product>
  sById: Map<string, Store>
}

export const makeCtx = (products: Product[], stores: Store[], entries: PriceEntry[]): AdapterCtx => ({
  products,
  stores,
  entries,
  pNum: new Map(products.map((p, i) => [p.id, i + 1])),
  sNum: new Map(stores.map((s, i) => [s.id, i + 1])),
  pById: new Map(products.map((p) => [p.id, p])),
  sById: new Map(stores.map((s) => [s.id, s])),
})

/** "1L" -> 1 L, "6 x 1.5L" -> 9 L, "5 x 70g" -> 350 g, "24 pcs" / "100 bags" -> pcs count. */
export const parseSize = (unitSize: string): { sizeValue: number; sizeUnit: SizeUnit } => {
  const s = unitSize.toLowerCase().replace(/,/g, '').trim()
  const unitOf = (u: string): SizeUnit | null => (u === 'kg' ? 'kg' : u === 'g' ? 'g' : u === 'ml' ? 'ml' : u === 'l' ? 'L' : null)
  const multi = s.match(/^(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)$/)
  if (multi) return { sizeValue: Number(multi[1]) * Number(multi[2]), sizeUnit: unitOf(multi[3])! }
  const single = s.match(/^(\d+(?:\.\d+)?)\s*(kg|g|ml|l)$/)
  if (single) return { sizeValue: Number(single[1]), sizeUnit: unitOf(single[2])! }
  const lead = s.match(/^(\d+(?:\.\d+)?)/)
  return { sizeValue: lead ? Number(lead[1]) : 1, sizeUnit: 'pcs' }
}

const toApiProduct = (p: Product, ctx: AdapterCtx): ApiProduct => ({
  id: ctx.pNum.get(p.id) ?? 0,
  nameEn: p.nameEn,
  nameAr: p.nameAr,
  brand: null,
  packCount: 1,
  ...parseSize(p.unitSize),
})

const toPriceCell = (e: PriceEntry, ctx: AdapterCtx): PriceCell => ({
  productId: ctx.pNum.get(e.productId) ?? 0,
  storeId: ctx.sNum.get(e.storeId) ?? 0,
  priceKwd: e.priceKwd,
  trust: Math.min(1, Math.max(0, e.confidence / 100)),
  lastObservedAt: e.timestamp,
  observationCount: 1,
  isPromo: false,
  sourceMix: { receipt: 0, shelf_tag: 0, manual: 0, seed: 0, seedEstimate: 0, seedWebSnapshot: 0 },
})

export const toProductListItem = (p: Product, ctx: AdapterCtx): ProductListItem => {
  const best = bestCurrent(p.id, ctx.entries)
  const stores = new Set<string>()
  for (const e of currentEntries(ctx.entries.filter((x) => x.productId === p.id)).values()) if (e.inStock) stores.add(e.storeId)
  return { ...toApiProduct(p, ctx), bestPrice: best ? toPriceCell(best, ctx) : null, storeCount: stores.size }
}

export const toWatchCardData = (w: LocalWatch, ctx: AdapterCtx): WatchCardData | null => {
  const p = ctx.pById.get(w.productId)
  if (!p) return null
  const best = bestCurrent(w.productId, ctx.entries)
  return {
    watch: { id: w.id, productId: ctx.pNum.get(p.id) ?? 0, targetPriceKwd: w.targetPriceKwd, createdAt: w.createdAt, active: w.active },
    product: toApiProduct(p, ctx),
    currentBest: best ? toPriceCell(best, ctx) : null,
    insight: computeInsight(w, ctx.entries),
  }
}

export const toAlertEntry = (a: LocalAlert, ctx: AdapterCtx): AlertEntry | null => {
  const p = ctx.pById.get(a.productId)
  const s = ctx.sById.get(a.storeId)
  if (!p || !s) return null
  const api = toApiProduct(p, ctx)
  return {
    alert: {
      id: a.id,
      seen: a.seen,
      triggeredAt: a.triggeredAt,
      messageEn: `${p.nameEn} is now ${fmt(a.priceKwd)} KD at ${s.nameEn} (your target: ${fmt(a.targetPriceKwd)} KD).`,
      messageAr: `${p.nameAr} أصبح الآن بسعر ${fmt(a.priceKwd)} د.ك في ${s.nameAr} (السعر المستهدف: ${fmt(a.targetPriceKwd)} د.ك).`,
    },
    watch: { id: a.watchId, targetPriceKwd: a.targetPriceKwd },
    product: { id: api.id, nameEn: api.nameEn, nameAr: api.nameAr, sizeValue: api.sizeValue, sizeUnit: api.sizeUnit },
    store: { id: ctx.sNum.get(s.id) ?? 0, nameEn: s.nameEn, nameAr: s.nameAr },
    priceKwd: a.priceKwd,
    observedAt: a.observedAt,
    hint: a.hint,
    stats: a.stats,
  }
}
