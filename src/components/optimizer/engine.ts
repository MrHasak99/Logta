/**
 * Browser Basket Optimizer engine.
 *
 * `src/lib/optimizer.ts` is the reference engine but it reads SQLite (better-sqlite3), which cannot run in the
 * browser, and the app's live data (AppContext: string ids, price history, in-stock flags) is not in that DB.
 * This module applies the SAME algorithm to the AppContext data set:
 *   - every 1..3 store combination is evaluated (exact product at the cheapest combo store first; a substitute only
 *     when no store in the combo has it; online stores need their minimum order; dominated combos are skipped)
 *   - travel = shortest round trip (shared `roundTripKm` / `combinations` from src/lib/geo.ts) x road factor x fuel
 *   - plans sort "complete baskets first, then cheapest total"; savings are measured vs the best single store
 * Constants mirror the reference engine's defaults.
 */
import type { PriceEntry, PriceSource, Product, Store } from '../../data/types'
import { combinations, roundTripKm, type LatLng } from '../../lib/geo.ts'

export const FUEL_COST_PER_KM = 0.008
export const ROAD_FACTOR = 1.3
/** Taw9eel (the only online store) delivery terms, as seeded in src/db/seed-data.ts. */
export const ONLINE_DELIVERY_FEE_KWD = 0.75
export const ONLINE_MIN_ORDER_KWD = 5
export const MAX_STORES = 3

const round3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * Products that can stand in for each other (same kind of item, same unit dimension). The app's catalogue has no
 * substitute-group field, so the groups are declared here; products outside every group are never swapped.
 */
const SUBSTITUTE_GROUPS: string[][] = [
  ['almarai-fresh-milk-1l', 'almarai-low-fat-milk-2l'],
  ['puck-cream-cheese-500', 'philadelphia-180'],
  ['evian-6x1.5', 'aquafina-12x500'],
]

const groupOf = (productId: string) => SUBSTITUTE_GROUPS.find((g) => g.includes(productId))

/** "6 x 1.5L" -> 9000 (ml), "500g" -> 500, "24 pcs" -> 24. Falls back to 1 when the size cannot be read. */
export const parseBaseQty = (unitSize: string): number => {
  let s = unitSize.toLowerCase().replace(/,/g, '')
  let mult = 1
  const multi = s.match(/^(\d+)\s*x\s*/)
  if (multi) {
    mult = Number(multi[1])
    s = s.slice(multi[0].length)
  }
  const m = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|[a-z]+)?/)
  if (!m) return 1
  const factor = m[2] === 'kg' || m[2] === 'l' ? 1000 : 1
  return Math.max(1e-9, Number(m[1]) * factor * mult)
}

export interface BasketLine {
  productId: string
  qty: number
  allowSubstitute: boolean
}

export interface PlanLine {
  requestedProductId: string
  productId: string
  nameEn: string
  nameAr: string
  /** Packs bought (differs from the requested qty when a substitute has a different pack size). */
  qty: number
  unitPriceKwd: number
  lineTotalKwd: number
  /** Where this price came from (Receipt Scan / Shelf Tag / ...). */
  source: PriceSource
  substituted: boolean
  requestedNameEn: string
  requestedNameAr: string
}

export interface StopPlan {
  store: Store
  items: PlanLine[]
  subtotal: number
  deliveryFee: number
}

/** "{item} is out of stock at {atStore}" plus what the plan does about it. */
export interface StockNote {
  productId: string
  nameEn: string
  nameAr: string
  atStore: Store
  resolution:
    | { kind: 'swapped'; line: PlanLine; store: Store }
    | { kind: 'elsewhere'; store: Store }
    | { kind: 'missing' }
}

export interface BasketPlan {
  key: string
  stops: StopPlan[]
  subtotal: number
  /** Driving cost (fuel) for physical stores. */
  drivingCost: number
  /** Delivery fees of online stores. */
  deliveryCost: number
  /** drivingCost + deliveryCost. */
  travelCost: number
  travelKm: number
  /** subtotal + travelCost. */
  total: number
  /** Positive = cheaper than the best single-store plan. */
  netSavings: number
  missingItems: { productId: string; nameEn: string; nameAr: string }[]
  stockNotes: StockNote[]
}

