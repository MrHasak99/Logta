/**
 * Price observations: trust scoring, outlier quarantine and current-price estimation.
 * price_observations is append-only — prices are never updated in place (only status flips
 * quarantined → accepted when a second independent observation confirms it).
 */
import { and, desc, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { getDb, type DB } from '../db/client.ts';
import {
  categories,
  priceObservations,
  products,
  receiptLines,
  stores,
  users,
  type Evidence,
  type ObsStatus,
  type PriceObservation,
  type SeedSource,
  type Volatility,
} from '../db/schema.ts';

const DAY_MS = 86_400_000;
export const QUARANTINE_DEVIATION = 0.35;
export const CONFIRM_TOLERANCE = 0.25;
export const NO_HISTORY_CONFIDENCE_FACTOR = 0.7;
export const CURRENT_PRICE_WINDOW = 10;
/** A promo price counts as "current" only while this fresh. */
export const PROMO_FRESH_DAYS = 3;

export const EVIDENCE_WEIGHT: Record<Evidence, number> = { receipt: 1.0, shelf_tag: 0.85, manual: 0.5, seed: 0.4 };
export const TAU_DAYS: Record<Volatility, number> = { high: 3, medium: 10, low: 30 };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------
// Trust
// ---------------------------------------------------------------------------

export interface TrustContext {
  volatility: Volatility;
  /** users.trust_weight of the contributor (1.0 for seed / anonymous). */
  userTrustWeight?: number;
}

/**
 * trust = evidenceWeight × exp(−ageDays / τ(volatility)) × confidence × userTrustWeight, clamped to [0, 1].
 */
export function trustScore(
  observation: Pick<PriceObservation, 'evidence' | 'observedAt' | 'confidence'>,
  now: Date,
  ctx: TrustContext,
): number {
  const ageDays = Math.max(0, (now.getTime() - observation.observedAt.getTime()) / DAY_MS);
  const t = EVIDENCE_WEIGHT[observation.evidence] * Math.exp(-ageDays / TAU_DAYS[ctx.volatility]) * observation.confidence * (ctx.userTrustWeight ?? 1);
  return Math.max(0, Math.min(1, t));
}

/** Weighted median: the price at which cumulative weight crosses half the total. */
export function weightedMedian(items: { value: number; weight: number }[]): number | null {
  const xs = items.filter((i) => i.weight > 0).sort((a, b) => a.value - b.value);
  if (!xs.length) return items.length ? median(items.map((i) => i.value)) : null;
  const total = xs.reduce((s, i) => s + i.weight, 0);
  let acc = 0;
  for (const x of xs) {
    acc += x.weight;
    if (acc >= total / 2) return x.value;
  }
  return xs[xs.length - 1]!.value;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

// ---------------------------------------------------------------------------
// Recording observations (with outlier quarantine)
// ---------------------------------------------------------------------------

export interface RecordObservationInput {
  productId: number;
  storeId: number;
  priceKwd: number;
  evidence: Evidence;
  observedAt?: Date;
  confidence?: number;
  isPromo?: boolean;
  receiptLineId?: number | null;
  userId?: number | null;
  seedSource?: SeedSource | null;
}

export interface RecordObservationResult {
  observation: PriceObservation;
  status: ObsStatus;
  /** Median of accepted prices (same product/store, last 30 days) used for the outlier test. */
  referenceMedian: number | null;
  deviation: number | null;
  reason: 'no_history' | 'within_range' | 'outlier_quarantined' | 'confirmed_by_independent_observation';
  /** Previously quarantined observations that this one confirmed (now accepted). */
  promotedObservationIds: number[];
}

function receiptIdOfLine(db: DB, lineId: number | null): number | null {
  if (lineId == null) return null;
  return db.select({ r: receiptLines.receiptId }).from(receiptLines).where(eq(receiptLines.id, lineId)).get()?.r ?? null;
}

/** Two observations are independent if they come from different users or different receipts. */
function independent(
  db: DB,
  a: { userId: number | null; receiptLineId: number | null },
  b: { userId: number | null; receiptLineId: number | null },
): boolean {
  const ra = receiptIdOfLine(db, a.receiptLineId);
  const rb = receiptIdOfLine(db, b.receiptLineId);
  if (ra != null && rb != null && ra === rb) return false; // same receipt
  if (a.userId != null && b.userId != null && a.userId !== b.userId) return true; // different users
  if (ra != null && rb != null) return true; // different receipts
  return false; // not provably independent
}

export function recordObservation(input: RecordObservationInput, db: DB = getDb()): RecordObservationResult {
  const observedAt = input.observedAt ?? new Date();
  const since = new Date(observedAt.getTime() - 30 * DAY_MS);
  const window = and(
    eq(priceObservations.productId, input.productId),
    eq(priceObservations.storeId, input.storeId),
    gte(priceObservations.observedAt, since),
    lte(priceObservations.observedAt, observedAt),
  );

  return db.transaction((tx) => {
    const accepted = tx
      .select({ price: priceObservations.priceKwd })
      .from(priceObservations)
      .where(and(window, eq(priceObservations.status, 'accepted')))
      .all();
    const ref = median(accepted.map((r) => r.price));

    let status: ObsStatus = 'accepted';
    let confidence = input.confidence ?? 1;
    let reason: RecordObservationResult['reason'];
    let deviation: number | null = null;

    if (ref == null) {
      confidence *= NO_HISTORY_CONFIDENCE_FACTOR;
      reason = 'no_history';
    } else {
      deviation = Math.abs(input.priceKwd - ref) / ref;
      if (deviation > QUARANTINE_DEVIATION) {
        status = 'quarantined';
        reason = 'outlier_quarantined';
      } else reason = 'within_range';
    }

    // Look for quarantined observations this one could confirm (or be confirmed by).
    const quarantined = tx
      .select()
      .from(priceObservations)
      .where(and(window, eq(priceObservations.status, 'quarantined')))
      .all()
      .filter(
        (q) =>
          Math.abs(q.priceKwd - input.priceKwd) / q.priceKwd <= CONFIRM_TOLERANCE &&
          independent(tx as unknown as DB, q, { userId: input.userId ?? null, receiptLineId: input.receiptLineId ?? null }),
      );
    const promotedObservationIds: number[] = [];
    if (quarantined.length) {
      for (const q of quarantined) {
        tx.update(priceObservations).set({ status: 'accepted' }).where(eq(priceObservations.id, q.id)).run();
        promotedObservationIds.push(q.id);
      }
      if (status === 'quarantined') {
        status = 'accepted';
        reason = 'confirmed_by_independent_observation';
      }
    }

    const observation = tx
      .insert(priceObservations)
      .values({
        productId: input.productId,
        storeId: input.storeId,
        priceKwd: round3(input.priceKwd),
        observedAt,
        evidence: input.evidence,
        seedSource: input.seedSource ?? null,
        confidence: round3(confidence),
        isPromo: input.isPromo ?? false,
        receiptLineId: input.receiptLineId ?? null,
        userId: input.userId ?? null,
        status,
      })
      .returning()
      .get();

    if (input.userId != null) {
      const u = tx.select().from(users).where(eq(users.id, input.userId)).get();
      if (u) {
        // contributors whose prices land inside the normal range slowly earn more weight (capped at 1.5)
        const bump = status === 'accepted' && reason === 'within_range' ? 0.01 : 0;
        tx.update(users)
          .set({ contributionCount: u.contributionCount + 1, trustWeight: Math.min(1.5, round3(u.trustWeight + bump)) })
          .where(eq(users.id, u.id))
          .run();
      }
    }

    return { observation, status, referenceMedian: ref == null ? null : round3(ref), deviation: deviation == null ? null : round3(deviation), reason, promotedObservationIds };
  });
}

// ---------------------------------------------------------------------------
// Current price estimation
// ---------------------------------------------------------------------------

export interface SourceMix {
  receipt: number;
  shelf_tag: number;
  manual: number;
  seed: number;
  /** Of the seed observations: how many are estimates vs. real web snapshots. */
  seedEstimate: number;
  seedWebSnapshot: number;
}

export interface CurrentPrice {
  productId: number;
  storeId: number;
  priceKwd: number;
  /** 0–1. Seed-only estimates top out around 0.58; fresh receipts push it towards 1. */
  trust: number;
  lastObservedAt: Date;
  observationCount: number;
  isPromo: boolean;
  sourceMix: SourceMix;
}

type ObsRow = Pick<PriceObservation, 'productId' | 'storeId' | 'priceKwd' | 'observedAt' | 'evidence' | 'confidence' | 'isPromo' | 'seedSource'> & { userTrust: number | null };

/** Pure computation used by getCurrentPrice/getPriceMatrix. `rows` must be accepted observations, newest first. */
export function estimateCurrentPrice(rows: ObsRow[], volatility: Volatility, now: Date, windowSize = CURRENT_PRICE_WINDOW): CurrentPrice | null {
  if (!rows.length) return null;
  const latest = rows[0]!;
  const promoActive = latest.isPromo && now.getTime() - latest.observedAt.getTime() <= PROMO_FRESH_DAYS * DAY_MS;
  // During an active promo, the promo prices are the current price; otherwise ignore stale promo prices.
  const pool = (promoActive
    ? rows.filter((r) => r.isPromo && now.getTime() - r.observedAt.getTime() <= PROMO_FRESH_DAYS * DAY_MS)
    : rows.filter((r) => !r.isPromo)
  ).slice(0, windowSize);
  const used = pool.length ? pool : rows.slice(0, windowSize);

  const weighted = used.map((r) => ({ r, w: trustScore(r, now, { volatility, userTrustWeight: r.userTrust ?? 1 }) }));
  const price = weightedMedian(weighted.map(({ r, w }) => ({ value: r.priceKwd, weight: w })))!;
  const maxW = Math.max(...weighted.map((x) => x.w));
  const sumW = weighted.reduce((s, x) => s + x.w, 0);
  const trust = Math.min(1, 0.7 * maxW + 0.3 * Math.min(1, sumW / 2));

  const sourceMix: SourceMix = { receipt: 0, shelf_tag: 0, manual: 0, seed: 0, seedEstimate: 0, seedWebSnapshot: 0 };
  for (const r of used) {
    sourceMix[r.evidence]++;
    if (r.evidence === 'seed') r.seedSource === 'web_snapshot' ? sourceMix.seedWebSnapshot++ : sourceMix.seedEstimate++;
  }
  return {
    productId: latest.productId,
    storeId: latest.storeId,
    priceKwd: round3(price),
    trust: round3(trust),
    lastObservedAt: latest.observedAt,
    observationCount: used.length,
    isPromo: promoActive,
    sourceMix,
  };
}

const OBS_LOOKBACK_DAYS = 60;

function fetchAccepted(db: DB, productIds: number[], storeId: number | null, now: Date): ObsRow[] {
  if (!productIds.length) return [];
  return db
    .select({
      productId: priceObservations.productId,
      storeId: priceObservations.storeId,
      priceKwd: priceObservations.priceKwd,
      observedAt: priceObservations.observedAt,
      evidence: priceObservations.evidence,
      confidence: priceObservations.confidence,
      isPromo: priceObservations.isPromo,
      seedSource: priceObservations.seedSource,
      userTrust: users.trustWeight,
    })
    .from(priceObservations)
    .leftJoin(users, eq(users.id, priceObservations.userId))
    .where(
      and(
        inArray(priceObservations.productId, productIds),
        storeId == null ? undefined : eq(priceObservations.storeId, storeId),
        eq(priceObservations.status, 'accepted'),
        gte(priceObservations.observedAt, new Date(now.getTime() - OBS_LOOKBACK_DAYS * DAY_MS)),
        lte(priceObservations.observedAt, now),
      ),
    )
    .orderBy(desc(priceObservations.observedAt))
    .all();
}

function volatilityOf(db: DB, productIds: number[]): Map<number, Volatility> {
  if (!productIds.length) return new Map();
  const rows = db
    .select({ id: products.id, v: categories.priceVolatility })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(inArray(products.id, productIds))
    .all();
  return new Map(rows.map((r) => [r.id, r.v]));
}

/** Trust-weighted current price for one product at one store (null if never observed there). */
export function getCurrentPrice(productId: number, storeId: number, opts: { now?: Date; db?: DB } = {}): CurrentPrice | null {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const vol = volatilityOf(db, [productId]).get(productId) ?? 'medium';
  return estimateCurrentPrice(fetchAccepted(db, [productId], storeId, now), vol, now);
}

export interface PriceMatrix {
  productIds: number[];
  storeIds: number[];
  /** prices[productId][storeId] → CurrentPrice (missing key = no price at that store). */
  prices: Record<number, Record<number, CurrentPrice>>;
}

/** Product × store matrix of current prices (for the optimiser and comparison UIs). */
export function getPriceMatrix(productIds: number[], opts: { now?: Date; db?: DB; storeIds?: number[] } = {}): PriceMatrix {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const ids = [...new Set(productIds)];
  const storeIds = opts.storeIds ?? db.select({ id: stores.id }).from(stores).all().map((s) => s.id);
  const vol = volatilityOf(db, ids);
  const grouped = new Map<string, ObsRow[]>();
  for (const r of fetchAccepted(db, ids, null, now)) {
    const k = `${r.productId}:${r.storeId}`;
    const arr = grouped.get(k);
    arr ? arr.push(r) : grouped.set(k, [r]);
  }
  const prices: PriceMatrix['prices'] = {};
  for (const pid of ids) prices[pid] = {};
  for (const [k, rows] of grouped) {
    const [pid, sid] = k.split(':').map(Number) as [number, number];
    if (!storeIds.includes(sid)) continue;
    const cp = estimateCurrentPrice(rows, vol.get(pid) ?? 'medium', now);
    if (cp) prices[pid]![sid] = cp;
  }
  return { productIds: ids, storeIds, prices };
}

/** 30-day min / avg / max of accepted prices for a product (all stores, or one store). */
export function priceStats(
  productId: number,
  opts: { storeId?: number; days?: number; now?: Date; db?: DB; excludeObservationId?: number } = {},
): { min: number; avg: number; max: number; count: number; minStoreId: number | null } | null {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const rows = db
    .select({ id: priceObservations.id, price: priceObservations.priceKwd, storeId: priceObservations.storeId })
    .from(priceObservations)
    .where(
      and(
        eq(priceObservations.productId, productId),
        opts.storeId == null ? undefined : eq(priceObservations.storeId, opts.storeId),
        eq(priceObservations.status, 'accepted'),
        gte(priceObservations.observedAt, new Date(now.getTime() - (opts.days ?? 30) * DAY_MS)),
        lte(priceObservations.observedAt, now),
        opts.excludeObservationId == null ? undefined : ne(priceObservations.id, opts.excludeObservationId),
      ),
    )
    .all();
  if (!rows.length) return null;
  let min = Infinity, max = -Infinity, sum = 0, minStoreId: number | null = null;
  for (const r of rows) {
    if (r.price < min) { min = r.price; minStoreId = r.storeId; }
    max = Math.max(max, r.price);
    sum += r.price;
  }
  return { min: round3(min), avg: round3(sum / rows.length), max: round3(max), count: rows.length, minStoreId };
}

/** Daily price history for charts: one point per day per store (weighted median of that day). */
export function getPriceHistory(productId: number, opts: { days?: number; storeId?: number; now?: Date; db?: DB } = {}) {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const rows = db
    .select({ storeId: priceObservations.storeId, price: priceObservations.priceKwd, at: priceObservations.observedAt, isPromo: priceObservations.isPromo, evidence: priceObservations.evidence })
    .from(priceObservations)
    .where(
      and(
        eq(priceObservations.productId, productId),
        opts.storeId == null ? undefined : eq(priceObservations.storeId, opts.storeId),
        eq(priceObservations.status, 'accepted'),
        gte(priceObservations.observedAt, new Date(now.getTime() - (opts.days ?? 30) * DAY_MS)),
      ),
    )
    .orderBy(priceObservations.observedAt)
    .all();
  return rows.map((r) => ({ storeId: r.storeId, date: r.at.toISOString().slice(0, 10), priceKwd: r.price, isPromo: r.isPromo, evidence: r.evidence }));
}
