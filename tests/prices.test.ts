import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DB } from '../src/db/client.ts';
import { priceObservations, receiptLines, receipts } from '../src/db/schema.ts';
import { getCurrentPrice, getPriceMatrix, recordObservation, trustScore, weightedMedian } from '../src/lib/prices.ts';
import { daysAgo, memDb, NOW, obs, tinyWorld } from './helpers.ts';

describe('trustScore decay', () => {
  const base = { evidence: 'receipt' as const, confidence: 1, observedAt: NOW };
  it('applies evidence weights at age 0', () => {
    expect(trustScore(base, NOW, { volatility: 'low' })).toBeCloseTo(1, 6);
    expect(trustScore({ ...base, evidence: 'shelf_tag' }, NOW, { volatility: 'low' })).toBeCloseTo(0.85, 6);
    expect(trustScore({ ...base, evidence: 'manual' }, NOW, { volatility: 'low' })).toBeCloseTo(0.5, 6);
    expect(trustScore({ ...base, evidence: 'seed' }, NOW, { volatility: 'low' })).toBeCloseTo(0.4, 6);
  });
  it('decays with tau = 3 / 10 / 30 days by volatility', () => {
    const tenDaysOld = { ...base, observedAt: daysAgo(10) };
    expect(trustScore({ ...base, observedAt: daysAgo(3) }, NOW, { volatility: 'high' })).toBeCloseTo(Math.exp(-1), 6);
    expect(trustScore(tenDaysOld, NOW, { volatility: 'medium' })).toBeCloseTo(Math.exp(-1), 6);
    expect(trustScore(tenDaysOld, NOW, { volatility: 'low' })).toBeCloseTo(Math.exp(-10 / 30), 6);
    // produce decays much faster than rice
    expect(trustScore(tenDaysOld, NOW, { volatility: 'high' })).toBeLessThan(trustScore(tenDaysOld, NOW, { volatility: 'low' }) / 10);
  });
  it('multiplies confidence and user trust weight, clamped to 1', () => {
    expect(trustScore({ ...base, confidence: 0.5 }, NOW, { volatility: 'low', userTrustWeight: 1.2 })).toBeCloseTo(0.6, 6);
    expect(trustScore(base, NOW, { volatility: 'low', userTrustWeight: 1.5 })).toBe(1);
  });
});

describe('weightedMedian', () => {
  it('follows the weight mass', () => {
    expect(weightedMedian([{ value: 1, weight: 1 }, { value: 2, weight: 1 }, { value: 3, weight: 5 }])).toBe(3);
    expect(weightedMedian([{ value: 1, weight: 3 }, { value: 2, weight: 1 }, { value: 3, weight: 1 }])).toBe(1);
  });
});