export interface OptimizerResult {
  /** Every viable plan, complete baskets first then cheapest total. `plans[0]` is the recommendation. */
  plans: BasketPlan[]
  /** Best plan using exactly 1 / 2 / 3 stores (null when no such plan is viable or non-dominated). */
  bestByStoreCount: Record<1 | 2 | 3, BasketPlan | null>
  baseline: BasketPlan | null
}

export interface OptimizerData {
  products: Product[]
  stores: Store[]
  priceEntries: PriceEntry[]
}

/** Latest price entry per product x store (entries are append-only history; the newest one is current). */
export const currentEntries = (entries: PriceEntry[]): Map<string, PriceEntry> => {
  const map = new Map<string, PriceEntry>()
  for (const e of entries) {
    const k = `${e.productId}|${e.storeId}`
    const prev = map.get(k)
    if (!prev || e.timestamp > prev.timestamp) map.set(k, e)
  }
  return map
}

export function optimizeBasket(lines: BasketLine[], home: LatLng, data: OptimizerData): OptimizerResult {
  const empty: OptimizerResult = { plans: [], bestByStoreCount: { 1: null, 2: null, 3: null }, baseline: null }
  const productById = new Map(data.products.map((p) => [p.id, p]))
  const items = lines.filter((l) => l.qty > 0 && productById.has(l.productId))
  if (!items.length || !data.stores.length) return empty

  const current = currentEntries(data.priceEntries)
  const entryOf = (productId: string, storeId: string) => current.get(`${productId}|${storeId}`)
  /** A price counts only when the product is in stock there. */
  const availableAt = (productId: string, storeId: string) => {
    const e = entryOf(productId, storeId)
    return e && e.inStock ? e : undefined
  }

  type Option = { line: PlanLine; cost: number } | null
  const cache = new Map<string, Option>()
  const optionFor = (item: BasketLine, store: Store, allowSub: boolean): Option => {
    const key = `${item.productId}|${store.id}|${allowSub}`
    if (cache.has(key)) return cache.get(key)!
    const req = productById.get(item.productId)!
    let opt: Option = null
    const direct = availableAt(req.id, store.id)
    if (direct) {
      opt = {
        cost: direct.priceKwd * item.qty,
        line: {
          requestedProductId: req.id, productId: req.id, nameEn: req.nameEn, nameAr: req.nameAr, qty: item.qty,
          unitPriceKwd: direct.priceKwd, lineTotalKwd: round3(direct.priceKwd * item.qty), source: direct.source,
          substituted: false, requestedNameEn: req.nameEn, requestedNameAr: req.nameAr,
        },
      }
    } else if (allowSub) {
      // Cheapest same-group product by unit price; buy enough packs to cover the requested quantity.
      const needBase = parseBaseQty(req.unitSize) * item.qty
      let bestUnit = Infinity
      for (const id of groupOf(req.id) ?? []) {
        const p = productById.get(id)
        if (!p || p.id === req.id) continue
        const cp = availableAt(p.id, store.id)
        if (!cp) continue
        const packBase = parseBaseQty(p.unitSize)
        const unit = cp.priceKwd / packBase
        if (unit >= bestUnit) continue
        bestUnit = unit
        const packs = Math.max(1, Math.ceil(needBase / packBase - 1e-9))
        opt = {
          cost: cp.priceKwd * packs,
          line: {
            requestedProductId: req.id, productId: p.id, nameEn: p.nameEn, nameAr: p.nameAr, qty: packs,
            unitPriceKwd: cp.priceKwd, lineTotalKwd: round3(cp.priceKwd * packs), source: cp.source,
            substituted: true, requestedNameEn: req.nameEn, requestedNameAr: req.nameAr,
          },
        }
      }
    }
    cache.set(key, opt)
    return opt
  }

  const plans: (BasketPlan & { _missing: number })[] = []
  for (let k = 1; k <= Math.min(MAX_STORES, data.stores.length); k++) {
    for (const combo of combinations(data.stores, k)) {
      const perStore = new Map<string, PlanLine[]>(combo.map((s) => [s.id, []]))
      const missing: BasketPlan['missingItems'] = []
      for (const item of items) {
        let best: { store: Store; opt: NonNullable<Option> } | null = null
        for (const s of combo) {
          const o = optionFor(item, s, false)
          if (o && (!best || o.cost < best.opt.cost)) best = { store: s, opt: o }
        }
        if (!best && item.allowSubstitute) {
          for (const s of combo) {
            const o = optionFor(item, s, true)
            if (o && (!best || o.cost < best.opt.cost)) best = { store: s, opt: o }
          }
        }
        if (best) perStore.get(best.store.id)!.push(best.opt.line)
        else {
          const p = productById.get(item.productId)!
          missing.push({ productId: p.id, nameEn: p.nameEn, nameAr: p.nameAr })
        }
      }
      // A store with nothing assigned means this is really a smaller combination: skip (dominated).
      if (combo.some((s) => perStore.get(s.id)!.length === 0)) continue

      let feasible = true
      const stops: StopPlan[] = combo.map((s) => {
        const stopItems = perStore.get(s.id)!
        const subtotal = round3(stopItems.reduce((a, l) => a + l.lineTotalKwd, 0))
        let deliveryFee = 0
        if (s.isOnline) {
          if (subtotal < ONLINE_MIN_ORDER_KWD) feasible = false
          deliveryFee = ONLINE_DELIVERY_FEE_KWD
        }
        return { store: s, items: stopItems, subtotal, deliveryFee }
      })
      if (!feasible) continue

      const km = roundTripKm(home, combo.filter((s) => !s.isOnline).map((s) => ({ lat: s.lat, lng: s.lng }))) * ROAD_FACTOR
      const drivingCost = round3(km * FUEL_COST_PER_KM)
      const deliveryCost = round3(stops.reduce((a, s) => a + s.deliveryFee, 0))
      const subtotal = round3(stops.reduce((a, s) => a + s.subtotal, 0))

      // Out-of-stock notes: requested item has an entry marked out of stock at a store in this plan.
      const stockNotes: StockNote[] = []
      for (const item of items) {
        const p = productById.get(item.productId)!
        const holder = stops.find((st) => st.items.some((l) => l.requestedProductId === p.id))
        const line = holder?.items.find((l) => l.requestedProductId === p.id)
        for (const s of combo) {
          const e = entryOf(p.id, s.id)
          if (!e || e.inStock) continue
          stockNotes.push({
            productId: p.id, nameEn: p.nameEn, nameAr: p.nameAr, atStore: s,
            resolution:
              holder && line
                ? line.substituted
                  ? { kind: 'swapped', line, store: holder.store }
                  : { kind: 'elsewhere', store: holder.store }
                : { kind: 'missing' },
          })
        }
      }

      plans.push({
        key: combo.map((s) => s.id).join('+'),
        stops,
        subtotal,
        drivingCost,
        deliveryCost,
        travelCost: round3(drivingCost + deliveryCost),
        travelKm: Math.round(km * 10) / 10,
        total: round3(subtotal + drivingCost + deliveryCost),
        netSavings: 0,
        missingItems: missing,
        stockNotes,
        _missing: missing.length,
      })
    }
  }

  plans.sort((a, b) => a._missing - b._missing || a.total - b.total || a.stops.length - b.stops.length)
  const baseline = plans.find((p) => p.stops.length === 1) ?? null
  const final: BasketPlan[] = plans.map(({ _missing, ...p }) => ({
    ...p,
    netSavings: baseline ? round3(baseline.total - p.total) : 0,
  }))
  const pick = (n: number) => final.find((p) => p.stops.length === n) ?? null
  return {
    plans: final,
    bestByStoreCount: { 1: pick(1), 2: pick(2), 3: pick(3) },
    baseline: baseline ? (final.find((p) => p.key === baseline.key) ?? null) : null,
  }
}
