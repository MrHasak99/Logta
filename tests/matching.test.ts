import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../src/db/client.ts';
import { productAliases, products, stores } from '../src/db/schema.ts';
import { seedDatabase } from '../src/db/seed.ts';
import { matchLine } from '../src/lib/matching.ts';
import { memDb, NOW } from './helpers.ts';

let db: DB;
const pid = (slug: string) => db.select().from(products).where(eq(products.slug, slug)).get()!.id;
const sid = (slug: string) => db.select().from(stores).where(eq(stores.slug, slug)).get()!.id;

beforeAll(() => {
  db = memDb();
  seedDatabase(db, { now: NOW, webSnapshotPath: '__none__.json' });
});

describe('seed catalogue', () => {
  it('has 3–6+ aliases for every product', () => {
    const rows = db.$client.prepare('SELECT product_id, COUNT(*) n FROM product_aliases GROUP BY product_id').all() as { n: number }[];
    expect(rows.length).toBeGreaterThanOrEqual(140);
    expect(Math.min(...rows.map((r) => r.n))).toBeGreaterThanOrEqual(3);
  });
});

describe('matchLine cascade', () => {
  it('1. exact alias match on receipt shorthand, Arabic and mixed text', () => {
    for (const [text, slug] of [
      ['ALM FF MLK 1L', 'almarai-milk-ff-1l'],
      ['KDD F/F MILK 1LTR', 'kdd-milk-ff-1l'],
      ['TILDA BSMTI 5KG', 'tilda-basmati-5kg'],
      ['حليب المراعي كامل ١ لتر', 'almarai-milk-ff-1l'],
      ['حليب KDD كامل 1 لتر', 'kdd-milk-ff-1l'],
      ['عيش تيلدا', 'tilda-basmati-5kg'],
    ] as const) {
      const r = matchLine(text, { learn: false, db });
      expect(r.needsLLM, text).toBe(false);
      expect(r.method).toBe('alias_exact');
      expect(r.productId).toBe(pid(slug));
      expect(r.confidence).toBe(1);
    }
  });

  it('prefers a store-specific alias when the store is known', () => {
    const r = matchLine('حليب ك.د.د كامل 1ل', { storeId: sid('coop-mishref'), learn: false, db });
    expect(!r.needsLLM && r.productId).toBe(pid('kdd-milk-ff-1l'));
    expect(r.confidence).toBe(1);
    // the same shorthand seen at another store still matches, with slightly lower confidence
    const other = matchLine('حليب ك.د.د كامل 1ل', { storeId: sid('lulu-alrai'), learn: false, db });
    expect(other.confidence).toBe(0.95);
  });

  it('2. fuzzy match with size agreement, then learns the alias so the next hit is exact', () => {
    const text = 'ALMARAI LABN FULLFAT 1LTR';
    const r1 = matchLine(text, { storeId: sid('coop-salwa'), db });
    expect(r1.needsLLM).toBe(false);
    if (r1.needsLLM) return;
    expect(r1.method).toBe('alias_fuzzy');
    expect(r1.productId).toBe(pid('almarai-laban-1l'));
    expect(r1.confidence).toBeGreaterThanOrEqual(0.85);
    expect(r1.aliasLearned).toBe(true);
    const learned = db.select().from(productAliases).where(and(eq(productAliases.kind, 'learned'), eq(productAliases.productId, pid('almarai-laban-1l')))).all();
    expect(learned).toHaveLength(1);
    const r2 = matchLine(text, { storeId: sid('coop-salwa'), db });
    expect(r2.method).toBe('alias_exact');
  });

  it('refuses a fuzzy match when the size disagrees → hands over to the LLM', () => {
    const r = matchLine('KDD MILK FULL FAT 2L', { learn: false, db });
    expect(r.needsLLM).toBe(true);
  });

  it('3. unresolved lines return top-10 candidates for the LLM', () => {
    const r = matchLine('H/S SHMP CLSC CLN 400', { learn: false, db });
    expect(r.needsLLM).toBe(true);
    if (!r.needsLLM) return;
    expect(r.candidates.length).toBeLessThanOrEqual(10);
    expect(r.candidates[0]!.slug).toBe('headshoulders-shampoo-400ml');
    const unknown = matchLine('ZAATAR MANAKEESH 4PC', { learn: false, db });
    expect(unknown.needsLLM).toBe(true);
    expect(unknown.confidence).toBeLessThan(0.6);
  });
});
