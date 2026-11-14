/**
 * Price tracking & alerts: when an accepted observation drops to/below a watchlist target,
 * create a bilingual alert with 30-day min/avg/max and a "buy now vs wait" hint.
 */
import { and, desc, eq, lte, gte } from 'drizzle-orm';
import { getDb, type DB } from '../db/client.ts';
import { alerts, priceObservations, products, stores, watchlist, type Alert, type PriceObservation } from '../db/schema.ts';
import { priceStats } from './prices.ts';

/** "Buy now" if the new price is within this fraction of the 30-day minimum. */
export const BUY_NOW_TOLERANCE = 0.03;

const fmt = (n: number) => n.toFixed(3);

export interface AlertResult {
  alert: Alert;
  watchlistId: number;
  userId: number;
  hint: 'buy_now' | 'lower_seen_recently';
  stats: { min: number; avg: number; max: number };
}

/** Check a freshly recorded observation against active watchlist targets. Only `accepted` observations fire. */
export function checkAlerts(newObservation: PriceObservation, opts: { now?: Date; db?: DB } = {}): AlertResult[] {
  const db = opts.db ?? getDb();
  if (newObservation.status !== 'accepted') return [];
  const now = opts.now ?? newObservation.observedAt;

  const targets = db
    .select()
    .from(watchlist)
    .where(and(eq(watchlist.productId, newObservation.productId), eq(watchlist.active, true), gte(watchlist.targetPriceKwd, newObservation.priceKwd)))
    .all();
  if (!targets.length) return [];

  const product = db.select().from(products).where(eq(products.id, newObservation.productId)).get()!;
  const store = db.select().from(stores).where(eq(stores.id, newObservation.storeId)).get()!;
  const stats = priceStats(newObservation.productId, { days: 30, now, db }) ?? { min: newObservation.priceKwd, avg: newObservation.priceKwd, max: newObservation.priceKwd, count: 1, minStoreId: newObservation.storeId };
  const p = newObservation.priceKwd;
  const hint: AlertResult['hint'] = p <= stats.min * (1 + BUY_NOW_TOLERANCE) ? 'buy_now' : 'lower_seen_recently';
  const minStore = stats.minStoreId != null ? db.select().from(stores).where(eq(stores.id, stats.minStoreId)).get() : undefined;

  const results: AlertResult[] = [];
  for (const w of targets) {
    // don't re-alert the same watch for the same store/price within 24h
    const recent = db
      .select({ a: alerts, o: priceObservations })
      .from(alerts)
      .innerJoin(priceObservations, eq(priceObservations.id, alerts.priceObservationId))
      .where(and(eq(alerts.watchlistId, w.id), gte(alerts.triggeredAt, new Date(now.getTime() - 86_400_000)), lte(priceObservations.priceKwd, p)))
      .orderBy(desc(alerts.triggeredAt))
      .get();
    if (recent && recent.o.storeId === newObservation.storeId) continue;

    const statsEn = `30-day range: min ${fmt(stats.min)} · avg ${fmt(stats.avg)} · max ${fmt(stats.max)} KWD.`;
    const statsAr = `آخر ٣٠ يومًا: الأدنى ${fmt(stats.min)} · المتوسط ${fmt(stats.avg)} · الأعلى ${fmt(stats.max)} د.ك.`;
    const hintEn = hint === 'buy_now'
      ? 'Buy now — this is within 3% of the lowest price seen in 30 days.'
      : `A lower price was seen recently (${fmt(stats.min)} KWD${minStore ? ` at ${minStore.nameEn}` : ''}) — you may want to wait.`;
    const hintAr = hint === 'buy_now'
      ? 'ننصح بالشراء الآن — السعر ضمن ٣٪ من أدنى سعر خلال ٣٠ يومًا.'
      : `شوهد سعر أقل مؤخرًا (${fmt(stats.min)} د.ك${minStore ? ` في ${minStore.nameAr}` : ''}) — قد يستحق الانتظار.`;
    const messageEn = `${product.nameEn} is now ${fmt(p)} KWD at ${store.nameEn} (your target: ${fmt(w.targetPriceKwd)}). ${statsEn} ${hintEn}`;
    const messageAr = `${product.nameAr} أصبح الآن بسعر ${fmt(p)} د.ك في ${store.nameAr} (السعر المستهدف: ${fmt(w.targetPriceKwd)}). ${statsAr} ${hintAr}`;

    const alert = db
      .insert(alerts)
      .values({ watchlistId: w.id, priceObservationId: newObservation.id, triggeredAt: now, seen: false, messageEn, messageAr })
      .returning()
      .get();
    results.push({ alert, watchlistId: w.id, userId: w.userId, hint, stats: { min: stats.min, avg: stats.avg, max: stats.max } });
  }
  return results;
}

/** Unseen alerts for a user (newest first) — for the notifications UI. */
export function getAlertsForUser(userId: number, opts: { unseenOnly?: boolean; db?: DB } = {}) {
  const db = opts.db ?? getDb();
  return db
    .select({ alert: alerts, watch: watchlist })
    .from(alerts)
    .innerJoin(watchlist, eq(watchlist.id, alerts.watchlistId))
    .where(and(eq(watchlist.userId, userId), opts.unseenOnly ? eq(alerts.seen, false) : undefined))
    .orderBy(desc(alerts.triggeredAt))
    .all();
}

export function markAlertSeen(alertId: number, db: DB = getDb()): void {
  db.update(alerts).set({ seen: true }).where(eq(alerts.id, alertId)).run();
}
