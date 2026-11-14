/**
 * Logta (لُقطة) database schema — SQLite via Drizzle ORM.
 *
 * Design principle: the DB grows with every photo users take.
 *  - price_observations is append-only (never update a price in place).
 *  - product_aliases learns new spellings/receipt shorthands from matches.
 *  - pending_products collects unknown items until they can be promoted.
 *
 * All timestamps are stored as integer epoch milliseconds (mode: 'timestamp_ms' → JS Date).
 * All money is KWD with 3 decimals (fils), stored as REAL.
 */
import { sqliteTable, integer, real, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

const ts = (name: string) => integer(name, { mode: 'timestamp_ms' });
const bool = (name: string) => integer(name, { mode: 'boolean' });

// ---------- enums (exported as const tuples so services can reuse them) ----------
export const STORE_TYPES = ['coop', 'hypermarket', 'supermarket', 'online'] as const;
export const VOLATILITY = ['high', 'medium', 'low'] as const;
export const SIZE_UNITS = ['g', 'kg', 'ml', 'L', 'pcs'] as const;
export const PRODUCT_STATUS = ['active', 'pending'] as const;
export const CREATED_FROM = ['seed', 'receipt'] as const;
export const ALIAS_LANG = ['en', 'ar', 'mixed'] as const;
export const ALIAS_KIND = ['canonical', 'receipt_shorthand', 'colloquial', 'learned'] as const;
export const ALIAS_SOURCE = ['seed', 'ai_match', 'user_confirmed'] as const;
export const RECEIPT_STATUS = ['processed', 'partial', 'failed'] as const;
export const MATCH_METHOD = ['alias_exact', 'alias_fuzzy', 'llm', 'none'] as const;
export const LINE_STATUS = ['matched', 'needs_review', 'unmatched'] as const;
export const EVIDENCE = ['receipt', 'shelf_tag', 'manual', 'seed'] as const;
export const SEED_SOURCE = ['estimate', 'web_snapshot'] as const;
export const OBS_STATUS = ['accepted', 'quarantined', 'rejected'] as const;

export type StoreType = (typeof STORE_TYPES)[number];
export type Volatility = (typeof VOLATILITY)[number];
export type SizeUnit = (typeof SIZE_UNITS)[number];
export type AliasLang = (typeof ALIAS_LANG)[number];
export type AliasKind = (typeof ALIAS_KIND)[number];
export type AliasSource = (typeof ALIAS_SOURCE)[number];
export type MatchMethod = (typeof MATCH_METHOD)[number];
export type LineStatus = (typeof LINE_STATUS)[number];
export type Evidence = (typeof EVIDENCE)[number];
export type SeedSource = (typeof SEED_SOURCE)[number];
export type ObsStatus = (typeof OBS_STATUS)[number];

// ---------- tables ----------
export const stores = sqliteTable('stores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  type: text('type', { enum: STORE_TYPES }).notNull(),
  areaEn: text('area_en'),
  areaAr: text('area_ar'),
  lat: real('lat'),
  lng: real('lng'),
  deliveryFeeKwd: real('delivery_fee_kwd'),
  minOrderKwd: real('min_order_kwd'),
  coordsApproximate: bool('coords_approximate').notNull().default(true),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  priceVolatility: text('price_volatility', { enum: VOLATILITY }).notNull(),
});

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    brand: text('brand'),
    categoryId: integer('category_id').notNull().references(() => categories.id),
    sizeValue: real('size_value').notNull(),
    sizeUnit: text('size_unit', { enum: SIZE_UNITS }).notNull(),
    packCount: integer('pack_count').notNull().default(1),
    /** Quantity of the product (in base unit g / ml / pcs) that one "unit price" refers to: 100 (g), 1000 (ml), 1 (pcs). */
    baseQtyForUnitPrice: real('base_qty_for_unit_price').notNull(),
    substituteGroup: text('substitute_group'),
    barcode: text('barcode'),
    status: text('status', { enum: PRODUCT_STATUS }).notNull().default('active'),
    createdFrom: text('created_from', { enum: CREATED_FROM }).notNull().default('seed'),
  },
  (t) => [index('products_subgroup_idx').on(t.substituteGroup), index('products_category_idx').on(t.categoryId)],
);

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull(),
  /** Anonymous, stable per-device id sent by the app (no auth). Lets us count distinct contributors. */
  deviceId: text('device_id').unique(),
  homeLat: real('home_lat'),
  homeLng: real('home_lng'),
  contributionCount: integer('contribution_count').notNull().default(0),
  trustWeight: real('trust_weight').notNull().default(1.0),
});

export const productAliases = sqliteTable(
  'product_aliases',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id').notNull().references(() => products.id),
    aliasText: text('alias_text').notNull(),
    aliasNormalized: text('alias_normalized').notNull(),
    lang: text('lang', { enum: ALIAS_LANG }).notNull(),
    kind: text('kind', { enum: ALIAS_KIND }).notNull(),
    source: text('source', { enum: ALIAS_SOURCE }).notNull(),
    hitCount: integer('hit_count').notNull().default(0),
    storeId: integer('store_id').references(() => stores.id),
    lastSeenAt: ts('last_seen_at'),
  },
  (t) => [
    index('aliases_normalized_idx').on(t.aliasNormalized),
    index('aliases_product_idx').on(t.productId),
    uniqueIndex('aliases_unique_idx').on(t.productId, t.aliasNormalized, t.storeId),
  ],
);

