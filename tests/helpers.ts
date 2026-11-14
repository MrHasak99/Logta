import { createDb, setDb, type DB } from '../src/db/client.ts';
import * as s from '../src/db/schema.ts';

const DAY = 86_400_000;
export const NOW = new Date('2026-11-14T12:00:00+03:00');
export const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);

/** Fresh migrated in-memory DB, set as the active DB. */
export function memDb(): DB {
  const db = createDb(':memory:');
  setDb(db);
  return db;
}

/** Tiny hand-built world: 1 category per volatility, explicit stores and products. */
export function tinyWorld(db: DB) {
  const cat = (slug: string, v: s.Volatility) => db.insert(s.categories).values({ slug, nameEn: slug, nameAr: slug, priceVolatility: v }).returning().get();
  const cats = { dairy: cat('dairy', 'medium'), rice: cat('rice', 'low'), produce: cat('produce', 'high') };
  const store = (slug: string, type: s.StoreType, lat: number | null, lng: number | null, extra: Partial<s.NewStore> = {}) =>
    db.insert(s.stores).values({ slug, nameEn: slug, nameAr: slug, type, lat, lng, coordsApproximate: true, ...extra }).returning().get();
  const product = (slug: string, categoryId: number, sizeValue: number, sizeUnit: s.SizeUnit, group: string | null) =>
    db.insert(s.products).values({ slug, nameEn: slug, nameAr: slug, categoryId, sizeValue, sizeUnit, packCount: 1, baseQtyForUnitPrice: sizeUnit === 'pcs' ? 1 : 100, substituteGroup: group }).returning().get();
  const user = (name: string, trustWeight = 1) => db.insert(s.users).values({ displayName: name, homeLat: 29.3, homeLng: 48.0, trustWeight }).returning().get();
  return { cats, store, product, user };
}

export function obs(db: DB, productId: number, storeId: number, priceKwd: number, at: Date, extra: Partial<s.NewPriceObservation> = {}) {
  return db.insert(s.priceObservations).values({ productId, storeId, priceKwd, observedAt: at, evidence: 'seed', seedSource: 'estimate', confidence: 1, status: 'accepted', ...extra }).returning().get();
}
