import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DB } from '../src/db/client.ts';
import { pendingProducts, priceObservations, productAliases, products, receiptLines, stores, users } from '../src/db/schema.ts';
import { seedDatabase } from '../src/db/seed.ts';
import type { LlmClient } from '../src/lib/llm-client.ts';
import type { LlmMatchChoice, ReceiptExtraction } from '../src/lib/llm-contract.ts';
import { matchLine } from '../src/lib/matching.ts';
import { getOrCreateUser, NoLlmConfiguredError, processExtraction, processReceiptImage, retryNeedsReview } from '../src/lib/pipeline.ts';
import { memDb, NOW } from './helpers.ts';

const NONE = { proposed_name_en: null, proposed_name_ar: null, proposed_brand: null, proposed_category: null, proposed_size_value: null, proposed_size_unit: null } as const;

/** Fake LLM: answers from a table keyed by raw text; records calls. */
function fakeLlm(answers: Record<string, Partial<LlmMatchChoice> | Error>): LlmClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    name: 'fake',
    calls,
    extract: async () => receipt('FAKE STORE', [['X', 1]]),
    choose: async ({ rawText }) => {
      calls.push(rawText);
      const a = answers[rawText];
      if (a instanceof Error) throw a;
      return { product_id: null, confidence: 0, ...NONE, ...a };
    },
  };
}

function receipt(store: string, lines: [string, number][]): ReceiptExtraction {
  return { store_text: store, purchased_at: new Date(NOW.getTime() - 3_600_000).toISOString(), total_kwd: null, lines: lines.map(([raw_text, p]) => ({ raw_text, qty: 1, unit_price_kwd: p, line_total_kwd: p })) };
}

let db: DB;
let u: number[];
const pid = (slug: string) => db.select().from(products).where(eq(products.slug, slug)).get()!.id;
const sid = (slug: string) => db.select().from(stores).where(eq(stores.slug, slug)).get()!.id;

beforeEach(() => {
  db = memDb();
  seedDatabase(db, { now: NOW, webSnapshotPath: '__none__.json' });
  u = db.select().from(users).orderBy(users.id).all().map((x) => x.id);
});

const ZAATAR = { proposed_name_en: 'Zaatar Manakeesh 4 pcs', proposed_name_ar: 'مناقيش زعتر ٤ حبات', proposed_category: 'bakery', proposed_size_value: 4, proposed_size_unit: 'pcs' as const };

