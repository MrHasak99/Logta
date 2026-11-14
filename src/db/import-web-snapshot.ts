/**
 * Optional importer for REAL prices captured manually from public web pages before the event
 * (data/web_snapshot.json). Rows are stored with evidence='seed', seed_source='web_snapshot'
 * and observed_at = the snapshot date, so the UI can label them honestly.
 *
 * Expected file shape:
 * {
 *   "snapshot_date": "2026-11-10",
 *   "note": "Captured by hand from public store pages",
 *   "prices": [
 *     { "product_slug": "tilda-basmati-5kg", "store_slug": "lulu-alrai", "price_kwd": 4.85, "is_promo": false },
 *     { "product_name": "Almarai Fresh Milk Full Fat 1L", "store_slug": "carrefour-avenues", "price_kwd": 0.425 }
 *   ]
 * }
 * Runs as part of the seed; also `tsx src/db/import-web-snapshot.ts [path]`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import { createDb, type DB } from './client.ts';
import { priceObservations, products, stores } from './schema.ts';
import { matchLine } from '../lib/matching.ts';

export interface WebSnapshotFile {
  snapshot_date: string;
  note?: string;
  prices: { product_slug?: string; product_name?: string; store_slug: string; price_kwd: number; is_promo?: boolean }[];
}

export const DEFAULT_SNAPSHOT_PATH = resolve(process.cwd(), 'data', 'web_snapshot.json');

export function importWebSnapshot(db: DB, opts: { path?: string } = {}): { imported: number; skipped: { row: unknown; reason: string }[]; found: boolean } {
  const path = opts.path ?? DEFAULT_SNAPSHOT_PATH;
  if (!existsSync(path)) return { imported: 0, skipped: [], found: false };
  const file = JSON.parse(readFileSync(path, 'utf8')) as WebSnapshotFile;
  const observedAt = new Date(`${file.snapshot_date}T12:00:00+03:00`);
  if (Number.isNaN(observedAt.getTime())) throw new Error(`web_snapshot.json: invalid snapshot_date "${file.snapshot_date}"`);
  const skipped: { row: unknown; reason: string }[] = [];
  let imported = 0;
  for (const row of file.prices ?? []) {
    const store = db.select().from(stores).where(eq(stores.slug, row.store_slug)).get();
    if (!store) { skipped.push({ row, reason: 'unknown store_slug' }); continue; }
    let productId: number | null = null;
    if (row.product_slug) productId = db.select().from(products).where(eq(products.slug, row.product_slug)).get()?.id ?? null;
    if (productId == null && row.product_name) {
      const m = matchLine(row.product_name, { storeId: store.id, learn: false, db });
      if (!m.needsLLM) productId = m.productId;
    }
    if (productId == null) { skipped.push({ row, reason: 'product not found' }); continue; }
    if (!(row.price_kwd > 0)) { skipped.push({ row, reason: 'invalid price' }); continue; }
    db.insert(priceObservations)
      .values({ productId, storeId: store.id, priceKwd: Math.round(row.price_kwd * 1000) / 1000, observedAt, evidence: 'seed', seedSource: 'web_snapshot', confidence: 0.9, isPromo: row.is_promo ?? false, status: 'accepted' })
      .run();
    imported++;
  }
  return { imported, skipped, found: true };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const db = createDb();
  const res = importWebSnapshot(db, { path: process.argv[2] });
  console.log(res.found ? `Imported ${res.imported} web_snapshot prices, skipped ${res.skipped.length}` : 'No web_snapshot.json found — nothing to import.');
  for (const s of res.skipped) console.log('  skipped:', s.reason, JSON.stringify(s.row));
}
