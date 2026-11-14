/**
 * Receipt pipeline (Feature 1): LLM extraction JSON → store resolution → matchLine → recordObservation
 * → checkAlerts, with unknown items routed to pending_products. This is the one function the API
 * route needs after the extraction call.
 */
import { eq } from 'drizzle-orm';
import { getDb, type DB } from '../db/client.ts';
import { products, receiptLines, receipts, stores, type Evidence, type MatchMethod } from '../db/schema.ts';
import { STORES } from '../db/seed-data.ts';
import { checkAlerts, type AlertResult } from './alerts.ts';
import { ingestUnmatched, type PendingProposal } from './catalog-growth.ts';
import type { ReceiptExtraction } from './llm-contract.ts';
import { confirmMatch, LEARN_THRESHOLD, matchLine, type MatchCandidate } from './matching.ts';
import { normalizeAlias } from './normalize.ts';
import { recordObservation, type RecordObservationResult } from './prices.ts';
import { priceObservations } from '../db/schema.ts';

/** Resolve a receipt header like "MISHREF CO-OP" / "جمعية مشرف التعاونية" to a store. */
export function resolveStore(storeText: string | null | undefined, db: DB = getDb()): { storeId: number; nameEn: string } | null {
  if (!storeText) return null;
  const norm = ` ${normalizeAlias(storeText)} `;
  const all = db.select().from(stores).all();
  for (const st of all) {
    const seed = STORES.find((s) => s.slug === st.slug);
    const keys = [...(seed?.receiptKeywords ?? []), st.areaEn ?? '', st.areaAr ?? '', st.nameEn].map((k) => normalizeAlias(k)).filter((k) => k.length >= 3);
    if (keys.some((k) => norm.includes(` ${k} `) || norm.includes(k))) return { storeId: st.id, nameEn: st.nameEn };
  }
  return null;
}

export interface IngestedLine {
  lineId: number;
  rawText: string;
  qty: number;
  unitPriceKwd: number | null;
  status: 'matched' | 'needs_review' | 'unmatched';
  method: MatchMethod;
  confidence: number;
  productId: number | null;
  productNameEn: string | null;
  aliasLearned: boolean;
  observation: { id: number; status: RecordObservationResult['status']; reason: RecordObservationResult['reason']; referenceMedian: number | null } | null;
  /** Present when the line still needs the LLM (call 2 of the contract). */
  needsLLM: boolean;
  candidates?: MatchCandidate[];
  pendingId?: number;
}

export interface IngestReport {
  receiptId: number;
  storeId: number | null;
  storeNameEn: string | null;
  status: 'processed' | 'partial' | 'failed';
  lines: IngestedLine[];
  counts: Record<MatchMethod, number> & { needsLLM: number };
  learnedAliases: number;
  quarantined: number;
  promotedObservations: number;
  alerts: AlertResult[];
  pendingIds: number[];
}

/** Optional synchronous LLM stand-in (used by demo:ingest and tests). The real API resolves later via resolveLineWithLlm. */
export type LlmResolver = (rawText: string, candidates: MatchCandidate[]) => LlmDecision;

/** What the LLM (call 2) decided for one line. `proposal` is used when productId is null (unknown item). */
export interface LlmDecision {
  productId: number | null;
  confidence: number;
  proposedNameEn?: string | null;
  proposedNameAr?: string | null;
  proposal?: PendingProposal;
}

