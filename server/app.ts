/**
 * Logta API server (Node http, no framework). Run with `npm run server` (PORT, default 8787).
 * Needs a host that keeps the SQLite file between requests (Replit, Railway, Render with a disk, any VM).
 *
 * Env:
 *   OPENROUTER_API_KEY | OPENAI_API_KEY | GEMINI_API_KEY   AI provider (server-only)
 *   ALLOWED_ORIGINS   comma-separated browser origins allowed to call the API
 *                     (default: localhost dev ports + https://logta-alpha.vercel.app)
 *   ADMIN_TOKEN       required for POST /api/admin/* (if unset, admin routes only answer localhost)
 *   LOGTA_DB_PATH     SQLite file (default data/logta.db)
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { getDb, type DB } from '../src/db/client.ts';
import {
  alerts,
  categories,
  listItems,
  pendingProducts,
  priceObservations,
  productAliases,
  products,
  receiptLines,
  receipts,
  shoppingLists,
  stores,
  watchlist,
} from '../src/db/schema.ts';
import { getAlertsForUser, markAlertSeen } from '../src/lib/alerts.ts';
import { listPending } from '../src/lib/catalog-growth.ts';
import type { LlmClient } from '../src/lib/llm-client.ts';
import { parseReceiptExtraction } from '../src/lib/llm-contract.ts';
import { normalizeAlias } from '../src/lib/normalize.ts';
import { optimizeBasket, optimizeItems } from '../src/lib/optimizer.ts';
import { NoLlmConfiguredError, getOrCreateUser, processExtraction, processReceiptImage, retryNeedsReview } from '../src/lib/pipeline.ts';
import { getPriceHistory, getPriceMatrix, priceStats } from '../src/lib/prices.ts';

export const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:5179', 'http://localhost:4173', 'https://logta-alpha.vercel.app'];
const MAX_SCAN_BODY = 8 * 1024 * 1024;
const MAX_JSON_BODY = 512 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
/** Per device (tight) and per IP (loose: a whole venue/office often shares one public IP). */
export const SCAN_RATE = { perMinute: 6, perHour: 60 };
export const SCAN_RATE_PER_IP = { perMinute: 60, perHour: 600 };

export interface AppOptions {
  db?: DB;
  llm: LlmClient | null;
  allowedOrigins?: string[];
  adminToken?: string;
  now?: () => Date;
}

class HttpError extends Error {
  constructor(public status: number, message: string, public headers: Record<string, string> = {}) {
    super(message);
  }
}

// ---------------------------------------------------------------------------- helpers

const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
};

async function readJson(req: IncomingMessage, max: number): Promise<Record<string, unknown>> {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > max) throw new HttpError(413, 'Request too large');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > max) throw new HttpError(413, 'Request too large');
    chunks.push(chunk as Buffer);
  }
  if (!size) return {};
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Body must be a JSON object');
  }
}

const MAGIC: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
};

/** Only real JPEG/PNG/WEBP data URLs within the size cap. */
export function validateImage(v: unknown): string {
  if (typeof v !== 'string') throw new HttpError(400, 'imageUrl must be a data URL string');
  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(v);
  if (!m) throw new HttpError(400, 'Only JPEG, PNG or WEBP images are accepted');
  const mime = m[1] === 'image/jpg' ? 'image/jpeg' : m[1]!;
  if ((m[2]!.length * 3) / 4 > MAX_IMAGE_BYTES) throw new HttpError(413, 'Image too large');
  if (!MAGIC[mime]!(Buffer.from(m[2]!.slice(0, 24), 'base64'))) throw new HttpError(400, 'Image content does not match its type');
  return `data:${mime};base64,${m[2]}`;
}