export const receipts = sqliteTable('receipts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  storeId: integer('store_id').references(() => stores.id),
  storeTextRaw: text('store_text_raw'),
  purchasedAt: ts('purchased_at'),
  uploadedAt: ts('uploaded_at').notNull(),
  imageDeleted: bool('image_deleted').notNull().default(true),
  totalKwd: real('total_kwd'),
  status: text('status', { enum: RECEIPT_STATUS }).notNull(),
  llmModel: text('llm_model'),
});

export const receiptLines = sqliteTable(
  'receipt_lines',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    receiptId: integer('receipt_id').notNull().references(() => receipts.id),
    rawText: text('raw_text').notNull(),
    qty: real('qty').notNull().default(1),
    unitPriceKwd: real('unit_price_kwd'),
    lineTotalKwd: real('line_total_kwd'),
    matchedProductId: integer('matched_product_id').references(() => products.id),
    matchMethod: text('match_method', { enum: MATCH_METHOD }).notNull(),
    matchConfidence: real('match_confidence').notNull().default(0),
    status: text('status', { enum: LINE_STATUS }).notNull(),
  },
  (t) => [index('receipt_lines_receipt_idx').on(t.receiptId)],
);

export const priceObservations = sqliteTable(
  'price_observations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id').notNull().references(() => products.id),
    storeId: integer('store_id').notNull().references(() => stores.id),
    priceKwd: real('price_kwd').notNull(),
    observedAt: ts('observed_at').notNull(),
    evidence: text('evidence', { enum: EVIDENCE }).notNull(),
    seedSource: text('seed_source', { enum: SEED_SOURCE }),
    confidence: real('confidence').notNull().default(1),
    isPromo: bool('is_promo').notNull().default(false),
    receiptLineId: integer('receipt_line_id').references(() => receiptLines.id),
    userId: integer('user_id').references(() => users.id),
    status: text('status', { enum: OBS_STATUS }).notNull().default('accepted'),
  },
  (t) => [
    index('obs_product_store_time_idx').on(t.productId, t.storeId, t.observedAt),
    index('obs_status_idx').on(t.status),
  ],
);

export const pendingProducts = sqliteTable(
  'pending_products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    aliasNormalized: text('alias_normalized').notNull().unique(),
    exampleRawText: text('example_raw_text').notNull(),
    firstSeenAt: ts('first_seen_at').notNull(),
    lastSeenAt: ts('last_seen_at').notNull(),
    seenCount: integer('seen_count').notNull().default(1),
    distinctUsers: integer('distinct_users').notNull().default(0),
    distinctStores: integer('distinct_stores').notNull().default(0),
    /** JSON arrays of ids, used to compute distinct_users / distinct_stores without an extra table. */
    userIdsJson: text('user_ids_json').notNull().default('[]'),
    storeIdsJson: text('store_ids_json').notNull().default('[]'),
    proposedNameEn: text('proposed_name_en'),
    proposedNameAr: text('proposed_name_ar'),
    proposedCategoryId: integer('proposed_category_id').references(() => categories.id),
    /** AI-proposed details used for automatic promotion (see autoPromoteReady). */
    proposedBrand: text('proposed_brand'),
    proposedSizeValue: real('proposed_size_value'),
    proposedSizeUnit: text('proposed_size_unit', { enum: SIZE_UNITS }),
    /** When the AI last decided on this text (proposal or "not a product"). Later sightings skip the AI for a while. */
    aiDecidedAt: ts('ai_decided_at'),
    promotedProductId: integer('promoted_product_id').references(() => products.id),
  },
);

export const shoppingLists = sqliteTable('shopping_lists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  name: text('name').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const listItems = sqliteTable(
  'list_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    listId: integer('list_id').notNull().references(() => shoppingLists.id),
    productId: integer('product_id').notNull().references(() => products.id),
    qty: real('qty').notNull().default(1),
    allowSubstitute: bool('allow_substitute').notNull().default(true),
  },
  (t) => [index('list_items_list_idx').on(t.listId)],
);

export const watchlist = sqliteTable(
  'watchlist',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id),
    productId: integer('product_id').notNull().references(() => products.id),
    targetPriceKwd: real('target_price_kwd').notNull(),
    createdAt: ts('created_at').notNull(),
    active: bool('active').notNull().default(true),
  },
  (t) => [index('watchlist_product_idx').on(t.productId)],
);

export const alerts = sqliteTable('alerts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  watchlistId: integer('watchlist_id').notNull().references(() => watchlist.id),
  priceObservationId: integer('price_observation_id').notNull().references(() => priceObservations.id),
  triggeredAt: ts('triggered_at').notNull(),
  seen: bool('seen').notNull().default(false),
  messageEn: text('message_en').notNull(),
  messageAr: text('message_ar').notNull(),
});

// ---------- row types ----------
export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductAlias = typeof productAliases.$inferSelect;
export type NewProductAlias = typeof productAliases.$inferInsert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type ReceiptLine = typeof receiptLines.$inferSelect;
export type NewReceiptLine = typeof receiptLines.$inferInsert;
export type PriceObservation = typeof priceObservations.$inferSelect;
export type NewPriceObservation = typeof priceObservations.$inferInsert;
export type PendingProduct = typeof pendingProducts.$inferSelect;
export type NewPendingProduct = typeof pendingProducts.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ShoppingList = typeof shoppingLists.$inferSelect;
export type NewShoppingList = typeof shoppingLists.$inferInsert;
export type ListItem = typeof listItems.$inferSelect;
export type NewListItem = typeof listItems.$inferInsert;
export type WatchlistItem = typeof watchlist.$inferSelect;
export type NewWatchlistItem = typeof watchlist.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
