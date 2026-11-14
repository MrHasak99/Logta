/**
 * Catalogue growth: unknown receipt items are collected in pending_products until enough
 * independent sightings justify promoting them to real products. "The catalogue grows itself."
 */
import { and, eq, gte, isNull } from 'drizzle-orm';
import { getDb, type DB } from '../db/client.ts';
import { pendingProducts, productAliases, products, receiptLines, receipts, type PendingProduct, type Product, type SizeUnit } from '../db/schema.ts';
import { learnAlias, matchLine } from './matching.ts';
import { detectLang, normalizeAlias, toBaseQty } from './normalize.ts';
import { recordObservation } from './prices.ts';

export const PROMOTION_MIN_SEEN = 3;
export const PROMOTION_MIN_USERS = 2;

export interface IngestUnmatchedResult {
  pending: PendingProduct;
  created: boolean;
  readyForPromotion: boolean;
}

export const isReadyForPromotion = (p: Pick<PendingProduct, 'seenCount' | 'distinctUsers' | 'promotedProductId'>) =>
  p.promotedProductId == null && p.seenCount >= PROMOTION_MIN_SEEN && p.distinctUsers >= PROMOTION_MIN_USERS;

/** AI-proposed details for an unknown item (all optional; filled in as sightings arrive). */
export interface PendingProposal {
  nameEn?: string | null;
  nameAr?: string | null;
  categoryId?: number | null;
  brand?: string | null;
  sizeValue?: number | null;
  sizeUnit?: SizeUnit | null;
}

/** Record a sighting of an unknown item (upsert on normalised text). */
export function ingestUnmatched(
  rawText: string,
  userId: number | null,
  storeId: number | null,
  opts: { proposal?: PendingProposal; /** true when this sighting came with a fresh AI decision */ aiDecided?: boolean; now?: Date; db?: DB } = {},
): IngestUnmatchedResult {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const norm = normalizeAlias(rawText);
  const existing = db.select().from(pendingProducts).where(eq(pendingProducts.aliasNormalized, norm)).get();

  if (!existing) {
    const userIds = userId != null ? [userId] : [];
    const storeIds = storeId != null ? [storeId] : [];
    const pending = db
      .insert(pendingProducts)
      .values({
        aliasNormalized: norm, exampleRawText: rawText, firstSeenAt: now, lastSeenAt: now, seenCount: 1,
        distinctUsers: userIds.length, distinctStores: storeIds.length, userIdsJson: JSON.stringify(userIds), storeIdsJson: JSON.stringify(storeIds),
        proposedNameEn: opts.proposal?.nameEn ?? null, proposedNameAr: opts.proposal?.nameAr ?? null, proposedCategoryId: opts.proposal?.categoryId ?? null,
        proposedBrand: opts.proposal?.brand ?? null, proposedSizeValue: opts.proposal?.sizeValue ?? null, proposedSizeUnit: opts.proposal?.sizeUnit ?? null,
        aiDecidedAt: opts.aiDecided ? now : null,
      })
      .returning()
      .get();
    return { pending, created: true, readyForPromotion: isReadyForPromotion(pending) };
  }

  const userIds = new Set<number>(JSON.parse(existing.userIdsJson));
  const storeIds = new Set<number>(JSON.parse(existing.storeIdsJson));
  if (userId != null) userIds.add(userId);
  if (storeId != null) storeIds.add(storeId);
  const pending = db
    .update(pendingProducts)
    .set({
      lastSeenAt: now,
      seenCount: existing.seenCount + 1,
      distinctUsers: userIds.size,
      distinctStores: storeIds.size,
      userIdsJson: JSON.stringify([...userIds]),
      storeIdsJson: JSON.stringify([...storeIds]),
      proposedNameEn: existing.proposedNameEn ?? opts.proposal?.nameEn ?? null,
      proposedNameAr: existing.proposedNameAr ?? opts.proposal?.nameAr ?? null,
      proposedCategoryId: existing.proposedCategoryId ?? opts.proposal?.categoryId ?? null,
      proposedBrand: existing.proposedBrand ?? opts.proposal?.brand ?? null,
      ...(opts.aiDecided ? { aiDecidedAt: now } : {}),
      // size value + unit travel together
      ...(existing.proposedSizeValue == null && opts.proposal?.sizeValue != null && opts.proposal.sizeUnit
        ? { proposedSizeValue: opts.proposal.sizeValue, proposedSizeUnit: opts.proposal.sizeUnit }
        : {}),
    })
    .where(eq(pendingProducts.id, existing.id))
    .returning()
    .get();
  return { pending, created: false, readyForPromotion: isReadyForPromotion(pending) };
}