describe('recordObservation quarantine', () => {
  let db: DB;
  let w: ReturnType<typeof tinyWorld>;
  let productId: number, storeId: number, u1: number, u2: number;

  beforeEach(() => {
    db = memDb();
    w = tinyWorld(db);
    productId = w.product('milk', w.cats.dairy.id, 1, 'L', 'milk_1L').id;
    storeId = w.store('coop', 'coop', 29.3, 48).id;
    u1 = w.user('a').id;
    u2 = w.user('b').id;
  });

  it('accepts with confidence × 0.7 when there is no history', () => {
    const r = recordObservation({ productId, storeId, priceKwd: 0.4, evidence: 'receipt', observedAt: NOW, confidence: 1, userId: u1 }, db);
    expect(r.status).toBe('accepted');
    expect(r.reason).toBe('no_history');
    expect(r.observation.confidence).toBeCloseTo(0.7, 6);
  });

  it('quarantines a price > 35% from the 30-day median, accepts normal prices', () => {
    for (const d of [2, 5, 8, 12]) obs(db, productId, storeId, 0.4, daysAgo(d));
    const ok = recordObservation({ productId, storeId, priceKwd: 0.45, evidence: 'receipt', observedAt: NOW, userId: u1 }, db);
    expect(ok.status).toBe('accepted');
    const bad = recordObservation({ productId, storeId, priceKwd: 2.8, evidence: 'receipt', observedAt: NOW, userId: u1 }, db);
    expect(bad.status).toBe('quarantined');
    expect(bad.referenceMedian).toBeCloseTo(0.4, 3);
    // ignores accepted observations older than 30 days
    obs(db, productId, storeId, 2.8, daysAgo(40));
    expect(recordObservation({ productId, storeId, priceKwd: 2.7, evidence: 'receipt', observedAt: NOW, userId: u1, receiptLineId: null }, db).status).toBe('quarantined');
  });

  it('auto-accepts a quarantined price when an independent observation within 25% arrives', () => {
    for (const d of [2, 5, 8]) obs(db, productId, storeId, 0.4, daysAgo(d));
    const first = recordObservation({ productId, storeId, priceKwd: 0.6, evidence: 'receipt', observedAt: daysAgo(1), userId: u1 }, db);
    expect(first.status).toBe('quarantined');
    // same user, no receipts → not independent → still quarantined
    const same = recordObservation({ productId, storeId, priceKwd: 0.61, evidence: 'receipt', observedAt: daysAgo(0.5), userId: u1 }, db);
    expect(same.status).toBe('quarantined');
    // different user, within 25% → both accepted
    const second = recordObservation({ productId, storeId, priceKwd: 0.62, evidence: 'receipt', observedAt: NOW, userId: u2 }, db);
    expect(second.status).toBe('accepted');
    expect(second.reason).toBe('confirmed_by_independent_observation');
    expect(second.promotedObservationIds).toContain(first.observation.id);
    expect(db.select().from(priceObservations).where(eq(priceObservations.id, first.observation.id)).get()!.status).toBe('accepted');
  });

  it('treats lines from the same receipt as NOT independent, different receipts as independent', () => {
    for (const d of [2, 5, 8]) obs(db, productId, storeId, 0.4, daysAgo(d));
    const rc = (n: number) => db.insert(receipts).values({ uploadedAt: NOW, status: 'processed', storeId, userId: u1, storeTextRaw: `r${n}` }).returning().get().id;
    const line = (r: number) => db.insert(receiptLines).values({ receiptId: r, rawText: 'x', qty: 1, matchMethod: 'alias_exact', status: 'matched' }).returning().get().id;
    const r1 = rc(1);
    const a = recordObservation({ productId, storeId, priceKwd: 0.6, evidence: 'receipt', observedAt: daysAgo(1), userId: u1, receiptLineId: line(r1) }, db);
    const b = recordObservation({ productId, storeId, priceKwd: 0.6, evidence: 'receipt', observedAt: daysAgo(1), userId: u1, receiptLineId: line(r1) }, db);
    expect([a.status, b.status]).toEqual(['quarantined', 'quarantined']);
    const c = recordObservation({ productId, storeId, priceKwd: 0.6, evidence: 'receipt', observedAt: NOW, userId: u1, receiptLineId: line(rc(2)) }, db);
    expect(c.status).toBe('accepted');
  });
});

describe('getCurrentPrice / getPriceMatrix', () => {
  it('weights fresh receipts above old seed estimates and reports source mix', () => {
    const db = memDb();
    const w = tinyWorld(db);
    const p = w.product('rice', w.cats.rice.id, 5, 'kg', 'rice_5kg').id;
    const s = w.store('lulu', 'hypermarket', 29.3, 47.9).id;
    for (const d of [3, 6, 9, 12, 15]) obs(db, p, s, 5.0, daysAgo(d));
    obs(db, p, s, 4.5, daysAgo(0.1), { evidence: 'receipt', seedSource: null, confidence: 0.95 });
    obs(db, p, s, 4.5, daysAgo(0.2), { evidence: 'receipt', seedSource: null, confidence: 0.95 });
    const cp = getCurrentPrice(p, s, { now: NOW, db })!;
    expect(cp.priceKwd).toBe(4.5);
    expect(cp.observationCount).toBe(7);
    expect(cp.sourceMix.receipt).toBe(2);
    expect(cp.sourceMix.seedEstimate).toBe(5);
    expect(cp.trust).toBeGreaterThan(0.8);

    const seedOnly = getPriceMatrix([p], { now: NOW, db });
    expect(seedOnly.prices[p]![s]!.priceKwd).toBe(4.5);
    expect(getCurrentPrice(p, 999, { now: NOW, db })).toBeNull();
  });

  it('uses an active promo price while fresh and ignores stale promos', () => {
    const db = memDb();
    const w = tinyWorld(db);
    const p = w.product('oil', w.cats.rice.id, 1.8, 'L', null).id;
    const s = w.store('coop', 'coop', 29.3, 48).id;
    for (const d of [2, 4, 6, 8]) obs(db, p, s, 1.6, daysAgo(d));
    obs(db, p, s, 1.2, daysAgo(10), { isPromo: true });
    expect(getCurrentPrice(p, s, { now: NOW, db })!).toMatchObject({ priceKwd: 1.6, isPromo: false });
    obs(db, p, s, 1.3, daysAgo(0.5), { isPromo: true });
    expect(getCurrentPrice(p, s, { now: NOW, db })!).toMatchObject({ priceKwd: 1.3, isPromo: true });
  });
});