export interface IngestOptions {
  userId?: number | null;
  /** Override store resolution (e.g. user picked the store in the UI). */
  storeId?: number | null;
  llmModel?: string | null;
  evidence?: Extract<Evidence, 'receipt' | 'shelf_tag'>;
  llmResolver?: LlmResolver;
  now?: Date;
  db?: DB;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function unitPrice(l: { qty: number; unit_price_kwd: number | null; line_total_kwd: number | null }): number | null {
  if (l.unit_price_kwd != null && l.unit_price_kwd > 0) return l.unit_price_kwd;
  if (l.line_total_kwd != null && l.line_total_kwd > 0 && l.qty > 0) return round3(l.line_total_kwd / l.qty);
  return null;
}

interface Ctx {
  db: DB;
  receiptId: number;
  storeId: number | null;
  userId: number | null;
  evidence: Evidence;
  observedAt: Date;
  now: Date;
  report: IngestReport;
}

function recordForLine(ctx: Ctx, line: IngestedLine, productId: number, confidence: number): void {
  if (ctx.storeId == null || line.unitPriceKwd == null) return;
  const res = recordObservation(
    { productId, storeId: ctx.storeId, priceKwd: line.unitPriceKwd, evidence: ctx.evidence, observedAt: ctx.observedAt, confidence: Math.min(1, confidence), receiptLineId: line.lineId, userId: ctx.userId },
    ctx.db,
  );
  line.observation = { id: res.observation.id, status: res.status, reason: res.reason, referenceMedian: res.referenceMedian };
  if (res.status === 'quarantined') ctx.report.quarantined++;
  ctx.report.alerts.push(...checkAlerts(res.observation, { now: ctx.now, db: ctx.db }));
  // quarantined prices confirmed by this observation are now accepted → they may fire alerts too
  for (const id of res.promotedObservationIds) {
    ctx.report.promotedObservations++;
    const o = ctx.db.select().from(priceObservations).where(eq(priceObservations.id, id)).get();
    if (o) ctx.report.alerts.push(...checkAlerts(o, { now: ctx.now, db: ctx.db }));
  }
}

function productName(db: DB, id: number): string | null {
  return db.select({ n: products.nameEn }).from(products).where(eq(products.id, id)).get()?.n ?? null;
}

function finishWithChoice(ctx: Ctx, line: IngestedLine, choice: LlmDecision): void {
  if (choice.productId != null && choice.confidence >= 0.6) {
    const learned = confirmMatch(line.rawText, choice.productId, { storeId: ctx.storeId, confidence: choice.confidence, source: 'ai_match', now: ctx.now, db: ctx.db });
    Object.assign(line, {
      status: 'matched' as const, method: 'llm' as const, confidence: round3(choice.confidence), productId: choice.productId,
      productNameEn: productName(ctx.db, choice.productId), aliasLearned: learned.aliasLearned, needsLLM: false, candidates: undefined,
    });
    if (learned.aliasLearned) ctx.report.learnedAliases++;
    ctx.db.update(receiptLines).set({ matchedProductId: choice.productId, matchMethod: 'llm', matchConfidence: line.confidence, status: 'matched' }).where(eq(receiptLines.id, line.lineId)).run();
    recordForLine(ctx, line, choice.productId, choice.confidence);
  } else {
    const p = ingestUnmatched(line.rawText, ctx.userId, ctx.storeId, { proposal: { nameEn: choice.proposedNameEn ?? null, nameAr: choice.proposedNameAr ?? null, ...choice.proposal }, now: ctx.now, db: ctx.db });
    Object.assign(line, { status: 'unmatched' as const, method: 'none' as const, needsLLM: false, candidates: undefined, pendingId: p.pending.id });
    if (!ctx.report.pendingIds.includes(p.pending.id)) ctx.report.pendingIds.push(p.pending.id);
    ctx.db.update(receiptLines).set({ status: 'unmatched', matchMethod: 'none' }).where(eq(receiptLines.id, line.lineId)).run();
  }
}

function recount(report: IngestReport): void {
  report.counts = { alias_exact: 0, alias_fuzzy: 0, llm: 0, none: 0, needsLLM: 0 };
  for (const l of report.lines) {
    if (l.needsLLM) report.counts.needsLLM++;
    else report.counts[l.method]++;
  }
  report.status = report.lines.some((l) => l.status === 'needs_review') || report.storeId == null ? 'partial' : 'processed';
}

/** Ingest one extracted receipt (or shelf tag). */
export function ingestReceipt(extraction: ReceiptExtraction, opts: IngestOptions = {}): IngestReport {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const store = opts.storeId != null ? { storeId: opts.storeId, nameEn: db.select().from(stores).where(eq(stores.id, opts.storeId)).get()?.nameEn ?? '' } : resolveStore(extraction.store_text, db);
  const purchased = extraction.purchased_at ? new Date(extraction.purchased_at) : null;
  const observedAt = purchased && !Number.isNaN(purchased.getTime()) && purchased <= now ? purchased : now;

  const receipt = db
    .insert(receipts)
    .values({ userId: opts.userId ?? null, storeId: store?.storeId ?? null, storeTextRaw: extraction.store_text, purchasedAt: purchased && !Number.isNaN(purchased.getTime()) ? purchased : null, uploadedAt: now, imageDeleted: true, totalKwd: extraction.total_kwd, status: 'partial', llmModel: opts.llmModel ?? null })
    .returning({ id: receipts.id })
    .get();

  const report: IngestReport = {
    receiptId: receipt.id, storeId: store?.storeId ?? null, storeNameEn: store?.nameEn ?? null, status: 'partial', lines: [],
    counts: { alias_exact: 0, alias_fuzzy: 0, llm: 0, none: 0, needsLLM: 0 }, learnedAliases: 0, quarantined: 0, promotedObservations: 0, alerts: [], pendingIds: [],
  };
  const ctx: Ctx = { db, receiptId: receipt.id, storeId: store?.storeId ?? null, userId: opts.userId ?? null, evidence: opts.evidence ?? 'receipt', observedAt, now, report };

  for (const l of extraction.lines) {
    const m = matchLine(l.raw_text, { storeId: ctx.storeId, now, db });
    const up = unitPrice(l);
    const row = db
      .insert(receiptLines)
      .values({
        receiptId: receipt.id, rawText: l.raw_text, qty: l.qty, unitPriceKwd: up, lineTotalKwd: l.line_total_kwd,
        matchedProductId: m.productId, matchMethod: m.method, matchConfidence: m.confidence, status: m.needsLLM ? 'needs_review' : 'matched',
      })
      .returning({ id: receiptLines.id })
      .get();
    const line: IngestedLine = {
      lineId: row.id, rawText: l.raw_text, qty: l.qty, unitPriceKwd: up, status: m.needsLLM ? 'needs_review' : 'matched', method: m.method, confidence: m.confidence,
      productId: m.productId, productNameEn: m.productId != null ? productName(db, m.productId) : null, aliasLearned: !m.needsLLM && m.aliasLearned,
      observation: null, needsLLM: m.needsLLM, candidates: m.needsLLM ? m.candidates : undefined,
    };
    report.lines.push(line);
    if (line.aliasLearned) report.learnedAliases++;
    if (!m.needsLLM) recordForLine(ctx, line, m.productId, m.confidence);
    else if (opts.llmResolver) finishWithChoice(ctx, line, opts.llmResolver(l.raw_text, m.candidates));
  }

  recount(report);
  db.update(receipts).set({ status: report.status }).where(eq(receipts.id, receipt.id)).run();
  return report;
}

/**
 * Finish a `needs_review` line after the LLM (or the user) chose a product — or null for "not in catalogue".
 * Confident choices (≥ 0.85) are learned as aliases; null routes the text to pending_products.
 */
export function resolveLineWithLlm(
  lineId: number,
  productId: number | null,
  opts: { confidence?: number; proposedNameEn?: string | null; proposedNameAr?: string | null; proposal?: PendingProposal; userConfirmed?: boolean; now?: Date; db?: DB } = {},
): IngestedLine {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const lineRow = db.select().from(receiptLines).where(eq(receiptLines.id, lineId)).get();
  if (!lineRow) throw new Error(`receipt_lines ${lineId} not found`);
  if (lineRow.status !== 'needs_review') throw new Error(`receipt_lines ${lineId} is already ${lineRow.status}`);
  const r = db.select().from(receipts).where(eq(receipts.id, lineRow.receiptId)).get()!;
  const report: IngestReport = {
    receiptId: r.id, storeId: r.storeId, storeNameEn: null, status: 'partial', lines: [], counts: { alias_exact: 0, alias_fuzzy: 0, llm: 0, none: 0, needsLLM: 0 },
    learnedAliases: 0, quarantined: 0, promotedObservations: 0, alerts: [], pendingIds: [],
  };
  const ctx: Ctx = { db, receiptId: r.id, storeId: r.storeId, userId: r.userId, evidence: 'receipt', observedAt: r.purchasedAt && r.purchasedAt <= now ? r.purchasedAt : now, now, report };
  const line: IngestedLine = {
    lineId, rawText: lineRow.rawText, qty: lineRow.qty, unitPriceKwd: lineRow.unitPriceKwd, status: 'needs_review', method: 'none', confidence: 0,
    productId: null, productNameEn: null, aliasLearned: false, observation: null, needsLLM: true,
  };
  const confidence = opts.userConfirmed ? Math.max(opts.confidence ?? 1, LEARN_THRESHOLD) : (opts.confidence ?? 0.9);
  finishWithChoice(ctx, line, { productId, confidence, proposedNameEn: opts.proposedNameEn, proposedNameAr: opts.proposedNameAr, proposal: opts.proposal });
  // receipt becomes processed once no line needs review
  const remaining = db.select().from(receiptLines).where(eq(receiptLines.receiptId, r.id)).all().filter((l) => l.status === 'needs_review').length;
  if (!remaining && r.storeId != null) db.update(receipts).set({ status: 'processed' }).where(eq(receipts.id, r.id)).run();
  return Object.assign(line, { alerts: report.alerts });
}
