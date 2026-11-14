/**
 * Deterministic seed (seeded RNG): catalogue + ~60 days of ESTIMATED price history + demo users/lists.
 *
 *   npm run db:seed    → wipe all rows and reseed the existing DB
 *   npm run db:reset   → delete the DB file, migrate, seed
 *
 * ⚠️ Every seeded price is labelled evidence='seed', seed_source='estimate' (or 'web_snapshot' when imported
 * from data/web_snapshot.json). They are plausible demo values, NOT real store prices.
 */
import { pathToFileURL } from 'node:url';
import { sql } from 'drizzle-orm';
import { createDb, type DB } from './client.ts';
import * as s from './schema.ts';
import { CATEGORIES, DEMO_LISTS, DEMO_USERS, DEMO_WATCHLIST, PRODUCTS, STORE_ALIASES, STORES, type ProductSeed, type StoreSeed } from './seed-data.ts';
import { detectLang, normalizeAlias } from '../lib/normalize.ts';
import { importWebSnapshot } from './import-web-snapshot.ts';

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 60;

// ---------- seeded RNG (mulberry32) ----------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const to5fils = (n: number) => Math.max(0.005, Math.round(n * 200) / 200);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
/** Day of week in Kuwait (UTC+3): 0 = Sunday … 4 = Thursday, 5 = Friday, 6 = Saturday. */
const kuwaitDow = (ms: number) => new Date(ms + 3 * 3_600_000).getUTCDay();

const STAPLES = new Set(['dairy_eggs', 'bakery', 'rice_grains', 'oil_ghee', 'sugar_flour_baking']);
const BULK_CATS = new Set(['household_cleaning', 'paper_tissue', 'baby', 'beverages_water']);

/** Store price index: co-ops cheaper on staples, hypermarkets on bulk/household, TSC premium, online slightly higher. */
function storeIndex(store: StoreSeed, p: ProductSeed): number {
  const bulky = p.bulk || BULK_CATS.has(p.category);
  switch (store.type) {
    case 'coop':
      return STAPLES.has(p.category) ? 0.96 : p.category === 'produce' ? 0.98 : 1.0;
    case 'hypermarket':
      if (bulky) return store.slug.startsWith('lulu') ? 0.93 : 0.95;
      if (p.category === 'produce') return 0.95;
      return store.slug.startsWith('lulu') ? 0.99 : 1.0;
    case 'supermarket':
      return 1.1;
    case 'online':
      return 1.05;
  }
}

/** Product×store pairs the demo fixtures rely on — always stocked so the demo is reproducible. */
const FORCE_STOCK: Record<string, string[]> = {
  'coop-mishref': ['kdd-milk-ff-1l', 'almarai-milk-ff-1l', 'tilda-basmati-5kg', 'kfm-arabic-bread-white', 'afia-corn-oil-1.8l', 'tomato-1kg'],
  'coop-salwa': ['tilda-basmati-5kg', 'sadia-whole-chicken-1000g', 'almarai-laban-1l', 'pepsi-can-330-6', 'fairy-lemon-750ml', 'lipton-yellow-label-100'],
  'lulu-alrai': ['almarai-milk-ff-1l', 'kdd-milk-ff-1l', 'ariel-powder-2.5kg', 'nido-powder-1.8kg', 'headshoulders-shampoo-400ml', 'tilda-basmati-5kg'],
  'carrefour-avenues': ['headshoulders-shampoo-400ml', 'almarai-laban-1l', 'fairy-lemon-750ml', 'clorox-bleach-3.78l', 'tomato-1kg', 'alalali-tuna-185g'],
};

interface PairModel {
  productIdx: number;
  storeIdx: number;
  regular: number; // base × store index × offset
  changeDayAgo: number | null; // permanent price change happened this many days ago
  changeFactor: number;
}

export interface SeedStats {
  stores: number;
  categories: number;
  products: number;
  aliases: number;
  observations: number;
  receiptObservations: number;
  promoObservations: number;
  webSnapshotObservations: number;
  users: number;
  shoppingLists: number;
  watchlist: number;
  dateRange: { from: string; to: string };
}

/** Delete every row (child tables first). */
export function wipe(db: DB): void {
  for (const t of ['alerts', 'watchlist', 'list_items', 'shopping_lists', 'price_observations', 'receipt_lines', 'receipts', 'pending_products', 'product_aliases', 'products', 'categories', 'users', 'stores']) {
    db.run(sql.raw(`DELETE FROM ${t}`));
  }
  db.run(sql.raw(`DELETE FROM sqlite_sequence`));
}

