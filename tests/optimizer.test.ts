import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../src/db/client.ts';
import { combinations, optimizeItems, roundTripKm } from '../src/lib/optimizer.ts';
import { daysAgo, memDb, NOW, obs, tinyWorld } from './helpers.ts';

/**
 * Hand-checked fixture (prices in KWD):
 *
 *            milk(×2)  rice(×1)  oil(×1)
 *   A        0.400     5.000     1.600
 *   B        0.350     4.500     —
 *   C        0.420     4.600     1.400
 *
 * Without travel cost:
 *   singles: A = 7.400, C = 6.840, B misses oil
 *   pairs:   A+B = 0.70+4.50+1.60 = 6.800, A+C = 0.80+4.60+1.40 = 6.800, B+C = 0.70+4.50+1.40 = 6.600
 *   triple:  A+B+C → A gets nothing → dominated (skipped)
 *   ⇒ best = B+C 6.600, saving 0.240 vs best single store (C 6.840)
 */
let db: DB;
let ids: { milk: number; rice: number; oil: number; oil2: number; A: number; B: number; C: number };
const home = { lat: 29.3, lng: 48.0 };

beforeEach(() => {
  db = memDb();
  const w = tinyWorld(db);
  const milk = w.product('milk', w.cats.dairy.id, 1, 'L', 'milk_1L').id;
  const rice = w.product('rice', w.cats.rice.id, 5, 'kg', 'rice_5kg').id;
  const oil = w.product('oil', w.cats.rice.id, 1.8, 'L', 'oil_1.8L').id;
  const oil2 = w.product('oil-other-brand', w.cats.rice.id, 1.8, 'L', 'oil_1.8L').id;
  const A = w.store('A', 'coop', 29.3, 48.0).id;
  const B = w.store('B', 'coop', 29.31, 48.0).id;
  const C = w.store('C', 'coop', 29.3, 48.01).id;
  const price = (p: number, s: number, v: number) => obs(db, p, s, v, daysAgo(1));
  price(milk, A, 0.4); price(rice, A, 5.0); price(oil, A, 1.6);
  price(milk, B, 0.35); price(rice, B, 4.5);
  price(milk, C, 0.42); price(rice, C, 4.6); price(oil, C, 1.4);
  ids = { milk, rice, oil, oil2, A, B, C };
});

const list = () => [
  { productId: ids.milk, qty: 2, allowSubstitute: true },
  { productId: ids.rice, qty: 1, allowSubstitute: true },
  { productId: ids.oil, qty: 1, allowSubstitute: true },
];

describe('optimizeItems', () => {
  it('finds the hand-computed optimum with zero travel cost', () => {
    const plans = optimizeItems(list(), home, { fuelCostPerKm: 0, now: NOW, db });
    expect(plans).toHaveLength(3);
    expect(plans[0]!.stores.map((s) => s.slug).sort()).toEqual(['B', 'C']);
    expect(plans[0]!.subtotal).toBe(6.6);
    expect(plans[0]!.total).toBe(6.6);
    expect(plans[0]!.savingsVsBestSingleStore).toBe(0.24);
    expect(plans[0]!.missingItems).toHaveLength(0);
    // items assigned to the cheapest store within the combination
    const byStore = Object.fromEntries(plans[0]!.itemsPerStore.map((s) => [s.slug, s.items.map((i) => i.productId).sort()]));
    expect(byStore.B).toEqual([ids.milk, ids.rice].sort());
    expect(byStore.C).toEqual([ids.oil]);
    expect(plans[1]!.total).toBe(6.8);
    expect(plans[2]!.total).toBe(6.8);
  });

  it('substitutes the cheapest same-group product (by unit price) when the item is missing in the combination', () => {
    obs(db, ids.oil2, ids.B, 1.3, daysAgo(1));
    const plans = optimizeItems(list(), home, { fuelCostPerKm: 0, maxStores: 1, now: NOW, db });
    expect(plans[0]!.stores[0]!.slug).toBe('B');
    expect(plans[0]!.total).toBe(6.5); // 0.70 + 4.50 + 1.30
    expect(plans[0]!.substitutions).toEqual([expect.objectContaining({ requestedProductId: ids.oil, productId: ids.oil2 })]);
  });

  it('does not substitute when allow_substitute is false → item reported missing', () => {
    obs(db, ids.oil2, ids.B, 1.3, daysAgo(1));
    const items = list().map((i) => (i.productId === ids.oil ? { ...i, allowSubstitute: false } : i));
    const plans = optimizeItems(items, home, { fuelCostPerKm: 0, maxStores: 1, storeIds: [ids.B], now: NOW, db });
    expect(plans[0]!.missingItems.map((m) => m.productId)).toEqual([ids.oil]);
  });

  it('adds travel cost: haversine round trip × 1.3 road factor × fuel cost', () => {
    const plans = optimizeItems(list(), home, { fuelCostPerKm: 1, maxStores: 1, storeIds: [ids.C], now: NOW, db });
    const km = roundTripKm(home, [{ lat: 29.3, lng: 48.01 }]) * 1.3;
    expect(plans[0]!.travelCost).toBeCloseTo(km, 3);
    expect(plans[0]!.total).toBeCloseTo(6.84 + km, 3);
    // expensive travel makes a single nearby store beat the two-store plan
    const pricey = optimizeItems(list(), home, { fuelCostPerKm: 5, now: NOW, db });
    expect(pricey[0]!.stores).toHaveLength(1);
  });

  it('uses delivery fee + minimum order for online stores instead of distance', () => {
    const D = db.$client.prepare(`INSERT INTO stores (slug,name_en,name_ar,type,delivery_fee_kwd,min_order_kwd,coords_approximate) VALUES ('D','D','D','online',0.75,10,1)`).run().lastInsertRowid as number;
    obs(db, ids.milk, D, 0.3, daysAgo(1)); obs(db, ids.rice, D, 4.0, daysAgo(1)); obs(db, ids.oil, D, 1.3, daysAgo(1));
    // basket 5.900 < min order 10 → online plans infeasible
    let plans = optimizeItems(list(), home, { fuelCostPerKm: 0.008, now: NOW, db });
    expect(plans.every((p) => p.stores.every((s) => s.slug !== 'D'))).toBe(true);
    db.$client.prepare(`UPDATE stores SET min_order_kwd = 5 WHERE id = ?`).run(D);
    // B+C is ~4.6 road-km away → at 0.05 KWD/km it costs 6.600 + ~0.23 > online 6.650
    plans = optimizeItems(list(), home, { fuelCostPerKm: 0.05, now: NOW, db });
    expect(plans[0]!.stores.map((s) => s.slug)).toEqual(['D']);
    expect(plans[0]!.total).toBe(6.65); // 5.900 + 0.750 delivery, no driving
    expect(plans[0]!.travelKm).toBe(0);
  });
});

describe('helpers', () => {
  it('enumerates combinations', () => {
    expect(combinations([1, 2, 3, 4], 2)).toHaveLength(6);
    expect(combinations([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });
});
