/**
 * Smart Basket Optimizer: cheapest 1–3 store combination for a shopping list, after travel/delivery cost.
 */
import { eq, inArray } from 'drizzle-orm';
import { getDb, type DB } from '../db/client.ts';
import { listItems, products, shoppingLists, stores, users, type Store } from '../db/schema.ts';
import { getPriceMatrix, type PriceMatrix } from './prices.ts';
import { toBaseQty } from './normalize.ts';
import { combinations, haversineKm, roundTripKm, type LatLng } from './geo.ts';

export interface OptimizeOptions {
  /** Max stores in a plan (1–3, default 3). */
  maxStores?: number;
  /** Fuel cost per km driven, KWD (default 0.008). */
  fuelCostPerKm?: number;
  /** Value of time per km driven, KWD (default 0). */
  timeCostPerKm?: number;
  /** Multiplier from straight-line to road distance (default 1.3). */
  roadFactor?: number;
  /** Restrict to these store ids. */
  storeIds?: number[];
  includeOnline?: boolean;
  /** Number of plans to return (default 3). */
  topN?: number;
  now?: Date;
  db?: DB;
}

export interface BasketItemInput {
  productId: number;
  qty: number;
  allowSubstitute: boolean;
}

export interface PlanLine {
  requestedProductId: number;
  productId: number; // differs from requested when substituted
  nameEn: string;
  nameAr: string;
  qty: number; // packs bought
  unitPriceKwd: number;
  lineTotalKwd: number;
  trust: number;
  isPromo: boolean;
  substituted: boolean;
}

export interface StorePlan {
  storeId: number;
  slug: string;
  nameEn: string;
  nameAr: string;
  type: Store['type'];
  items: PlanLine[];
  subtotal: number;
  deliveryFee: number;
}

export interface BasketPlan {
  stores: { id: number; slug: string; nameEn: string; nameAr: string; type: Store['type'] }[];
  itemsPerStore: StorePlan[];
  subtotal: number;
  /** Driving cost (fuel + time) for physical stores plus delivery fees for online stores. */
  travelCost: number;
  travelKm: number;
  total: number;
  /** Positive = this plan is cheaper than the best single-store plan. */
  savingsVsBestSingleStore: number;
  missingItems: { productId: number; nameEn: string; nameAr: string }[];
  substitutions: { requestedProductId: number; requestedNameEn: string; productId: number; nameEn: string; storeId: number }[];
  avgTrust: number;
}

// Geometry helpers live in ./geo.ts (shared with the browser UI); re-exported to keep this module's public API.
export { combinations, haversineKm, roundTripKm };
export type { LatLng };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

type ProductInfo = { id: number; nameEn: string; nameAr: string; substituteGroup: string | null; baseQty: number; packCount: number };

/**
 * Core optimiser on explicit inputs (pure apart from reading prices). `optimizeBasket` wraps it for a saved list.
 */
