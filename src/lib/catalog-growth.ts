/**
 * Catalogue growth: unknown receipt items are collected in pending_products until enough
 * independent sightings justify promoting them to real products. "The catalogue grows itself."
 */
import { and, eq, gte, isNull } from 'drizzle-orm';
import { getDb, type DB } from '../db/client.ts';
import { pendingProducts, productAliases, products, type PendingProduct, type Product, type SizeUnit } from '../db/schema.ts';
import { detectLang, normalizeAlias, toBaseQty } from './normalize.ts';

export const PROMOTION_MIN_SEEN = 3;
export const PROMOTION_MIN_USERS = 2;

export interface IngestUnmatchedResult {
  pending: PendingProduct;
  created: boolean;
  readyForPromotion: boolean;
}

export const isReadyForPromotion = (p: Pick<PendingProduct, 'seenCount' | 'distinctUsers' | 'promotedProductId'>) =>
  p.promotedProductId == null && p.seenCount >= PROMOTION_MIN_SEEN && p.distinctUsers >= PROMOTION_MIN_USERS;

/** Record a sighting of an unknown item (upsert on normalised text). */
export function ingestUnmatched(
  rawText: string,
  userId: number | null,
  storeId: number | null,
  opts: { proposal?: { nameEn?: string; nameAr?: string; categoryId?: number }; now?: Date; db?: DB } = {},
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