/** Pending items, optionally only those ready for promotion (for an admin/review screen). */
export function listPending(opts: { readyOnly?: boolean; db?: DB } = {}): (PendingProduct & { readyForPromotion: boolean })[] {
  const db = opts.db ?? getDb();
  const rows = db
    .select()
    .from(pendingProducts)
    .where(and(isNull(pendingProducts.promotedProductId), opts.readyOnly ? gte(pendingProducts.seenCount, PROMOTION_MIN_SEEN) : undefined))
    .all();
  return rows.map((r) => ({ ...r, readyForPromotion: isReadyForPromotion(r) })).filter((r) => !opts.readyOnly || r.readyForPromotion);
}

export interface PromoteDetails {
  nameEn: string;
  nameAr: string;
  categoryId: number;
  sizeValue: number;
  sizeUnit: SizeUnit;
  brand?: string | null;
  packCount?: number;
  substituteGroup?: string | null;
  barcode?: string | null;
  slug?: string;
  /** Extra aliases (EN/AR/colloquial) to register with the new product. */
  extraAliases?: string[];
}

/** Turn a pending item into a real product with aliases (its raw receipt text becomes a receipt_shorthand alias). */
export function promotePending(id: number, details: PromoteDetails, opts: { force?: boolean; db?: DB } = {}): Product {
  const db = opts.db ?? getDb();
  return db.transaction((tx) => {
    const pending = tx.select().from(pendingProducts).where(eq(pendingProducts.id, id)).get();
    if (!pending) throw new Error(`pending_products ${id} not found`);
    if (pending.promotedProductId != null) throw new Error(`pending_products ${id} already promoted`);
    if (!opts.force && !isReadyForPromotion(pending)) {
      throw new Error(`pending_products ${id} not ready (seen ${pending.seenCount}/${PROMOTION_MIN_SEEN}, users ${pending.distinctUsers}/${PROMOTION_MIN_USERS}); pass force to override`);
    }
    const { kind } = toBaseQty(details.sizeValue, details.sizeUnit);
    const slugBase = details.slug ?? normalizeAlias(details.nameEn).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ?? `pending-${id}`;
    const product = tx
      .insert(products)
      .values({
        slug: `${slugBase || 'product'}-r${id}`,
        nameEn: details.nameEn,
        nameAr: details.nameAr,
        brand: details.brand ?? null,
        categoryId: details.categoryId,
        sizeValue: details.sizeValue,
        sizeUnit: details.sizeUnit,
        packCount: details.packCount ?? 1,
        baseQtyForUnitPrice: kind === 'mass' ? 100 : kind === 'volume' ? 1000 : 1,
        substituteGroup: details.substituteGroup ?? null,
        barcode: details.barcode ?? null,
        status: 'active',
        createdFrom: 'receipt',
      })
      .returning()
      .get();
    const aliases: { text: string; kind: 'canonical' | 'receipt_shorthand' | 'colloquial' }[] = [
      { text: details.nameEn, kind: 'canonical' },
      { text: details.nameAr, kind: 'canonical' },
      { text: pending.exampleRawText, kind: 'receipt_shorthand' },
      ...(details.extraAliases ?? []).map((t) => ({ text: t, kind: 'colloquial' as const })),
    ];
    const seen = new Set<string>();
    for (const a of aliases) {
      const norm = normalizeAlias(a.text);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      tx.insert(productAliases).values({ productId: product.id, aliasText: a.text, aliasNormalized: norm, lang: detectLang(a.text), kind: a.kind, source: 'user_confirmed', hitCount: a.kind === 'receipt_shorthand' ? pending.seenCount : 0, storeId: null }).run();
    }
    tx.update(pendingProducts).set({ promotedProductId: product.id }).where(eq(pendingProducts.id, id)).run();
    return product;
  });
}