export function optimizeItems(items: BasketItemInput[], userLocation: LatLng, opts: OptimizeOptions = {}): BasketPlan[] {
  const db = opts.db ?? getDb();
  const maxStores = Math.min(3, Math.max(1, opts.maxStores ?? 3));
  const fuel = opts.fuelCostPerKm ?? 0.008;
  const timeCost = opts.timeCostPerKm ?? 0;
  const roadFactor = opts.roadFactor ?? 1.3;
  const topN = opts.topN ?? 3;
  if (!items.length) return [];

  // products in the list + every product sharing a substitute group with them
  const listProducts = db.select().from(products).where(inArray(products.id, items.map((i) => i.productId))).all();
  const groups = [...new Set(listProducts.map((p) => p.substituteGroup).filter((g): g is string => !!g))];
  const groupProducts = groups.length ? db.select().from(products).where(inArray(products.substituteGroup, groups)).all() : [];
  const info = new Map<number, ProductInfo>();
  for (const p of [...listProducts, ...groupProducts]) {
    if (p.status !== 'active' && !items.some((i) => i.productId === p.id)) continue;
    info.set(p.id, { id: p.id, nameEn: p.nameEn, nameAr: p.nameAr, substituteGroup: p.substituteGroup, baseQty: toBaseQty(p.sizeValue, p.sizeUnit).baseQty * p.packCount, packCount: p.packCount });
  }

  let allStores = db.select().from(stores).all();
  if (opts.storeIds) allStores = allStores.filter((s) => opts.storeIds!.includes(s.id));
  if (opts.includeOnline === false) allStores = allStores.filter((s) => s.type !== 'online');
  const matrix: PriceMatrix = getPriceMatrix([...info.keys()], { now: opts.now, db, storeIds: allStores.map((s) => s.id) });

  // ---- best purchase option per (item, store) — computed once, reused by every combination ----
  type Option = { line: PlanLine; cost: number } | null;
  const optionCache = new Map<string, Option>();
  const optionFor = (item: BasketItemInput, storeId: number, allowSub: boolean): Option => {
    const key = `${item.productId}:${storeId}:${allowSub}`;
    if (optionCache.has(key)) return optionCache.get(key)!;
    const req = info.get(item.productId)!;
    let opt: Option = null;
    const direct = matrix.prices[item.productId]?.[storeId];
    if (direct) {
      opt = { cost: direct.priceKwd * item.qty, line: { requestedProductId: req.id, productId: req.id, nameEn: req.nameEn, nameAr: req.nameAr, qty: item.qty, unitPriceKwd: direct.priceKwd, lineTotalKwd: round3(direct.priceKwd * item.qty), trust: direct.trust, isPromo: direct.isPromo, substituted: false } };
    } else if (allowSub && req.substituteGroup) {
      // cheapest same-group product by unit price; buy enough packs to cover the requested quantity
      const needBase = req.baseQty * item.qty;
      let bestUnit = Infinity;
      for (const p of info.values()) {
        if (p.id === req.id || p.substituteGroup !== req.substituteGroup) continue;
        const cp = matrix.prices[p.id]?.[storeId];
        if (!cp) continue;
        const unit = cp.priceKwd / p.baseQty;
        if (unit >= bestUnit) continue;
        bestUnit = unit;
        const packs = Math.max(1, Math.ceil(needBase / p.baseQty - 1e-9));
        opt = { cost: cp.priceKwd * packs, line: { requestedProductId: req.id, productId: p.id, nameEn: p.nameEn, nameAr: p.nameAr, qty: packs, unitPriceKwd: cp.priceKwd, lineTotalKwd: round3(cp.priceKwd * packs), trust: cp.trust, isPromo: cp.isPromo, substituted: true } };
      }
    }
    optionCache.set(key, opt);
    return opt;
  };

  const plans: (BasketPlan & { _missing: number })[] = [];
  for (let k = 1; k <= Math.min(maxStores, allStores.length); k++) {
    for (const combo of combinations(allStores, k)) {
      const perStore = new Map<number, PlanLine[]>(combo.map((s) => [s.id, []]));
      const missing: BasketPlan['missingItems'] = [];
      for (const item of items) {
        // 1) cheapest store in the combo that has the exact product
        let best: { storeId: number; opt: NonNullable<Option> } | null = null;
        for (const s of combo) {
          const o = optionFor(item, s.id, false);
          if (o && (!best || o.cost < best.opt.cost)) best = { storeId: s.id, opt: o };
        }
        // 2) not available anywhere in the combo → substitute (if allowed)
        if (!best && item.allowSubstitute) {
          for (const s of combo) {
            const o = optionFor(item, s.id, true);
            if (o && (!best || o.cost < best.opt.cost)) best = { storeId: s.id, opt: o };
          }
        }
        if (best) perStore.get(best.storeId)!.push(best.opt.line);
        else {
          const p = info.get(item.productId)!;
          missing.push({ productId: p.id, nameEn: p.nameEn, nameAr: p.nameAr });
        }
      }
      // a store with nothing assigned means this is really a smaller combination → skip (dominated)
      if (combo.some((s) => perStore.get(s.id)!.length === 0)) continue;

      let feasible = true;
      let travelCost = 0;
      const itemsPerStore: StorePlan[] = combo.map((s) => {
        const lines = perStore.get(s.id)!;
        const subtotal = round3(lines.reduce((a, l) => a + l.lineTotalKwd, 0));
        let deliveryFee = 0;
        if (s.type === 'online') {
          if (s.minOrderKwd != null && subtotal < s.minOrderKwd) feasible = false;
          deliveryFee = s.deliveryFeeKwd ?? 0;
        }
        return { storeId: s.id, slug: s.slug, nameEn: s.nameEn, nameAr: s.nameAr, type: s.type, items: lines, subtotal, deliveryFee };
      });
      if (!feasible) continue;
      const physical = combo.filter((s) => s.type !== 'online' && s.lat != null && s.lng != null).map((s) => ({ lat: s.lat!, lng: s.lng! }));
      const km = roundTripKm(userLocation, physical) * roadFactor;
      travelCost = km * (fuel + timeCost) + itemsPerStore.reduce((a, s) => a + s.deliveryFee, 0);
      const subtotal = round3(itemsPerStore.reduce((a, s) => a + s.subtotal, 0));
      const lines = itemsPerStore.flatMap((s) => s.items);
      plans.push({
        stores: combo.map((s) => ({ id: s.id, slug: s.slug, nameEn: s.nameEn, nameAr: s.nameAr, type: s.type })),
        itemsPerStore,
        subtotal,
        travelCost: round3(travelCost),
        travelKm: Math.round(km * 10) / 10,
        total: round3(subtotal + travelCost),
        savingsVsBestSingleStore: 0,
        missingItems: missing,
        substitutions: itemsPerStore.flatMap((s) => s.items.filter((l) => l.substituted).map((l) => ({ requestedProductId: l.requestedProductId, requestedNameEn: info.get(l.requestedProductId)!.nameEn, productId: l.productId, nameEn: l.nameEn, storeId: s.storeId }))),
        avgTrust: lines.length ? round3(lines.reduce((a, l) => a + l.trust, 0) / lines.length) : 0,
        _missing: missing.length,
      });
    }
  }

  // complete baskets first, then cheapest total
  plans.sort((a, b) => a._missing - b._missing || a.total - b.total);
  const singles = plans.filter((p) => p.stores.length === 1);
  const bestSingle = singles.length ? singles.reduce((m, p) => (p._missing < m._missing || (p._missing === m._missing && p.total < m.total) ? p : m)) : null;
  return plans.slice(0, topN).map(({ _missing, ...p }) => ({ ...p, savingsVsBestSingleStore: bestSingle ? round3(bestSingle.total - p.total) : 0 }));
}

/**
 * Optimise a saved shopping list. `userLocation` defaults to the list owner's home location.
 */
export function optimizeBasket(listId: number, userLocation?: LatLng | null, opts: OptimizeOptions = {}): BasketPlan[] {
  const db = opts.db ?? getDb();
  const list = db.select().from(shoppingLists).where(eq(shoppingLists.id, listId)).get();
  if (!list) throw new Error(`Shopping list ${listId} not found`);
  let loc = userLocation ?? null;
  if (!loc && list.userId != null) {
    const u = db.select().from(users).where(eq(users.id, list.userId)).get();
    if (u?.homeLat != null && u.homeLng != null) loc = { lat: u.homeLat, lng: u.homeLng };
  }
  if (!loc) throw new Error('optimizeBasket: userLocation is required (list owner has no home location)');
  const items = db.select().from(listItems).where(eq(listItems.listId, listId)).all();
  return optimizeItems(items.map((i) => ({ productId: i.productId, qty: i.qty, allowSubstitute: i.allowSubstitute })), loc, { ...opts, db });
}
