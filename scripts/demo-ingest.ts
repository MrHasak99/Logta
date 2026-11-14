/**
 * `npm run demo:ingest` — push the 4 fixture receipts through the full pipeline:
 *   matchLine → (mock LLM for unresolved lines) → recordObservation → checkAlerts → ingestUnmatched
 * and print a short report. Run `npm run db:reset` first for a clean, reproducible demo
 * (or `npm run demo:fresh` which does both).
 *
 * NOTE: no real LLM is called. Lines the alias cascade can't resolve go to MOCK_LLM below, which
 * simulates the answer the real "call 2" (see src/lib/llm-contract.ts) would give.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { createDb, setDb } from '../src/db/client.ts';
import { categories, productAliases, products, shoppingLists, users } from '../src/db/schema.ts';
import { ingestReceipt, type IngestReport, type LlmResolver } from '../src/lib/ingest.ts';
import { parseReceiptExtraction } from '../src/lib/llm-contract.ts';
import { listPending, promotePending } from '../src/lib/catalog-growth.ts';
import { matchLine } from '../src/lib/matching.ts';
import { optimizeBasket } from '../src/lib/optimizer.ts';

const db = createDb();
setDb(db);

// ---- simulated LLM "call 2" decisions (product slug or null = not in catalogue) ----
const MOCK_LLM: Record<string, { slug: string | null; confidence: number; nameEn?: string; nameAr?: string }> = {
  'H/S SHMP CLSC CLN 400': { slug: 'headshoulders-shampoo-400ml', confidence: 0.92 },
  'ZAATAR MANAKEESH 4PC': { slug: null, confidence: 0, nameEn: 'Zaatar Manakeesh 4 pcs', nameAr: 'مناقيش زعتر ٤ حبات' },
};
let llmCalls = 0;
const mockLlm: LlmResolver = (rawText, candidates) => {
  llmCalls++;
  const d = MOCK_LLM[rawText];
  if (!d || !d.slug) return { productId: null, confidence: 0, proposedNameEn: d?.nameEn ?? null, proposedNameAr: d?.nameAr ?? null };
  const id = db.select({ id: products.id }).from(products).where(eq(products.slug, d.slug)).get()?.id ?? null;
  // the real LLM may only choose among the candidates it was given
  const offered = candidates.some((c) => c.productId === id);
  return { productId: offered ? id : null, confidence: d.confidence };
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
const aliasCountBefore = (db.$client.prepare('SELECT COUNT(*) n FROM product_aliases').get() as { n: number }).n;

const now = new Date();
const reports: { file: string; r: IngestReport }[] = [];
files.forEach((file, i) => {
  const extraction = parseReceiptExtraction(readFileSync(join(dir, file), 'utf8'));
  // keep the demo fresh whatever day it runs: receipts are "taken" over the last few hours
  extraction.purchased_at = new Date(now.getTime() - (files.length - i) * 3_600_000).toISOString();
  const user = userRows[UPLOADER[file.slice(0, 2)] ?? 0]!;
  const r = ingestReceipt(extraction, { userId: user.id, llmModel: 'mock-llm (demo)', llmResolver: mockLlm, now });
  reports.push({ file, r });
});

// ---------------------------------------------------------------- report
const methodIcon: Record<string, string> = { alias_exact: '🎯 exact', alias_fuzzy: '〰️ fuzzy', llm: '🤖 llm', none: '❓ none' };
console.log('\n══════════ Logta demo: ingesting 4 fixture receipts ══════════');
for (const { file, r } of reports) {
  console.log(`\n📄 ${file}  →  store: ${r.storeNameEn ?? '(unresolved)'}  ·  status: ${r.status}`);
  for (const l of r.lines) {
    const obs = l.observation ? `${l.observation.status}${l.observation.status === 'quarantined' ? ` (median ${l.observation.referenceMedian})` : ''}` : l.pendingId ? `→ pending #${l.pendingId}` : '';
    console.log(
      `   ${(methodIcon[l.method] ?? l.method).padEnd(9)} ${l.confidence.toFixed(2)}  ${l.rawText.padEnd(30)} ${String(l.unitPriceKwd?.toFixed(3) ?? '').padStart(6)}  ${(l.productNameEn ?? '').padEnd(42)} ${obs}${l.aliasLearned ? '  ✨ alias learned' : ''}`,
    );
  }
  for (const a of r.alerts) console.log(`   🔔 ALERT (user #${a.userId}): ${a.alert.messageEn}\n      ${a.alert.messageAr}`);
}

const totals = { alias_exact: 0, alias_fuzzy: 0, llm: 0, none: 0 };
let learned = 0, quarantined = 0, alertsFired = 0;
for (const { r } of reports) {
  for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += r.counts[k];
  learned += r.learnedAliases;
  quarantined += r.quarantined;
  alertsFired += r.alerts.length;
}
const lineCount = reports.reduce((a, x) => a + x.r.lines.length, 0);
const aliasCountAfter = (db.$client.prepare('SELECT COUNT(*) n FROM product_aliases').get() as { n: number }).n;

console.log('\n────────── Summary ──────────');
console.table({
  'lines processed': lineCount,
  'matched by exact alias': totals.alias_exact,
  'matched by fuzzy alias': totals.alias_fuzzy,
  'matched by LLM (mock)': totals.llm,
  'unmatched → pending': totals.none,
  'LLM calls needed': llmCalls,
  'learned aliases added': learned,
  'quarantined prices': quarantined,
  'alerts fired': alertsFired,
});
console.log(`Aliases in DB: ${aliasCountBefore} → ${aliasCountAfter}`);
console.log('“The more photos people take, the less AI we need”: receipt 4 repeats lines that needed fuzzy/LLM in receipts 2–3 and now hits them as exact aliases.');

// ---------------------------------------------------------------- catalogue growth
const pending = listPending({ db });
console.log('\n────────── Pending products ──────────');
for (const p of pending) console.log(`   #${p.id} "${p.exampleRawText}"  seen ${p.seenCount}× by ${p.distinctUsers} users at ${p.distinctStores} stores  ${p.readyForPromotion ? '✅ ready for promotion' : '⏳ collecting'}  (proposed: ${p.proposedNameEn ?? '-'} / ${p.proposedNameAr ?? '-'})`);
const ready = pending.find((p) => p.readyForPromotion);
if (ready) {
  const bakery = db.select().from(categories).where(eq(categories.slug, 'bakery')).get()!;
  const product = promotePending(ready.id, { nameEn: ready.proposedNameEn ?? ready.exampleRawText, nameAr: ready.proposedNameAr ?? ready.exampleRawText, categoryId: bakery.id, sizeValue: 4, sizeUnit: 'pcs', extraAliases: ['مناقيش زعتر'] }, { db });
  const again = matchLine(ready.exampleRawText, { learn: false, db });
  console.log(`   🌱 Promoted → product #${product.id} "${product.nameEn}" / "${product.nameAr}". Re-matching "${ready.exampleRawText}": ${again.method}. “The catalogue grows itself.”`);
}

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