// ---------------------------------------------------------------------------
// Fully automatic growth (no human review)
// ---------------------------------------------------------------------------

export interface AutoPromotion {
  pendingId: number;
  rawText: string;
  /** 'created' = new product added; 'merged' = the AI's proposal matched an existing product, so the text became its alias. */
  action: 'created' | 'merged';
  productId: number;
  productNameEn: string;
  /** Earlier unmatched receipt lines that were re-linked and turned into price observations. */
  backfilledLines: number;
  backfilledObservations: number;
}

/** Minimum similarity for "this proposal is actually an existing product" → merge instead of creating a duplicate. */
export const MERGE_THRESHOLD = 0.9;

const hasFullProposal = (p: PendingProduct) =>
  !!p.proposedNameEn && !!p.proposedNameAr && p.proposedCategoryId != null && p.proposedSizeValue != null && !!p.proposedSizeUnit;

/**
 * Promote every ready pending item that has a complete AI proposal (name EN/AR, category, size):
 *  - if the proposed name already matches a product (≥ 0.9), merge: the receipt text becomes a learned alias of it;
 *  - otherwise create the product (+ aliases).
 * Then backfill: earlier receipt lines with that text are linked and their prices recorded.
 * Items without a complete proposal keep collecting sightings until one arrives.
 */
export function autoPromoteReady(opts: { now?: Date; db?: DB } = {}): AutoPromotion[] {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const out: AutoPromotion[] = [];
  for (const p of listPending({ readyOnly: true, db })) {
    if (!hasFullProposal(p)) continue;
    let productId: number;
    let action: AutoPromotion['action'];
    const existing = matchLine(p.proposedNameEn!, { learn: false, db });
    if (!existing.needsLLM && existing.confidence >= MERGE_THRESHOLD) {
      productId = existing.productId;
      action = 'merged';
      learnAlias(productId, p.exampleRawText, { source: 'ai_match', now, db });
      db.update(pendingProducts).set({ promotedProductId: productId }).where(eq(pendingProducts.id, p.id)).run();
    } else {
      const product = promotePending(
        p.id,
        { nameEn: p.proposedNameEn!, nameAr: p.proposedNameAr!, categoryId: p.proposedCategoryId!, sizeValue: p.proposedSizeValue!, sizeUnit: p.proposedSizeUnit!, brand: p.proposedBrand },
        { db },
      );
      productId = product.id;
      action = 'created';
    }
    const bf = backfillUnmatchedLines(p.aliasNormalized, productId, { now, db });
    const name = db.select({ n: products.nameEn }).from(products).where(eq(products.id, productId)).get()?.n ?? '';
    out.push({ pendingId: p.id, rawText: p.exampleRawText, action, productId, productNameEn: name, backfilledLines: bf.lines, backfilledObservations: bf.observations });
  }
  return out;
}

/** Link earlier 'unmatched' receipt lines whose text normalises to `aliasNormalized` and record their prices. */
export function backfillUnmatchedLines(aliasNormalized: string, productId: number, opts: { now?: Date; db?: DB } = {}): { lines: number; observations: number } {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const rows = db
    .select({ line: receiptLines, receipt: receipts })
    .from(receiptLines)
    .innerJoin(receipts, eq(receipts.id, receiptLines.receiptId))
    .where(eq(receiptLines.status, 'unmatched'))
    .all()
    .filter((r) => normalizeAlias(r.line.rawText) === aliasNormalized);
  let observations = 0;
  for (const { line, receipt } of rows) {
    db.update(receiptLines).set({ matchedProductId: productId, matchMethod: 'alias_exact', matchConfidence: 1, status: 'matched' }).where(eq(receiptLines.id, line.id)).run();
    if (receipt.storeId != null && line.unitPriceKwd != null && line.unitPriceKwd > 0) {
      const at = receipt.purchasedAt && receipt.purchasedAt <= now ? receipt.purchasedAt : receipt.uploadedAt;
      recordObservation({ productId, storeId: receipt.storeId, priceKwd: line.unitPriceKwd, evidence: 'receipt', observedAt: at, confidence: 0.9, receiptLineId: line.id, userId: receipt.userId }, db);
      observations++;
    }
  }
  return { lines: rows.length, observations };
}