export function seedDatabase(db: DB, opts: { now?: Date; rngSeed?: number; webSnapshotPath?: string } = {}): SeedStats {
  const now = opts.now ?? new Date();
  const rng = mulberry32(opts.rngSeed ?? 20261114);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
  const sqlite = db.$client;

  wipe(db);

  // ---------- reference data ----------
  const catIds = new Map<string, number>();
  for (const c of CATEGORIES) {
    const r = db.insert(s.categories).values({ slug: c.slug, nameEn: c.nameEn, nameAr: c.nameAr, priceVolatility: c.volatility }).returning({ id: s.categories.id }).get();
    catIds.set(c.slug, r.id);
  }
  const storeIds = new Map<string, number>();
  for (const st of STORES) {
    const r = db
      .insert(s.stores)
      .values({ slug: st.slug, nameEn: st.nameEn, nameAr: st.nameAr, type: st.type, areaEn: st.areaEn, areaAr: st.areaAr, lat: st.lat, lng: st.lng, deliveryFeeKwd: st.deliveryFeeKwd, minOrderKwd: st.minOrderKwd, coordsApproximate: true })
      .returning({ id: s.stores.id })
      .get();
    storeIds.set(st.slug, r.id);
  }

  const productIds = new Map<string, number>();
  const aliasRows: s.NewProductAlias[] = [];
  const seenAlias = new Set<string>();
  const addAlias = (productId: number, text: string, kind: s.AliasKind, storeId: number | null = null) => {
    const norm = normalizeAlias(text);
    const key = `${productId}|${norm}|${storeId ?? ''}`;
    if (!norm || seenAlias.has(key)) return;
    seenAlias.add(key);
    aliasRows.push({ productId, aliasText: text, aliasNormalized: norm, lang: detectLang(text), kind, source: 'seed', hitCount: 0, storeId });
  };

  db.transaction((tx) => {
    for (const p of PRODUCTS) {
      const unitKind = p.sizeUnit === 'pcs' ? 1 : p.sizeUnit === 'g' || p.sizeUnit === 'kg' ? 100 : 1000;
      const r = tx
        .insert(s.products)
        .values({
          slug: p.slug, nameEn: p.nameEn, nameAr: p.nameAr, brand: p.brand, categoryId: catIds.get(p.category)!,
          sizeValue: p.sizeValue, sizeUnit: p.sizeUnit, packCount: p.packCount, baseQtyForUnitPrice: unitKind,
          substituteGroup: p.substituteGroup, barcode: null, status: 'active', createdFrom: 'seed',
        })
        .returning({ id: s.products.id })
        .get();
      productIds.set(p.slug, r.id);
      addAlias(r.id, p.nameEn, 'canonical');
      addAlias(r.id, p.nameAr, 'canonical');
      for (const a of p.aliases) {
        if (a.startsWith('~')) addAlias(r.id, a.slice(1), 'colloquial');
        else addAlias(r.id, a, 'receipt_shorthand');
      }
    }
    for (const sa of STORE_ALIASES) addAlias(productIds.get(sa.product)!, sa.text, 'receipt_shorthand', storeIds.get(sa.store)!);
    for (let i = 0; i < aliasRows.length; i += 200) tx.insert(s.productAliases).values(aliasRows.slice(i, i + 200)).run();
  });

  const userIds: number[] = [];
  for (const u of DEMO_USERS) {
    userIds.push(db.insert(s.users).values({ displayName: u.displayName, homeLat: u.homeLat, homeLng: u.homeLng, trustWeight: u.trustWeight }).returning({ id: s.users.id }).get().id);
  }

  // ---------- price model ----------
  const pairs: PairModel[] = [];
  const stockedAt = new Map<number, number[]>(); // productIdx → storeIdx[]
  PRODUCTS.forEach((p, pi) => {
    const stocked: number[] = [];
    STORES.forEach((st, si) => {
      let prob = 0.85;
      if ((st.type === 'supermarket' || st.type === 'online') && p.bulk) prob = 0.5;
      if (FORCE_STOCK[st.slug]?.includes(p.slug)) prob = 1;
      if (rng() < prob) stocked.push(si);
    });
    while (stocked.length < 3) {
      const si = Math.floor(rng() * STORES.length);
      if (!stocked.includes(si)) stocked.push(si);
    }
    stockedAt.set(pi, stocked);
    for (const si of stocked) {
      const offset = 1 + (rng() - 0.5) * 0.08;
      const changes = rng() < 0.2;
      pairs.push({
        productIdx: pi,
        storeIdx: si,
        regular: p.basePrice * storeIndex(STORES[si]!, p) * offset,
        changeDayAgo: changes ? 5 + Math.floor(rng() * 50) : null,
        changeFactor: changes ? (rng() < 0.75 ? 1.03 + rng() * 0.05 : 0.95 + rng() * 0.02) : 1,
      });
    }
  });

  // produce market factor (shared across stores): smooth seasonal wave + daily wobble
  const producePhase = PRODUCTS.map(() => rng() * Math.PI * 2);
  const marketFactor = (pi: number, dayAgo: number) => 1 + 0.08 * Math.sin((2 * Math.PI * dayAgo) / 14 + producePhase[pi]!);

  // co-op weekly promotions: for each co-op & week, ~15% of its products are 10–25% off Thu–Sat
  const promo = new Map<string, number>(); // `${pi}:${si}:${week}` → discount
  const weekOf = (dayAgo: number) => Math.floor(dayAgo / 7);
  STORES.forEach((st, si) => {
    if (st.type !== 'coop') return;
    for (let w = 0; w <= Math.ceil(HISTORY_DAYS / 7); w++) {
      PRODUCTS.forEach((p, pi) => {
        if (p.category === 'produce' || !stockedAt.get(pi)!.includes(si)) return;
        if (rng() < 0.15) promo.set(`${pi}:${si}:${w}`, 0.1 + rng() * 0.15);
      });
    }
  });

  const regularPriceAt = (pm: PairModel, dayAgo: number, noise: number): number => {
    const p = PRODUCTS[pm.productIdx]!;
    let price = pm.regular;
    if (pm.changeDayAgo != null && dayAgo <= pm.changeDayAgo) price *= pm.changeFactor;
    if (p.category === 'produce') price *= marketFactor(pm.productIdx, dayAgo);
    return price * noise;
  };

  const insertObs = sqlite.prepare(
    `INSERT INTO price_observations (product_id, store_id, price_kwd, observed_at, evidence, seed_source, confidence, is_promo, receipt_line_id, user_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted')`,
  );

  let observations = 0, promoObservations = 0;
  let minTs = Infinity, maxTs = -Infinity;
  const pairByKey = new Map<string, PairModel>();
  sqlite.transaction(() => {
    for (const pm of pairs) {
      const p = PRODUCTS[pm.productIdx]!;
      pairByKey.set(`${pm.productIdx}:${pm.storeIdx}`, pm);
      const vol = CATEGORIES.find((c) => c.slug === p.category)!.volatility;
      const highVol = vol === 'high';
      const noiseAmp = highVol ? 0.06 : 0.01;
      // observation days: daily for high volatility, every 2–3 days otherwise, plus every promo day
      const days = new Set<number>();
      for (let d = HISTORY_DAYS - 1 - Math.floor(rng() * 3); d >= 0; d -= highVol ? 1 : 2 + Math.floor(rng() * 2)) days.add(d);
      for (let d = 0; d < HISTORY_DAYS; d++) {
        const ts = now.getTime() - d * DAY_MS;
        const dow = kuwaitDow(ts);
        if ((dow === 4 || dow === 6) && promo.has(`${pm.productIdx}:${pm.storeIdx}:${weekOf(d)}`)) days.add(d);
      }
      for (const d of days) {
        const ts = now.getTime() - d * DAY_MS - Math.floor(rng() * 6 * 3_600_000) - 600_000;
        const dow = kuwaitDow(ts);
        const discount = dow >= 4 && dow <= 6 ? promo.get(`${pm.productIdx}:${pm.storeIdx}:${weekOf(d)}`) : undefined;
        let price = regularPriceAt(pm, d, 1 + (rng() - 0.5) * 2 * noiseAmp);
        if (discount) price *= 1 - discount;
        insertObs.run(productIds.get(p.slug)!, storeIds.get(STORES[pm.storeIdx]!.slug)!, to5fils(price), ts, 'seed', 'estimate', 1, discount ? 1 : 0, null, null);
        observations++;
        if (discount) promoObservations++;
        minTs = Math.min(minTs, ts);
        maxTs = Math.max(maxTs, ts);
      }
    }
  })();

  // ---------- demo receipts (~25 receipt observations from 3 users, last 10 days) ----------
  const receiptPlan: { user: number; store: string; daysAgo: number }[] = [
    { user: 0, store: 'coop-salwa', daysAgo: 9 },
    { user: 1, store: 'coop-jabriya', daysAgo: 7 },
    { user: 2, store: 'coop-khaldiya', daysAgo: 5 },
    { user: 0, store: 'lulu-alrai', daysAgo: 3 },
    { user: 1, store: 'carrefour-avenues', daysAgo: 1 },
  ];
  let receiptObservations = 0;
  const shorthandOf = (p: ProductSeed) => p.aliases.find((a) => !a.startsWith('~') && !/[؀-ۿ]/.test(a)) ?? p.nameEn;
  for (const rp of receiptPlan) {
    const si = STORES.findIndex((x) => x.slug === rp.store);
    const at = new Date(now.getTime() - rp.daysAgo * DAY_MS - 4 * 3_600_000);
    const candidates = PRODUCTS.map((_, pi) => pi).filter((pi) => stockedAt.get(pi)!.includes(si));
    const chosen = new Set<number>();
    while (chosen.size < 5) chosen.add(pick(candidates));
    const lines = [...chosen].map((pi) => {
      const pm = pairByKey.get(`${pi}:${si}`)!;
      const qty = PRODUCTS[pi]!.category === 'produce' ? round3(0.5 + rng() * 1.5) : 1 + Math.floor(rng() * 2);
      const unit = to5fils(regularPriceAt(pm, rp.daysAgo, 1 + (rng() - 0.5) * 0.02));
      return { pi, qty, unit, total: round3(qty * unit) };
    });
    const receipt = db
      .insert(s.receipts)
      .values({
        userId: userIds[rp.user]!, storeId: storeIds.get(rp.store)!, storeTextRaw: STORES[si]!.nameEn.toUpperCase(),
        purchasedAt: at, uploadedAt: at, imageDeleted: true, totalKwd: round3(lines.reduce((a, l) => a + l.total, 0)), status: 'processed', llmModel: 'seed-demo',
      })
      .returning({ id: s.receipts.id })
      .get();
    for (const l of lines) {
      const p = PRODUCTS[l.pi]!;
      const line = db
        .insert(s.receiptLines)
        .values({ receiptId: receipt.id, rawText: shorthandOf(p), qty: l.qty, unitPriceKwd: l.unit, lineTotalKwd: l.total, matchedProductId: productIds.get(p.slug)!, matchMethod: 'alias_exact', matchConfidence: 1, status: 'matched' })
        .returning({ id: s.receiptLines.id })
        .get();
      insertObs.run(productIds.get(p.slug)!, storeIds.get(rp.store)!, l.unit, at.getTime(), 'receipt', null, 0.95, 0, line.id, userIds[rp.user]!);
      receiptObservations++;
    }
    db.update(s.users).set({ contributionCount: sql`${s.users.contributionCount} + ${lines.length}` }).where(sql`${s.users.id} = ${userIds[rp.user]!}`).run();
  }

  // ---------- shopping lists & watchlist ----------
  for (const l of DEMO_LISTS) {
    const list = db.insert(s.shoppingLists).values({ userId: userIds[l.user]!, name: l.name, createdAt: now }).returning({ id: s.shoppingLists.id }).get();
    db.insert(s.listItems).values(l.items.map(([slug, qty, allowSubstitute]) => ({ listId: list.id, productId: productIds.get(slug)!, qty, allowSubstitute }))).run();
  }
  for (const [u, slug, target] of DEMO_WATCHLIST) {
    db.insert(s.watchlist).values({ userId: userIds[u]!, productId: productIds.get(slug)!, targetPriceKwd: target, createdAt: new Date(now.getTime() - 14 * DAY_MS), active: true }).run();
  }

  // ---------- optional real prices ----------
  const snap = importWebSnapshot(db, { path: opts.webSnapshotPath });

  const count = (t: string) => (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  return {
    stores: count('stores'),
    categories: count('categories'),
    products: count('products'),
    aliases: count('product_aliases'),
    observations: count('price_observations'),
    receiptObservations,
    promoObservations,
    webSnapshotObservations: snap.imported,
    users: count('users'),
    shoppingLists: count('shopping_lists'),
    watchlist: count('watchlist'),
    dateRange: { from: new Date(minTs).toISOString().slice(0, 10), to: new Date(maxTs).toISOString().slice(0, 10) },
  };
}

export function printSeedStats(st: SeedStats): void {
  console.log('\n🌱 Logta seed complete (prices are ESTIMATES for demo purposes)');
  console.table({
    stores: st.stores,
    categories: st.categories,
    products: st.products,
    aliases: st.aliases,
    'price observations': st.observations,
    '  of which promo (co-op Thu–Sat)': st.promoObservations,
    '  of which demo receipts': st.receiptObservations,
    '  of which web_snapshot': st.webSnapshotObservations,
    users: st.users,
    'shopping lists': st.shoppingLists,
    'watchlist items': st.watchlist,
  });
  console.log(`Date range: ${st.dateRange.from} → ${st.dateRange.to}\n`);
}

// CLI: `tsx src/db/seed.ts`
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const db = createDb();
  printSeedStats(seedDatabase(db));
  db.$client.close();
}
