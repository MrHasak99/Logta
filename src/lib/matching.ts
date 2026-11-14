/**
 * Matching cascade: receipt/shelf-tag text → canonical product.
 *
 *   1. alias_exact  — normalised text equals a known alias (store-specific aliases preferred)
 *   2. alias_fuzzy  — token/trigram similarity with size agreement required
 *   3. needsLLM     — return the top-10 candidates so the API layer can ask the LLM to choose
 *
 * Every confident fuzzy/LLM match is written back as a `learned` alias, so the next identical
 * line is an exact hit. "The more photos people take, the less AI we need."
 */
import { and, eq, isNull, or } from 'drizzle-orm';
import { getDb, type DB } from '../db/client.ts';
import { productAliases, products, type AliasSource } from '../db/schema.ts';
import { detectLang, normalizeAlias, parseSize, stripSizeTokens, toBaseQty, type ParsedSize } from './normalize.ts';
import { textSimilarity } from './similarity.ts';

/** Minimum similarity for an automatic fuzzy match. */
export const FUZZY_ACCEPT = 0.82;
/** A fuzzy/LLM match at or above this confidence is learned as a new alias. */
export const LEARN_THRESHOLD = 0.85;
/** Best product must beat the runner-up (different product) by this margin, else ask the LLM. */
export const FUZZY_MARGIN = 0.03;

export interface MatchCandidate {
  productId: number;
  slug: string;
  nameEn: string;
  nameAr: string;
  brand: string | null;
  sizeLabel: string;
  score: number;
  sizeAgrees: boolean | null;
}

export type MatchResult =
  | {
      needsLLM: false;
      productId: number;
      method: 'alias_exact' | 'alias_fuzzy';
      confidence: number;
      aliasLearned: boolean;
      matchedAlias: string;
    }
  | {
      needsLLM: true;
      productId: null;
      method: 'none';
      confidence: number;
      candidates: MatchCandidate[];
    };

export interface MatchOptions {
  storeId?: number | null;
  /** Write learned aliases / bump hit counts (default true). Set false for dry runs. */
  learn?: boolean;
  now?: Date;
  db?: DB;
}

interface AliasRow {
  aliasId: number;
  productId: number;
  aliasNormalized: string;
  storeId: number | null;
  hitCount: number;
  slug: string;
  nameEn: string;
  nameAr: string;
  brand: string | null;
  sizeValue: number;
  sizeUnit: string;
  packCount: number;
}

function loadAliases(db: DB): AliasRow[] {
  return db
    .select({
      aliasId: productAliases.id,
      productId: productAliases.productId,
      aliasNormalized: productAliases.aliasNormalized,
      storeId: productAliases.storeId,
      hitCount: productAliases.hitCount,
      slug: products.slug,
      nameEn: products.nameEn,
      nameAr: products.nameAr,
      brand: products.brand,
      sizeValue: products.sizeValue,
      sizeUnit: products.sizeUnit,
      packCount: products.packCount,
    })
    .from(productAliases)
    .innerJoin(products, eq(products.id, productAliases.productId))
    .where(eq(products.status, 'active'))
    .all();
}

/** Does the size in the text agree with the product's size? null = no size in the text. */
export function sizeAgrees(parsed: ParsedSize | null, p: { sizeValue: number; sizeUnit: string; packCount: number }): boolean | null {
  if (!parsed) return null;
  const { baseQty, kind } = toBaseQty(p.sizeValue, p.sizeUnit);
  if (kind !== parsed.kind) {
    // count-only text ("30 pcs") vs a mass product etc. → treat as disagreement
    return false;
  }
  const close = (x: number, y: number) => Math.abs(x - y) <= Math.max(0.02 * y, 0.001);
  return close(parsed.baseQty, baseQty) || close(parsed.baseQty * parsed.packCount, baseQty * p.packCount) || close(parsed.baseQty, baseQty * p.packCount);
}

function sizeLabel(p: { sizeValue: number; sizeUnit: string; packCount: number }): string {
  return `${p.packCount > 1 ? `${p.packCount} × ` : ''}${p.sizeValue}${p.sizeUnit}`;
}