const int = (v: unknown, name: string): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) throw new HttpError(400, `${name} must be a positive integer`);
  return n;
};
const optInt = (v: unknown, name: string): number | null => (v == null || v === '' ? null : int(v, name));
const str = (v: unknown, name: string, max = 200): string => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${name} is required`);
  return v.trim().slice(0, max);
};
const latLng = (v: unknown): { lat: number; lng: number } | null => {
  if (v == null) return null;
  const o = v as { lat?: unknown; lng?: unknown };
  if (typeof o.lat !== 'number' || typeof o.lng !== 'number' || Math.abs(o.lat) > 90 || Math.abs(o.lng) > 180) throw new HttpError(400, 'location must be {lat, lng}');
  return { lat: o.lat, lng: o.lng };
};

// ---------------------------------------------------------------------------- app

export function createApp(opts: AppOptions): Server {
  const allowed = new Set(opts.allowedOrigins ?? DEFAULT_ORIGINS);
  const now = opts.now ?? (() => new Date());
  const db = () => opts.db ?? getDb();
  const hits = new Map<string, number[]>();

  const rateLimit = (key: string, limit: { perMinute: number; perHour: number } = SCAN_RATE) => {
    const t = now().getTime();
    const recent = (hits.get(key) ?? []).filter((x) => t - x < 3_600_000);
    const minute = recent.filter((x) => t - x < 60_000);
    if (minute.length >= limit.perMinute) throw new HttpError(429, 'Too many scans, please wait a moment', { 'Retry-After': String(Math.ceil((60_000 - (t - minute[0]!)) / 1000)) });
    if (recent.length >= limit.perHour) throw new HttpError(429, 'Hourly scan limit reached', { 'Retry-After': String(Math.ceil((3_600_000 - (t - recent[0]!)) / 1000)) });
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 10_000) hits.clear();
  };

  const user = (body: Record<string, unknown> | URLSearchParams): number => {
    const deviceId = body instanceof URLSearchParams ? body.get('deviceId') : body.deviceId;
    return getOrCreateUser(str(deviceId, 'deviceId', 100), { db: db() }).id;
  };

  const isLocal = (req: IncomingMessage) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');

  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    const cors: Record<string, string> = origin && allowed.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname.replace(/\/+$/, '') || '/';
      const method = req.method ?? 'GET';

      if (method === 'OPTIONS') {
        if (!cors['Access-Control-Allow-Origin']) throw new HttpError(403, 'Origin not allowed');
        res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token', 'Access-Control-Max-Age': '600' });
        return res.end();
      }
      // Browsers from other sites are refused outright; non-browser callers (no Origin) may read but not scan.
      if (origin && !allowed.has(origin)) throw new HttpError(403, 'Origin not allowed');
      const ok = (body: unknown, status = 200) => send(res, status, body, cors);

      // ---------------- health & stats
      if (method === 'GET' && path === '/api/health') return ok({ ok: true, llm: opts.llm?.name ?? null, time: now().toISOString() });
      if (method === 'GET' && path === '/api/stats') return ok(stats(db(), now()));

      // ---------------- scanning (costs AI money → browser origin required + rate limit)
      if (method === 'POST' && (path === '/api/scan' || path === '/api/ingest')) {
        if (!origin) throw new HttpError(403, 'Scans must come from the Logta app');
        const body = await readJson(req, path === '/api/scan' ? MAX_SCAN_BODY : MAX_JSON_BODY);
        const userId = user(body);
        rateLimit(`u${userId}`);
        // behind a hosting proxy the socket address is the proxy, so prefer the forwarded client IP
        const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim() || req.socket.remoteAddress;
        rateLimit(`ip${ip}`, SCAN_RATE_PER_IP);
        const storeId = optInt(body.storeId, 'storeId');
        try {
          const report =
            path === '/api/scan'
              ? await processReceiptImage(validateImage(body.imageUrl), { userId, storeId, llm: opts.llm, now: now(), db: db() })
              : await processExtraction(parseReceiptExtraction(body.extraction), { userId, storeId, llm: opts.llm, now: now(), db: db() });
          return ok({ userId, ...report });
        } catch (e) {
          if (e instanceof NoLlmConfiguredError) throw new HttpError(503, e.message);
          if (e instanceof HttpError) throw e;
          if (e instanceof SyntaxError || (e instanceof Error && /Extraction/.test(e.message))) throw new HttpError(400, e.message);
          throw new HttpError(502, `AI extraction failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // ---------------- catalogue & prices
      if (method === 'GET' && path === '/api/stores') return ok(db().select().from(stores).all());
      if (method === 'GET' && path === '/api/categories') return ok(db().select().from(categories).all());
      if (method === 'GET' && path === '/api/products') {
        const q = normalizeAlias(url.searchParams.get('q') ?? '');
        const limit = Math.min(100, optInt(url.searchParams.get('limit'), 'limit') ?? 30);
        const rows = q
          ? db()
              .selectDistinct({ id: products.id })
              .from(productAliases)
              .innerJoin(products, eq(products.id, productAliases.productId))
              .where(and(eq(products.status, 'active'), sql`${productAliases.aliasNormalized} LIKE ${'%' + q + '%'}`))
              .limit(limit)
              .all()
          : db().select({ id: products.id }).from(products).where(eq(products.status, 'active')).limit(limit).all();
        const ids = rows.map((r) => r.id);
        const matrix = getPriceMatrix(ids, { now: now(), db: db() });
        const list = ids.length ? db().select().from(products).where(inArray(products.id, ids)).all() : [];
        return ok(list.map((p) => {
          const cells = Object.values(matrix.prices[p.id] ?? {});
          const best = cells.sort((a, b) => a.priceKwd - b.priceKwd)[0] ?? null;
          return { ...p, bestPrice: best, storeCount: cells.length };
        }));
      }
      const productMatch = /^\/api\/products\/(\d+)$/.exec(path);
      if (method === 'GET' && productMatch) {
        const id = int(productMatch[1], 'productId');
        const p = db().select().from(products).where(eq(products.id, id)).get();
        if (!p) throw new HttpError(404, 'Product not found');
        const matrix = getPriceMatrix([id], { now: now(), db: db() });
        return ok({
          product: p,
          prices: Object.values(matrix.prices[id] ?? {}).sort((a, b) => a.priceKwd - b.priceKwd),
          stats30d: priceStats(id, { now: now(), db: db() }),
          history: getPriceHistory(id, { days: 30, now: now(), db: db() }),
          aliases: db().select({ text: productAliases.aliasText, kind: productAliases.kind, source: productAliases.source, hits: productAliases.hitCount }).from(productAliases).where(eq(productAliases.productId, id)).all(),
        });
      }

      // ---------------- basket optimiser & lists
      if (method === 'POST' && path === '/api/optimize') {
        const body = await readJson(req, MAX_JSON_BODY);
        const o = { maxStores: optInt(body.maxStores, 'maxStores') ?? 3, now: now(), db: db() };
        if (body.listId != null) return ok(optimizeBasket(int(body.listId, 'listId'), latLng(body.location), o));
        const loc = latLng(body.location);
        if (!loc) throw new HttpError(400, 'location is required');
        if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new HttpError(400, 'items must be a non-empty array (max 100)');
        const items = body.items.map((it, i) => {
          const x = it as Record<string, unknown>;
          return { productId: int(x.productId, `items[${i}].productId`), qty: typeof x.qty === 'number' && x.qty > 0 ? x.qty : 1, allowSubstitute: x.allowSubstitute !== false };
        });
        return ok(optimizeItems(items, loc, o));
      }
      if (method === 'GET' && path === '/api/lists') {
        const userId = user(url.searchParams);
        return ok(db().select().from(shoppingLists).where(eq(shoppingLists.userId, userId)).all());
      }
      const listMatch = /^\/api\/lists\/(\d+)$/.exec(path);
      if (method === 'GET' && listMatch) {
        const id = int(listMatch[1], 'listId');
        const list = db().select().from(shoppingLists).where(eq(shoppingLists.id, id)).get();
        if (!list) throw new HttpError(404, 'List not found');
        const items = db().select({ item: listItems, product: products }).from(listItems).innerJoin(products, eq(products.id, listItems.productId)).where(eq(listItems.listId, id)).all();
        return ok({ ...list, items: items.map(({ item, product }) => ({ ...item, product })) });
      }
      if (method === 'POST' && path === '/api/lists') {
        const body = await readJson(req, MAX_JSON_BODY);
        const userId = user(body);
        if (!Array.isArray(body.items) || body.items.length > 100) throw new HttpError(400, 'items must be an array (max 100)');
        const list = db().insert(shoppingLists).values({ userId, name: str(body.name ?? 'My list', 'name', 80), createdAt: now() }).returning().get();
        const items = body.items.map((it, i) => {
          const x = it as Record<string, unknown>;
          return { listId: list.id, productId: int(x.productId, `items[${i}].productId`), qty: typeof x.qty === 'number' && x.qty > 0 ? x.qty : 1, allowSubstitute: x.allowSubstitute !== false };
        });
        if (items.length) db().insert(listItems).values(items).run();
        return ok({ ...list, itemCount: items.length }, 201);
      }

      // ---------------- price alerts
      if (method === 'POST' && path === '/api/watchlist') {
        const body = await readJson(req, MAX_JSON_BODY);
        const userId = user(body);
        const target = body.targetPriceKwd;
        if (typeof target !== 'number' || target <= 0) throw new HttpError(400, 'targetPriceKwd must be a positive number');
        const row = db().insert(watchlist).values({ userId, productId: int(body.productId, 'productId'), targetPriceKwd: Math.round(target * 1000) / 1000, createdAt: now(), active: true }).returning().get();
        return ok(row, 201);
      }
      if (method === 'GET' && path === '/api/watchlist') {
        const userId = user(url.searchParams);
        return ok(db().select({ watch: watchlist, product: products }).from(watchlist).innerJoin(products, eq(products.id, watchlist.productId)).where(and(eq(watchlist.userId, userId), eq(watchlist.active, true))).all());
      }
      if (method === 'GET' && path === '/api/alerts') {
        const userId = user(url.searchParams);
        return ok(getAlertsForUser(userId, { unseenOnly: url.searchParams.get('unseen') === '1', db: db() }));
      }
      const seenMatch = /^\/api\/alerts\/(\d+)\/seen$/.exec(path);
      if (method === 'POST' && seenMatch) {
        const body = await readJson(req, MAX_JSON_BODY);
        const userId = user(body);
        const id = int(seenMatch[1], 'alertId');
        const own = db().select({ id: alerts.id }).from(alerts).innerJoin(watchlist, eq(watchlist.id, alerts.watchlistId)).where(and(eq(alerts.id, id), eq(watchlist.userId, userId))).get();
        if (!own) throw new HttpError(404, 'Alert not found');
        markAlertSeen(id, db());
        return ok({ ok: true });
      }

      // ---------------- admin / maintenance
      if (method === 'POST' && path.startsWith('/api/admin/')) {
        const token = req.headers['x-admin-token'];
        if (opts.adminToken ? token !== opts.adminToken : !isLocal(req)) throw new HttpError(403, 'Admin only');
        if (path === '/api/admin/retry') return ok(await retryNeedsReview({ llm: opts.llm, now: now(), db: db() }));
        if (path === '/api/admin/pending') return ok(listPending({ db: db() }));
      }

      throw new HttpError(404, 'Not found');
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message }, { ...cors, ...e.headers });
      console.error(e);
      return send(res, 500, { error: 'Internal error' }, cors);
    }
  });
}

