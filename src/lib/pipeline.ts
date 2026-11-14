/**
 * Fully automatic scan pipeline — no human confirmation anywhere:
 *
 *   photo ─► LLM call 1 (extract lines) ─► alias cascade (exact / fuzzy, free)
 *         ─► LLM call 2 only for lines still unresolved (pick a candidate or propose a new product)
 *         ─► prices recorded (outliers quarantined) ─► alerts ─► unknown items collected
 *         ─► autoPromoteReady(): items seen ≥3× by ≥2 users become products, earlier prices backfilled
 *
 * Every confident AI decision is written back as an alias, so the share of lines that need the LLM
 * keeps falling as more receipts are scanned.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, type DB } from '../db/client.ts';
import { categories, pendingProducts, receiptLines, receipts, stores, users } from '../db/schema.ts';
import { autoPromoteReady, type AutoPromotion, type PendingProposal } from './catalog-growth.ts';
import { ingestReceipt, resolveLineWithLlm, type IngestedLine, type IngestReport } from './ingest.ts';
import type { LlmClient } from './llm-client.ts';
import type { LlmMatchChoice, ReceiptExtraction } from './llm-contract.ts';
import { matchLine } from './matching.ts';
import { normalizeAlias } from './normalize.ts';
import type { AlertResult } from './alerts.ts';

export interface ScanOptions {
  userId?: number | null;
  storeId?: number | null;
  /** null = no LLM configured: unresolved lines stay `needs_review` until retryNeedsReview() runs with one. */
  llm: LlmClient | null;
  now?: Date;
  db?: DB;
}

export interface ScanReport extends IngestReport {
  llm: string | null;
  /** LLM calls made for this receipt (call 1 not included when the extraction was passed in). */
  llmCalls: number;
  /** AI calls avoided because the AI had already decided on that unknown text recently. */
  llmSkipped: number;
  llmErrors: string[];
  autoPromoted: AutoPromotion[];
}

export class NoLlmConfiguredError extends Error {
  constructor() {
    super('No LLM API key configured (set OPENROUTER_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY)');
  }
}

function categoryMaps(db: DB) {
  const rows = db.select({ id: categories.id, slug: categories.slug, nameEn: categories.nameEn }).from(categories).all();
  return { list: rows.map((r) => ({ slug: r.slug, nameEn: r.nameEn })), idBySlug: new Map(rows.map((r) => [r.slug, r.id])) };
}

function proposalFrom(choice: LlmMatchChoice, idBySlug: Map<string, number>): PendingProposal {
  return {
    nameEn: choice.proposed_name_en,
    nameAr: choice.proposed_name_ar,
    brand: choice.proposed_brand,
    categoryId: choice.proposed_category ? (idBySlug.get(choice.proposed_category) ?? null) : null,
    sizeValue: choice.proposed_size_value,
    sizeUnit: choice.proposed_size_unit,
  };
}

/** How long an AI decision about an unknown text is reused before the AI is asked again. */
export const AI_DECISION_TTL_DAYS = 7;

/** True if the AI already decided on this (still unknown) text within the TTL — then we just count the sighting. */
export function hasRecentAiDecision(rawText: string, now: Date, db: DB): boolean {
  const row = db
    .select({ at: pendingProducts.aiDecidedAt })
    .from(pendingProducts)
    .where(and(eq(pendingProducts.aliasNormalized, normalizeAlias(rawText)), isNull(pendingProducts.promotedProductId)))
    .get();
  return !!row?.at && now.getTime() - row.at.getTime() < AI_DECISION_TTL_DAYS * 86_400_000;
}

function recount(report: IngestReport): void {
  report.counts = { alias_exact: 0, alias_fuzzy: 0, llm: 0, none: 0, needsLLM: 0 };
  for (const l of report.lines) {
    if (l.needsLLM) report.counts.needsLLM++;
    else report.counts[l.method]++;
  }
  report.status = report.lines.some((l) => l.status === 'needs_review') || report.storeId == null ? 'partial' : 'processed';
}

