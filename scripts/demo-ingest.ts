/**
 * `npm run demo:ingest` — push the 4 fixture receipts through the FULLY AUTOMATIC pipeline
 * (src/lib/pipeline.ts): alias cascade → AI for leftovers → prices → alerts → unknown items →
 * automatic catalogue growth. No human confirmation anywhere.
 * Run `npm run db:reset` first for a clean, reproducible demo (or `npm run demo:fresh`).
 *
 * NOTE: no real LLM is called here. MOCK_LLM below plays the part of "call 2" (see llm-contract.ts)
 * with fixed answers, so the demo runs offline and is reproducible. The real server uses
 * createLlmClientFromEnv() with the same interface.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { createDb, setDb } from '../src/db/client.ts';
import { productAliases, products, shoppingLists, users } from '../src/db/schema.ts';
import { listPending } from '../src/lib/catalog-growth.ts';
import type { LlmClient } from '../src/lib/llm-client.ts';
import { parseReceiptExtraction, type LlmMatchChoice } from '../src/lib/llm-contract.ts';
import { matchLine } from '../src/lib/matching.ts';
import { optimizeBasket } from '../src/lib/optimizer.ts';
import { processExtraction, type ScanReport } from '../src/lib/pipeline.ts';

const db = createDb();
setDb(db);

// ---- simulated LLM "call 2" answers ----
const NONE = { proposed_name_en: null, proposed_name_ar: null, proposed_brand: null, proposed_category: null, proposed_size_value: null, proposed_size_unit: null } as const;
const MOCK_LLM: Record<string, (ids: (slug: string) => number | null) => LlmMatchChoice> = {
  'H/S SHMP CLSC CLN 400': (id) => ({ product_id: id('headshoulders-shampoo-400ml'), confidence: 0.92, ...NONE }),
  'ZAATAR MANAKEESH 4PC': () => ({
    product_id: null, confidence: 0,
    proposed_name_en: 'Zaatar Manakeesh 4 pcs', proposed_name_ar: 'مناقيش زعتر ٤ حبات', proposed_brand: null,
    proposed_category: 'bakery', proposed_size_value: 4, proposed_size_unit: 'pcs',
  }),
};
let llmCalls = 0;
const slugId = (slug: string) => db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).get()?.id ?? null;
const mockLlm: LlmClient = {
  name: 'mock-llm (demo)',
  extract: async () => { throw new Error('demo uses pre-extracted fixtures'); },
  choose: async ({ rawText, candidates }) => {
    llmCalls++;
    const answer = MOCK_LLM[rawText]?.(slugId) ?? { product_id: null, confidence: 0, ...NONE };
    // the real LLM may only pick among the candidates it was given
    if (answer.product_id != null && !candidates.some((c) => c.productId === answer.product_id)) return { ...answer, product_id: null, confidence: 0 };
    return answer;
  },
};

// fixture → uploader (user index) — 3 different demo users
const UPLOADER: Record<string, number> = { '01': 0, '02': 1, '03': 2, '04': 0 };

const dir = resolve(process.cwd(), 'fixtures', 'receipts');
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const userRows = db.select().from(users).orderBy(users.id).all();
if (userRows.length < 3) {
  console.error('Seed data missing — run `npm run db:reset` first.');
  process.exit(1);
}
const count = (q: string) => (db.$client.prepare(q).get() as { n: number }).n;
const aliasCountBefore = count('SELECT COUNT(*) n FROM product_aliases');
const productCountBefore = count('SELECT COUNT(*) n FROM products');

const now = new Date();
const reports: { file: string; r: ScanReport }[] = [];
for (const [i, file] of files.entries()) {
  const extraction = parseReceiptExtraction(readFileSync(join(dir, file), 'utf8'));
  // keep the demo fresh whatever day it runs: receipts are "taken" over the last few hours
  extraction.purchased_at = new Date(now.getTime() - (files.length - i) * 3_600_000).toISOString();
  const user = userRows[UPLOADER[file.slice(0, 2)] ?? 0]!;
  reports.push({ file, r: await processExtraction(extraction, { userId: user.id, llm: mockLlm, now, db }) });
}

// ---------------------------------------------------------------- report
const methodIcon: Record<string, string> = { alias_exact: '🎯 exact', alias_fuzzy: '〰️ fuzzy', llm: '🤖 llm', none: '❓ none' };
console.log('\n══════════ Logta demo: 4 receipts through the automatic pipeline ══════════');
for (const { file, r } of reports) {
  console.log(`\n📄 ${file}  →  store: ${r.storeNameEn ?? '(unresolved)'}  ·  status: ${r.status}  ·  AI calls: ${r.llmCalls}`);
  for (const l of r.lines) {
    const obs = l.observation ? `${l.observation.status}${l.observation.status === 'quarantined' ? ` (median ${l.observation.referenceMedian})` : ''}` : l.pendingId ? `→ unknown item #${l.pendingId}` : '';
    console.log(
      `   ${(methodIcon[l.method] ?? l.method).padEnd(9)} ${l.confidence.toFixed(2)}  ${l.rawText.padEnd(30)} ${String(l.unitPriceKwd?.toFixed(3) ?? '').padStart(6)}  ${(l.productNameEn ?? '').padEnd(42)} ${obs}${l.aliasLearned ? '  ✨ alias learned' : ''}`,
    );
  }
  for (const a of r.alerts) console.log(`   🔔 ALERT (user #${a.userId}): ${a.alert.messageEn}\n      ${a.alert.messageAr}`);
  for (const p of r.autoPromoted) {
    console.log(`   🌱 AUTO-${p.action === 'created' ? 'CREATED' : 'MERGED'} product #${p.productId} "${p.productNameEn}" from "${p.rawText}" · backfilled ${p.backfilledObservations} earlier price(s) from ${p.backfilledLines} receipt line(s) — no human involved`);
  }
}

const totals = { alias_exact: 0, alias_fuzzy: 0, llm: 0, none: 0 };
let learned = 0, quarantined = 0, alertsFired = 0, promoted = 0;
for (const { r } of reports) {
  for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += r.counts[k];
  learned += r.learnedAliases;
  quarantined += r.quarantined;
  alertsFired += r.alerts.length;
  promoted += r.autoPromoted.length;
}
const lineCount = reports.reduce((a, x) => a + x.r.lines.length, 0);

console.log('\n────────── Summary ──────────');
console.table({
  'lines processed': lineCount,
  'matched by exact alias': totals.alias_exact,
  'matched by fuzzy alias': totals.alias_fuzzy,
  'matched by AI (mock)': totals.llm,
  'unknown → collected': totals.none,
  'AI calls needed': llmCalls,
  'learned aliases added': learned,
  'quarantined prices': quarantined,
  'alerts fired': alertsFired,
  'products auto-created': promoted,
});
console.log(`Aliases: ${aliasCountBefore} → ${count('SELECT COUNT(*) n FROM product_aliases')} · Products: ${productCountBefore} → ${count('SELECT COUNT(*) n FROM products')}`);
console.log('“The more photos people take, the less AI we need”: receipt 4 repeats lines that needed fuzzy/AI in receipts 2–3 and now hits them as exact aliases.');

const zaatar = matchLine('ZAATAR MANAKEESH 4PC', { learn: false, db });
console.log(`Next scan of "ZAATAR MANAKEESH 4PC" → ${zaatar.method} (no AI needed). “The catalogue grows itself.”`);
const stillPending = listPending({ db });
if (stillPending.length) console.log(`Still collecting: ${stillPending.map((p) => `"${p.exampleRawText}" (${p.seenCount}×)`).join(', ')}`);

// ---------------------------------------------------------------- optimiser teaser
const list = db.select().from(shoppingLists).orderBy(shoppingLists.id).get();
if (list) {
  const plans = optimizeBasket(list.id, null, { db });
  console.log(`\n────────── Basket optimiser: "${list.name}" ──────────`);
  plans.forEach((p, i) =>
    console.log(`   ${i + 1}. ${p.stores.map((s) => s.nameEn).join(' + ').padEnd(48)} items ${p.subtotal.toFixed(3)} + travel ${p.travelCost.toFixed(3)} (${p.travelKm} km) = ${p.total.toFixed(3)} KWD · saves ${p.savingsVsBestSingleStore.toFixed(3)} vs best single store · trust ${p.avgTrust}${p.missingItems.length ? ` · missing ${p.missingItems.length}` : ''}${p.substitutions.length ? ` · ${p.substitutions.length} substitution(s)` : ''}`),
  );
}
const learnedRows = db.select({ n: sql<number>`count(*)` }).from(productAliases).where(eq(productAliases.kind, 'learned')).get();
console.log(`\nLearned aliases total in DB: ${learnedRows?.n ?? 0}\n`);
db.$client.close();