function toCandidate(r: AliasRow, score: number, agrees: boolean | null): MatchCandidate {
  return { productId: r.productId, slug: r.slug, nameEn: r.nameEn, nameAr: r.nameAr, brand: r.brand, sizeLabel: sizeLabel(r), score: round3(score), sizeAgrees: agrees };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Match one receipt/shelf-tag line to a product. */
export function matchLine(rawText: string, storeIdOrOpts?: number | null | MatchOptions, maybeOpts: MatchOptions = {}): MatchResult {
  const opts: MatchOptions = typeof storeIdOrOpts === 'object' && storeIdOrOpts !== null ? storeIdOrOpts : { ...maybeOpts, storeId: storeIdOrOpts ?? maybeOpts.storeId };
  const db = opts.db ?? getDb();
  const storeId = opts.storeId ?? null;
  const learn = opts.learn !== false;
  const now = opts.now ?? new Date();
  const norm = normalizeAlias(rawText);
  if (!norm) return { needsLLM: true, productId: null, method: 'none', confidence: 0, candidates: [] };

  const all = loadAliases(db);

  // ---- 1. exact ----
  const exact = all.filter((a) => a.aliasNormalized === norm);
  if (exact.length) {
    const tier = (a: AliasRow) => (storeId != null && a.storeId === storeId ? 0 : a.storeId == null ? 1 : 2);
    exact.sort((x, y) => tier(x) - tier(y) || y.hitCount - x.hitCount);
    const best = exact[0]!;
    const bestTier = tier(best);
    const rivals = new Set(exact.filter((a) => tier(a) === bestTier).map((a) => a.productId));
    let confidence = bestTier === 2 ? 0.95 : 1;
    if (rivals.size > 1) confidence = 0.8; // same text maps to several products
    if (learn) {
      db.update(productAliases)
        .set({ hitCount: best.hitCount + 1, lastSeenAt: now })
        .where(eq(productAliases.id, best.aliasId))
        .run();
    }
    return { needsLLM: false, productId: best.productId, method: 'alias_exact', confidence, aliasLearned: false, matchedAlias: best.aliasNormalized };
  }

  // ---- 2. fuzzy ----
  const parsed = parseSize(norm);
  const qText = stripSizeTokens(norm);
  const bestByProduct = new Map<number, { row: AliasRow; score: number; agrees: boolean | null }>();
  for (const a of all) {
    const aText = stripSizeTokens(a.aliasNormalized);
    let score = textSimilarity(qText, aText);
    const agrees = sizeAgrees(parsed, a);
    if (agrees === null) score *= 0.95;
    else if (!agrees) score *= 0.7;
    if (storeId != null && a.storeId === storeId) score = Math.min(1, score + 0.02);
    const prev = bestByProduct.get(a.productId);
    if (!prev || score > prev.score) bestByProduct.set(a.productId, { row: a, score, agrees });
  }
  const ranked = [...bestByProduct.values()].sort((x, y) => y.score - x.score);
  const top = ranked[0];
  const runnerUp = ranked[1];
  if (
    top &&
    top.score >= FUZZY_ACCEPT &&
    top.agrees !== false &&
    (!runnerUp || top.score - runnerUp.score >= FUZZY_MARGIN)
  ) {
    const confidence = round3(top.score);
    let aliasLearned = false;
    if (learn && confidence >= LEARN_THRESHOLD) {
      aliasLearned = learnAlias(top.row.productId, rawText, { storeId, source: 'ai_match', now, db }).created;
    }
    return { needsLLM: false, productId: top.row.productId, method: 'alias_fuzzy', confidence, aliasLearned, matchedAlias: top.row.aliasNormalized };
  }

  // ---- 3. hand over to the LLM ----
  return {
    needsLLM: true,
    productId: null,
    method: 'none',
    confidence: top ? round3(top.score) : 0,
    candidates: ranked.slice(0, 10).map((c) => toCandidate(c.row, c.score, c.agrees)),
  };
}

/**
 * Add (or reinforce) an alias for a product. Used after confident fuzzy/LLM matches and user confirmations.
 * Learned aliases are store-specific when a store is known (chains print their own shorthand).
 */
export function learnAlias(
  productId: number,
  rawText: string,
  opts: { storeId?: number | null; source?: AliasSource; now?: Date; db?: DB } = {},
): { aliasId: number; created: boolean } {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const storeId = opts.storeId ?? null;
  const norm = normalizeAlias(rawText);
  const existing = db
    .select()
    .from(productAliases)
    .where(
      and(
        eq(productAliases.productId, productId),
        eq(productAliases.aliasNormalized, norm),
        storeId == null ? isNull(productAliases.storeId) : or(eq(productAliases.storeId, storeId), isNull(productAliases.storeId)),
      ),
    )
    .get();
  if (existing) {
    db.update(productAliases)
      .set({ hitCount: existing.hitCount + 1, lastSeenAt: now, ...(opts.source === 'user_confirmed' ? { source: 'user_confirmed' as const } : {}) })
      .where(eq(productAliases.id, existing.id))
      .run();
    return { aliasId: existing.id, created: false };
  }
  const row = db
    .insert(productAliases)
    .values({
      productId,
      aliasText: rawText,
      aliasNormalized: norm,
      lang: detectLang(rawText),
      kind: 'learned',
      source: opts.source ?? 'ai_match',
      hitCount: 1,
      storeId,
      lastSeenAt: now,
    })
    .returning({ id: productAliases.id })
    .get();
  return { aliasId: row.id, created: true };
}

/**
 * Call after the LLM picked a candidate (or the user confirmed one).
 * Learns the alias when confidence ≥ LEARN_THRESHOLD.
 */
export function confirmMatch(
  rawText: string,
  productId: number,
  opts: { storeId?: number | null; confidence?: number; source?: AliasSource; now?: Date; db?: DB } = {},
): { aliasLearned: boolean } {
  const confidence = opts.confidence ?? 0.9;
  if (confidence < LEARN_THRESHOLD && opts.source !== 'user_confirmed') return { aliasLearned: false };
  return { aliasLearned: learnAlias(productId, rawText, opts).created };
}