/** Resolve one needs_review line with the LLM. Returns the finished line (or null if the LLM failed). */
async function resolveWithLlm(
  line: { lineId: number; rawText: string; candidates?: IngestedLine['candidates'] },
  storeName: string | null,
  llm: LlmClient,
  cats: ReturnType<typeof categoryMaps>,
  db: DB,
  now: Date,
): Promise<(IngestedLine & { alerts?: AlertResult[] }) | { error: string }> {
  try {
    const candidates = line.candidates ?? (() => {
      const m = matchLine(line.rawText, { learn: false, db });
      return m.needsLLM ? m.candidates : [];
    })();
    const choice = await llm.choose({ rawText: line.rawText, candidates, storeName, categories: cats.list });
    return resolveLineWithLlm(line.lineId, choice.product_id, {
      confidence: choice.confidence,
      proposedNameEn: choice.proposed_name_en,
      proposedNameAr: choice.proposed_name_ar,
      proposal: proposalFrom(choice, cats.idBySlug),
      aiDecided: true,
      now,
      db,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Max AI calls in flight per receipt (keeps provider rate limits happy). */
export const LLM_CONCURRENCY = 6;

/** Promise.all with at most `limit` tasks running at once; results keep input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Process an already-extracted receipt (e.g. from api/extract or a fixture) end-to-end. */
export async function processExtraction(extraction: ReceiptExtraction, opts: ScanOptions): Promise<ScanReport> {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const base = ingestReceipt(extraction, { userId: opts.userId, storeId: opts.storeId, llmModel: opts.llm?.name ?? null, now, db });
  const report: ScanReport = { ...base, llm: opts.llm?.name ?? null, llmCalls: 0, llmSkipped: 0, llmErrors: [], autoPromoted: [] };

  {
    const cats = categoryMaps(db);
    const apply = (i: number, res: (IngestedLine & { alerts?: AlertResult[] }) | { error: string }) => {
      const line = report.lines[i]!;
      if ('error' in res) {
        report.llmErrors.push(`${line.rawText}: ${res.error}`);
        return;
      }
      const { alerts, ...finished } = res;
      report.lines[i] = finished;
      if (finished.aliasLearned) report.learnedAliases++;
      if (finished.observation?.status === 'quarantined') report.quarantined++;
      if (finished.pendingId != null && !report.pendingIds.includes(finished.pendingId)) report.pendingIds.push(finished.pendingId);
      if (alerts) report.alerts.push(...alerts);
    };

    // 1. Unknown text the AI already decided on recently: just count the sighting (no AI, works without an LLM).
    // 2. Everything else is grouped by normalised text so identical lines share one AI call.
    const groups = new Map<string, number[]>();
    for (let i = 0; i < report.lines.length; i++) {
      const line = report.lines[i]!;
      if (!line.needsLLM) continue;
      if (hasRecentAiDecision(line.rawText, now, db)) {
        apply(i, resolveLineWithLlm(line.lineId, null, { confidence: 0, aiDecided: false, now, db }));
        report.llmSkipped++;
        continue;
      }
      if (!opts.llm) continue; // stays needs_review until retryNeedsReview() runs with an LLM
      const key = normalizeAlias(line.rawText);
      const g = groups.get(key);
      if (g) g.push(i);
      else groups.set(key, [i]);
    }

    // 3. Ask the AI in parallel (bounded), one call per unique text — the slow part of a first scan.
    const llm = opts.llm;
    const entries = [...groups.values()];
    const choices = llm
      ? await mapLimit(entries, LLM_CONCURRENCY, async (idx) => {
          const line = report.lines[idx[0]!]!;
          try {
            return { choice: await llm.choose({ rawText: line.rawText, candidates: line.candidates ?? [], storeName: report.storeNameEn, categories: cats.list }) };
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
          }
        })
      : [];
    report.llmCalls += entries.length;

    // 4. Apply the decisions sequentially, in receipt order (all DB writes stay single-threaded).
    const decided = new Map<number, { choice?: LlmMatchChoice; error?: string; first: boolean }>();
    entries.forEach((idx, g) => idx.forEach((i, k) => decided.set(i, { ...choices[g]!, first: k === 0 })));
    for (const [i, d] of [...decided.entries()].sort((a, b) => a[0] - b[0])) {
      const line = report.lines[i]!;
      if (!d.choice) {
        apply(i, { error: d.error ?? 'AI call failed' });
        continue;
      }
      apply(
        i,
        resolveLineWithLlm(line.lineId, d.choice.product_id, {
          confidence: d.choice.confidence,
          proposedNameEn: d.choice.proposed_name_en,
          proposedNameAr: d.choice.proposed_name_ar,
          proposal: proposalFrom(d.choice, cats.idBySlug),
          aiDecided: d.first,
          now,
          db,
        }),
      );
    }
  }

  report.autoPromoted = autoPromoteReady({ now, db });
  recount(report);
  db.update(receipts).set({ status: report.status }).where(eq(receipts.id, report.receiptId)).run();
  return report;
}

/** Photo → full pipeline. Throws NoLlmConfiguredError when no LLM is available (extraction needs it). */
export async function processReceiptImage(imageDataUrl: string, opts: ScanOptions): Promise<ScanReport> {
  if (!opts.llm) throw new NoLlmConfiguredError();
  const extraction = await opts.llm.extract(imageDataUrl);
  const report = await processExtraction(extraction, opts);
  report.llmCalls++; // the extraction call
  return report;
}

/**
 * Finish lines left `needs_review` (LLM was down or not configured). Lines that now hit an alias learned
 * since they were scanned are resolved without the LLM. Then runs auto-promotion.
 */
export async function retryNeedsReview(opts: { llm: LlmClient | null; limit?: number; now?: Date; db?: DB }): Promise<{ resolved: number; viaAlias: number; llmCalls: number; llmSkipped: number; errors: string[]; autoPromoted: AutoPromotion[] }> {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const cats = categoryMaps(db);
  const pending = db
    .select({ line: receiptLines, receipt: receipts, storeName: stores.nameEn })
    .from(receiptLines)
    .innerJoin(receipts, eq(receipts.id, receiptLines.receiptId))
    .leftJoin(stores, eq(stores.id, receipts.storeId))
    .where(eq(receiptLines.status, 'needs_review'))
    .limit(opts.limit ?? 100)
    .all();
  let resolved = 0, viaAlias = 0, llmCalls = 0, llmSkipped = 0;
  const errors: string[] = [];
  for (const { line, receipt, storeName } of pending) {
    const m = matchLine(line.rawText, { storeId: receipt.storeId, now, db });
    if (!m.needsLLM) {
      resolveLineWithLlm(line.id, m.productId, { confidence: m.confidence, now, db });
      resolved++;
      viaAlias++;
      continue;
    }
    if (hasRecentAiDecision(line.rawText, now, db)) {
      resolveLineWithLlm(line.id, null, { confidence: 0, aiDecided: false, now, db });
      resolved++;
      llmSkipped++;
      continue;
    }
    if (!opts.llm) continue;
    llmCalls++;
    const res = await resolveWithLlm({ lineId: line.id, rawText: line.rawText, candidates: m.candidates }, storeName, opts.llm, cats, db, now);
    if ('error' in res) errors.push(`${line.rawText}: ${res.error}`);
    else resolved++;
  }
  return { resolved, viaAlias, llmCalls, llmSkipped, errors, autoPromoted: autoPromoteReady({ now, db }) };
}

/** Anonymous per-device user (no auth). Creates the user on first sight. */
export function getOrCreateUser(deviceId: string, opts: { displayName?: string; db?: DB } = {}): { id: number; created: boolean } {
  const db = opts.db ?? getDb();
  const clean = deviceId.trim().slice(0, 100);
  if (!clean) throw new Error('deviceId required');
  const existing = db.select({ id: users.id }).from(users).where(eq(users.deviceId, clean)).get();
  if (existing) return { id: existing.id, created: false };
  const row = db.insert(users).values({ deviceId: clean, displayName: opts.displayName?.slice(0, 60) || `Shopper ${clean.slice(0, 6)}` }).returning({ id: users.id }).get();
  return { id: row.id, created: true };
}
