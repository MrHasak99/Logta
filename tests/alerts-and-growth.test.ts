import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { alerts, productAliases, watchlist } from '../src/db/schema.ts';
import { checkAlerts } from '../src/lib/alerts.ts';
import { ingestUnmatched, promotePending } from '../src/lib/catalog-growth.ts';
import { matchLine } from '../src/lib/matching.ts';
import { recordObservation } from '../src/lib/prices.ts';
import { daysAgo, memDb, NOW, obs, tinyWorld } from './helpers.ts';

function setup() {
  const db = memDb();
  const w = tinyWorld(db);
  const p = w.product('rice', w.cats.rice.id, 5, 'kg', null).id;
  const s1 = w.store('coop', 'coop', 29.3, 48).id;
  const s2 = w.store('lulu', 'hypermarket', 29.3, 47.9).id;
  const u = w.user('watcher').id;
  const u2 = w.user('shopper').id;
  for (const d of [2, 6, 10, 14, 20]) { obs(db, p, s1, 4.8, daysAgo(d)); obs(db, p, s2, 4.9, daysAgo(d)); }
  db.insert(watchlist).values({ userId: u, productId: p, targetPriceKwd: 4.6, createdAt: daysAgo(30), active: true }).run();
  return { db, w, p, s1, s2, u, u2 };
}

describe('checkAlerts', () => {
  it('fires when an accepted observation drops below the target, with bilingual message and buy-now hint', () => {
    const { db, p, s1, u, u2 } = setup();
    const r = recordObservation({ productId: p, storeId: s1, priceKwd: 4.5, evidence: 'receipt', observedAt: NOW, userId: u2 }, db);
    const fired = checkAlerts(r.observation, { now: NOW, db });
    expect(fired).toHaveLength(1);
    expect(fired[0]!.userId).toBe(u);
    expect(fired[0]!.hint).toBe('buy_now'); // 4.5 is the new 30-day minimum
    expect(fired[0]!.stats).toEqual({ min: 4.5, avg: expect.any(Number), max: 4.9 });
    expect(fired[0]!.alert.messageEn).toContain('4.500 KWD');
    expect(fired[0]!.alert.messageEn).toContain('30-day range');
    expect(fired[0]!.alert.messageAr).toContain('د.ك');
    expect(db.select().from(alerts).all()).toHaveLength(1);
  });

  it('hints "lower price seen recently" when the 30-day min is > 3% lower', () => {
    const { db, p, s1, s2, u2 } = setup();
    obs(db, p, s2, 4.0, daysAgo(4), { isPromo: true });
    const r = recordObservation({ productId: p, storeId: s1, priceKwd: 4.55, evidence: 'receipt', observedAt: NOW, userId: u2 }, db);
    const fired = checkAlerts(r.observation, { now: NOW, db });
    expect(fired[0]!.hint).toBe('lower_seen_recently');
    expect(fired[0]!.alert.messageEn).toContain('A lower price was seen recently (4.000 KWD at lulu)');
  });

  it('does not fire above target, for quarantined observations, or for inactive watches', () => {
    const { db, p, s1, u2 } = setup();
    const above = recordObservation({ productId: p, storeId: s1, priceKwd: 4.7, evidence: 'receipt', observedAt: NOW, userId: u2 }, db);
    expect(checkAlerts(above.observation, { now: NOW, db })).toHaveLength(0);
    const outlier = recordObservation({ productId: p, storeId: s1, priceKwd: 0.48, evidence: 'receipt', observedAt: NOW, userId: u2 }, db);
    expect(outlier.status).toBe('quarantined');
    expect(checkAlerts(outlier.observation, { now: NOW, db })).toHaveLength(0);
    db.update(watchlist).set({ active: false }).run();
    const below = recordObservation({ productId: p, storeId: s1, priceKwd: 4.4, evidence: 'receipt', observedAt: NOW, userId: u2 }, db);
    expect(checkAlerts(below.observation, { now: NOW, db })).toHaveLength(0);
  });
});

describe('catalogue growth', () => {
  it('collects unknown items and promotes them after ≥3 sightings by ≥2 users', () => {
    const { db, w, s1, s2, u, u2 } = setup();
    const text = 'ZAATAR MANAKEESH 4PC';
    expect(ingestUnmatched(text, u, s1, { db }).readyForPromotion).toBe(false);
    expect(ingestUnmatched(text, u, s2, { db }).readyForPromotion).toBe(false); // 2 sightings, 1 user
    const third = ingestUnmatched('zaatar manakeesh 4 pc', u2, s1, { db }); // same text after normalisation
    expect(third.pending).toMatchObject({ seenCount: 3, distinctUsers: 2, distinctStores: 2 });
    expect(third.readyForPromotion).toBe(true);

    expect(matchLine(text, { learn: false, db }).needsLLM).toBe(true);
    const product = promotePending(third.pending.id, { nameEn: 'Zaatar Manakeesh 4 pcs', nameAr: 'مناقيش زعتر ٤ حبات', categoryId: w.cats.dairy.id, sizeValue: 4, sizeUnit: 'pcs' }, { db });
    expect(product.createdFrom).toBe('receipt');
    // EN name, AR name and the raw receipt text (the EN name here normalises like the receipt text, so 2 distinct)
    expect(db.select().from(productAliases).where(eq(productAliases.productId, product.id)).all().length).toBeGreaterThanOrEqual(2);
    const m = matchLine(text, { learn: false, db });
    expect(m.method).toBe('alias_exact');
    expect(m.productId).toBe(product.id);
    expect(() => promotePending(third.pending.id, { nameEn: 'x', nameAr: 'x', categoryId: w.cats.dairy.id, sizeValue: 1, sizeUnit: 'pcs' }, { db })).toThrow(/already promoted/);
  });

  it('refuses to promote too early unless forced', () => {
    const { db, w, s1, u } = setup();
    const r = ingestUnmatched('MYSTERY ITEM', u, s1, { db });
    expect(() => promotePending(r.pending.id, { nameEn: 'Mystery', nameAr: 'غامض', categoryId: w.cats.dairy.id, sizeValue: 1, sizeUnit: 'pcs' }, { db })).toThrow(/not ready/);
    expect(promotePending(r.pending.id, { nameEn: 'Mystery', nameAr: 'غامض', categoryId: w.cats.dairy.id, sizeValue: 1, sizeUnit: 'pcs' }, { db, force: true }).id).toBeGreaterThan(0);
  });
});