// ---------------------------------------------------------------------------- stats (for the pitch: "less AI over time")

export function stats(db: DB, now: Date) {
  const n = (q: { n: number } | undefined) => q?.n ?? 0;
  const since7 = new Date(now.getTime() - 7 * 86_400_000);
  const methodRows = db
    .select({ method: receiptLines.matchMethod, n: count() })
    .from(receiptLines)
    .innerJoin(receipts, eq(receipts.id, receiptLines.receiptId))
    .where(gte(receipts.uploadedAt, since7))
    .groupBy(receiptLines.matchMethod)
    .all();
  const byMethod = Object.fromEntries(methodRows.map((r) => [r.method, r.n])) as Record<string, number>;
  const lines = methodRows.reduce((a, r) => a + r.n, 0);
  const ai = byMethod.llm ?? 0;
  return {
    products: {
      total: n(db.select({ n: count() }).from(products).get()),
      grownFromReceipts: n(db.select({ n: count() }).from(products).where(eq(products.createdFrom, 'receipt')).get()),
    },
    aliases: {
      total: n(db.select({ n: count() }).from(productAliases).get()),
      learned: n(db.select({ n: count() }).from(productAliases).where(eq(productAliases.kind, 'learned')).get()),
    },
    receipts: n(db.select({ n: count() }).from(receipts).get()),
    observations: Object.fromEntries(db.select({ e: priceObservations.evidence, n: count() }).from(priceObservations).groupBy(priceObservations.evidence).all().map((r) => [r.e, r.n])),
    quarantined: n(db.select({ n: count() }).from(priceObservations).where(eq(priceObservations.status, 'quarantined')).get()),
    pendingProducts: n(db.select({ n: count() }).from(pendingProducts).where(sql`${pendingProducts.promotedProductId} IS NULL`).get()),
    last7Days: { lines, byMethod, aiShare: lines ? Math.round((ai / lines) * 1000) / 1000 : 0, freeShare: lines ? Math.round((((byMethod.alias_exact ?? 0) + (byMethod.alias_fuzzy ?? 0)) / lines) * 1000) / 1000 : 0 },
    latestReceipts: db.select({ id: receipts.id, at: receipts.uploadedAt, status: receipts.status, storeId: receipts.storeId }).from(receipts).orderBy(desc(receipts.uploadedAt)).limit(5).all(),
  };
}