describe('automatic pipeline (no human confirmation)', () => {
  it('grows the catalogue by itself: 3 sightings by 2 users → product created, earlier prices backfilled', async () => {
    const llm = fakeLlm({ 'ZAATAR MANAKEESH 4PC': ZAATAR });
    const r1 = await processExtraction(receipt('MISHREF CO-OP', [['ZAATAR MANAKEESH 4PC', 0.6], ['TILDA BSMTI 5KG', 4.75]]), { userId: u[0], llm, now: NOW, db });
    expect(r1.status).toBe('processed');
    expect(r1.lines[0]).toMatchObject({ status: 'unmatched', needsLLM: false });
    expect(r1.autoPromoted).toHaveLength(0);
    await processExtraction(receipt('LULU HYPERMARKET', [['ZAATAR MANAKEESH 4PC', 0.65]]), { userId: u[0], llm, now: NOW, db });
    const r3 = await processExtraction(receipt('CARREFOUR AVENUES', [['ZAATAR MANAKEESH 4PC', 0.6]]), { userId: u[1], llm, now: NOW, db });

    expect(r3.autoPromoted).toHaveLength(1);
    const promo = r3.autoPromoted[0]!;
    expect(promo).toMatchObject({ action: 'created', productNameEn: 'Zaatar Manakeesh 4 pcs', backfilledLines: 3, backfilledObservations: 3 });
    const product = db.select().from(products).where(eq(products.id, promo.productId)).get()!;
    expect(product).toMatchObject({ createdFrom: 'receipt', sizeValue: 4, sizeUnit: 'pcs', status: 'active' });
    expect(db.select().from(priceObservations).where(eq(priceObservations.productId, product.id)).all()).toHaveLength(3);
    expect(db.select().from(receiptLines).where(eq(receiptLines.status, 'unmatched')).all()).toHaveLength(0);

    // the next sighting is a free exact match — no AI call
    llm.calls.length = 0;
    const r4 = await processExtraction(receipt('SALWA CO-OP', [['ZAATAR MANAKEESH 4PC', 0.55]]), { userId: u[2], llm, now: NOW, db });
    expect(r4.lines[0]).toMatchObject({ method: 'alias_exact', productId: product.id, status: 'matched' });
    expect(llm.calls).toHaveLength(0);
  });

  it('merges instead of duplicating when the AI proposes a product that already exists', async () => {
    const existing = pid('almarai-milk-ff-1l');
    const llm = fakeLlm({ 'MLKALM FRESH FF ONE': { proposed_name_en: 'Almarai Fresh Milk Full Fat 1L', proposed_name_ar: 'حليب المراعي طازج كامل الدسم ١ لتر', proposed_category: 'dairy_eggs', proposed_size_value: 1, proposed_size_unit: 'L' } });
    const before = db.select().from(products).all().length;
    for (const [user, store] of [[u[0], 'MISHREF CO-OP'], [u[1], 'SALWA CO-OP'], [u[2], 'LULU']] as const) {
      await processExtraction(receipt(store, [['MLKALM FRESH FF ONE', 0.41]]), { userId: user, llm, now: NOW, db });
    }
    expect(db.select().from(products).all().length).toBe(before);
    const p = db.select().from(pendingProducts).get()!;
    expect(p.promotedProductId).toBe(existing);
    const m = matchLine('MLKALM FRESH FF ONE', { learn: false, db });
    expect(m.productId).toBe(existing);
  });

  it('never promotes lines the AI says are not products (deposits, bag fees…)', async () => {
    const llm = fakeLlm({ 'BAG CHARGE': {} });
    for (const user of [u[0], u[1], u[2]]) await processExtraction(receipt('LULU', [['BAG CHARGE', 0.025]]), { userId: user, llm, now: NOW, db });
    const p = db.select().from(pendingProducts).get()!;
    expect(p.seenCount).toBe(3);
    expect(p.promotedProductId).toBeNull();
  });

  it('AI picks are applied and learned automatically', async () => {
    const shampoo = pid('headshoulders-shampoo-400ml');
    const llm = fakeLlm({ 'H/S SHMP CLSC CLN 400': { product_id: shampoo, confidence: 0.92 } });
    const r = await processExtraction(receipt('LULU HYPERMARKET', [['H/S SHMP CLSC CLN 400', 1.85]]), { userId: u[0], llm, now: NOW, db });
    expect(r.lines[0]).toMatchObject({ method: 'llm', productId: shampoo, status: 'matched', aliasLearned: true });
    expect(r.lines[0]!.observation?.status).toBe('accepted');
    expect(r.learnedAliases).toBe(1);
    expect(db.select().from(productAliases).where(eq(productAliases.source, 'ai_match')).all().length).toBeGreaterThanOrEqual(1);
  });

  it('keeps lines for retry when the AI fails, and retry finishes them automatically', async () => {
    const shampoo = pid('headshoulders-shampoo-400ml');
    const down = fakeLlm({ 'H/S SHMP CLSC CLN 400': new Error('provider timeout') });
    const r = await processExtraction(receipt('LULU HYPERMARKET', [['H/S SHMP CLSC CLN 400', 1.85]]), { userId: u[0], llm: down, now: NOW, db });
    expect(r.status).toBe('partial');
    expect(r.lines[0]!.status).toBe('needs_review');
    expect(r.llmErrors[0]).toContain('provider timeout');

    const up = fakeLlm({ 'H/S SHMP CLSC CLN 400': { product_id: shampoo, confidence: 0.92 } });
    const res = await retryNeedsReview({ llm: up, now: NOW, db });
    expect(res).toMatchObject({ resolved: 1, viaAlias: 0, llmCalls: 1 });
    expect(db.select().from(receiptLines).where(eq(receiptLines.status, 'needs_review')).all()).toHaveLength(0);
  });

  it('retry resolves via aliases learned in the meantime, without calling the AI', async () => {
    const shampoo = pid('headshoulders-shampoo-400ml');
    await processExtraction(receipt('LULU HYPERMARKET', [['H/S SHMP CLSC CLN 400', 1.85]]), { userId: u[0], llm: null, now: NOW, db });
    // another receipt teaches the alias
    await processExtraction(receipt('LULU HYPERMARKET', [['H/S SHMP CLSC CLN 400', 1.85]]), { userId: u[1], llm: fakeLlm({ 'H/S SHMP CLSC CLN 400': { product_id: shampoo, confidence: 0.95 } }), now: NOW, db });
    const noAi = fakeLlm({});
    const res = await retryNeedsReview({ llm: noAi, now: NOW, db });
    expect(res).toMatchObject({ resolved: 1, viaAlias: 1, llmCalls: 0 });
    expect(noAi.calls).toHaveLength(0);
  });

  it('photo scanning requires an LLM; extraction-only input works without one', async () => {
    await expect(processReceiptImage('data:image/png;base64,AAAA', { llm: null, db })).rejects.toBeInstanceOf(NoLlmConfiguredError);
    const r = await processExtraction(receipt('MISHREF CO-OP', [['TILDA BSMTI 5KG', 4.75], ['H/S SHMP CLSC CLN 400', 1.8]]), { userId: u[0], llm: null, now: NOW, db });
    expect(r.counts).toMatchObject({ alias_exact: 1, needsLLM: 1 });
    expect(r.storeId).toBe(sid('coop-mishref'));
  });
});

describe('getOrCreateUser', () => {
  it('creates one anonymous user per device id', () => {
    const a = getOrCreateUser('device-abc', { db });
    const b = getOrCreateUser('device-abc', { db });
    const c = getOrCreateUser('device-xyz', { db });
    expect(a.created).toBe(true);
    expect(b).toEqual({ id: a.id, created: false });
    expect(c.id).not.toBe(a.id);
    expect(() => getOrCreateUser('   ', { db })).toThrow();
  });
});
