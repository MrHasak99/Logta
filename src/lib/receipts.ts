/** Read models for scanned receipts and the real-scan price feed (used by the API server). */
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb, type DB } from '../db/client.ts';
import { priceObservations, products, receiptLines, receipts, stores } from '../db/schema.ts';

export interface ReceiptLineView {
  lineId: number;
  rawText: string;
  qty: number;
  unitPriceKwd: number | null;
  /** matched | needs_review (waiting for the AI) | unmatched (unknown item, being collected) */
  status: 'matched' | 'needs_review' | 'unmatched';
  method: 'alias_exact' | 'alias_fuzzy' | 'llm' | 'none';
  confidence: number;
  product: { id: number; nameEn: string; nameAr: string } | null;
  observation: { id: number; status: 'accepted' | 'quarantined' | 'rejected' } | null;
}

export interface ReceiptView {
  id: number;
  status: 'processed' | 'partial' | 'failed';
  store: { id: number; nameEn: string; nameAr: string } | null;
  storeTextRaw: string | null;
  purchasedAt: Date | null;
  uploadedAt: Date;
  totalKwd: number | null;
  /** Counts for the UI tiles: saved = accepted prices, held = quarantined, waiting = needs_review, newItems = unmatched. */
  summary: { lines: number; saved: number; held: number; waiting: number; newItems: number };
  lines: ReceiptLineView[];
}

function summarize(lines: ReceiptLineView[]): ReceiptView['summary'] {
  return {
    lines: lines.length,
    saved: lines.filter((l) => l.observation?.status === 'accepted').length,
    held: lines.filter((l) => l.observation?.status === 'quarantined').length,
    waiting: lines.filter((l) => l.status === 'needs_review').length,
    newItems: lines.filter((l) => l.status === 'unmatched').length,
  };
}

function linesFor(db: DB, receiptIds: number[]): Map<number, ReceiptLineView[]> {
  const out = new Map<number, ReceiptLineView[]>();
  if (!receiptIds.length) return out;
  const rows = db
    .select({ line: receiptLines, product: { id: products.id, nameEn: products.nameEn, nameAr: products.nameAr }, obsId: priceObservations.id, obsStatus: priceObservations.status })
    .from(receiptLines)
    .leftJoin(products, eq(products.id, receiptLines.matchedProductId))
    .leftJoin(priceObservations, eq(priceObservations.receiptLineId, receiptLines.id))
    .where(inArray(receiptLines.receiptId, receiptIds))
    .orderBy(receiptLines.id)
    .all();
  for (const r of rows) {
    const view: ReceiptLineView = {
      lineId: r.line.id,
      rawText: r.line.rawText,
      qty: r.line.qty,
      unitPriceKwd: r.line.unitPriceKwd,
      status: r.line.status,
      method: r.line.matchMethod,
      confidence: r.line.matchConfidence,
      product: r.product?.id != null ? r.product : null,
      observation: r.obsId != null && r.obsStatus ? { id: r.obsId, status: r.obsStatus } : null,
    };
    const arr = out.get(r.line.receiptId);
    if (arr) arr.push(view);
    else out.set(r.line.receiptId, [view]);
  }
  return out;
}

function storeMap(db: DB, ids: (number | null)[]) {
  const clean = [...new Set(ids.filter((x): x is number => x != null))];
  if (!clean.length) return new Map<number, { id: number; nameEn: string; nameAr: string }>();
  return new Map(db.select({ id: stores.id, nameEn: stores.nameEn, nameAr: stores.nameAr }).from(stores).where(inArray(stores.id, clean)).all().map((s) => [s.id, s]));
}

/** One receipt with its current line statuses — poll this to see "waiting for AI" lines get resolved. Owner only. */
export function getReceipt(receiptId: number, userId: number, db: DB = getDb()): ReceiptView | null {
  const r = db.select().from(receipts).where(and(eq(receipts.id, receiptId), eq(receipts.userId, userId))).get();
  if (!r) return null;
  const lines = linesFor(db, [r.id]).get(r.id) ?? [];
  const store = r.storeId != null ? (storeMap(db, [r.storeId]).get(r.storeId) ?? null) : null;
  return { id: r.id, status: r.status, store, storeTextRaw: r.storeTextRaw, purchasedAt: r.purchasedAt, uploadedAt: r.uploadedAt, totalKwd: r.totalKwd, summary: summarize(lines), lines };
}

/** A device's recent receipts, newest first (summary only; fetch one for its lines). */
export function listReceipts(userId: number, opts: { limit?: number; db?: DB } = {}): Omit<ReceiptView, 'lines'>[] {
  const db = opts.db ?? getDb();
  const rows = db.select().from(receipts).where(eq(receipts.userId, userId)).orderBy(desc(receipts.uploadedAt)).limit(Math.min(opts.limit ?? 20, 100)).all();
  const lines = linesFor(db, rows.map((r) => r.id));
  const st = storeMap(db, rows.map((r) => r.storeId));
  return rows.map((r) => ({
    id: r.id, status: r.status, store: r.storeId != null ? (st.get(r.storeId) ?? null) : null, storeTextRaw: r.storeTextRaw,
    purchasedAt: r.purchasedAt, uploadedAt: r.uploadedAt, totalKwd: r.totalKwd, summary: summarize(lines.get(r.id) ?? []),
  }));
}

export interface RecentPrice {
  observationId: number;
  product: { id: number; nameEn: string; nameAr: string };
  store: { id: number; nameEn: string; nameAr: string };
  priceKwd: number;
  previousPriceKwd: number | null;
  observedAt: Date;
  evidence: 'receipt' | 'shelf_tag';
  isPromo: boolean;
}

/**
 * Live feed of REAL prices from shoppers' receipts and shelf tags (seed estimates excluded), newest first,
 * one row per product × store, with the previous accepted price for a ↑/↓ indicator.
 */
export function recentPrices(opts: { limit?: number; db?: DB } = {}): RecentPrice[] {
  const db = opts.db ?? getDb();
  const limit = Math.min(opts.limit ?? 20, 100);
  const rows = db
    .select({ o: priceObservations, product: { id: products.id, nameEn: products.nameEn, nameAr: products.nameAr }, store: { id: stores.id, nameEn: stores.nameEn, nameAr: stores.nameAr } })
    .from(priceObservations)
    .innerJoin(products, eq(products.id, priceObservations.productId))
    .innerJoin(stores, eq(stores.id, priceObservations.storeId))
    .where(and(eq(priceObservations.status, 'accepted'), inArray(priceObservations.evidence, ['receipt', 'shelf_tag'])))
    .orderBy(desc(priceObservations.observedAt), desc(priceObservations.id))
    .limit(limit * 5)
    .all();
  const seen = new Set<string>();
  const out: RecentPrice[] = [];
  for (const r of rows) {
    const key = `${r.o.productId}:${r.o.storeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const prev = db
      .select({ p: priceObservations.priceKwd })
      .from(priceObservations)
      .where(and(eq(priceObservations.productId, r.o.productId), eq(priceObservations.storeId, r.o.storeId), eq(priceObservations.status, 'accepted')))
      .orderBy(desc(priceObservations.observedAt), desc(priceObservations.id))
      .limit(2)
      .all()
      .find((_, i) => i === 1);
    out.push({ observationId: r.o.id, product: r.product, store: r.store, priceKwd: r.o.priceKwd, previousPriceKwd: prev?.p ?? null, observedAt: r.o.observedAt, evidence: r.o.evidence as 'receipt' | 'shelf_tag', isPromo: r.o.isPromo });
    if (out.length >= limit) break;
  }
  return out;
}
