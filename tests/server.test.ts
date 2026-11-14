import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { eq } from 'drizzle-orm';
import type { DB } from '../src/db/client.ts';
import { products } from '../src/db/schema.ts';
import { seedDatabase } from '../src/db/seed.ts';
import type { LlmClient } from '../src/lib/llm-client.ts';
import { createApp, SCAN_RATE } from '../server/app.ts';
import { memDb, NOW } from './helpers.ts';

const APP = 'https://logta-alpha.vercel.app';
let db: DB;
let server: Server;
let base: string;
const PNG = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString('base64');

const fake: LlmClient = {
  name: 'fake',
  extract: async () => ({ store_text: 'MISHREF CO-OP', purchased_at: null, total_kwd: 4.75, lines: [{ raw_text: 'TILDA BSMTI 5KG', qty: 1, unit_price_kwd: 4.75, line_total_kwd: 4.75 }] }),
  choose: async () => ({ product_id: null, confidence: 0, proposed_name_en: null, proposed_name_ar: null, proposed_brand: null, proposed_category: null, proposed_size_value: null, proposed_size_unit: null }),
};

const call = (path: string, init: RequestInit & { origin?: string | null } = {}) => {
  const headers = new Headers(init.headers);
  if (init.origin !== null) headers.set('origin', init.origin ?? APP);
  if (init.body) headers.set('content-type', 'application/json');
  return fetch(base + path, { ...init, headers });
};

beforeAll(async () => {
  db = memDb();
  seedDatabase(db, { now: NOW, webSnapshotPath: '__none__.json' });
  server = createApp({ db, llm: fake, now: () => NOW });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('API server', () => {
  it('health + stats', async () => {
    expect(await (await call('/api/health')).json()).toMatchObject({ ok: true, llm: 'fake' });
    const s = (await (await call('/api/stats')).json()) as { products: { total: number }; aliases: { total: number } };
    expect(s.products.total).toBe(147);
    expect(s.aliases.total).toBeGreaterThan(500);
  });

  it('CORS: allowed origin echoed, others refused', async () => {
    const ok = await call('/api/stores');
    expect(ok.headers.get('access-control-allow-origin')).toBe(APP);
    expect((await call('/api/stores', { origin: 'https://evil.example' })).status).toBe(403);
    expect((await call('/api/stores', { method: 'OPTIONS', origin: 'https://evil.example' })).status).toBe(403);
    expect((await call('/api/stores', { method: 'OPTIONS' })).status).toBe(204);
  });

  it('POST /api/scan: photo → automatic pipeline report; refuses non-browser callers and bad images', async () => {
    const r = await call('/api/scan', { method: 'POST', body: JSON.stringify({ deviceId: 'phone-1', imageUrl: PNG }) });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { storeNameEn: string; counts: { alias_exact: number }; llmCalls: number; userId: number };
    expect(body).toMatchObject({ storeNameEn: 'Mishref Co-op', counts: { alias_exact: 1 }, llmCalls: 1 });
    expect((await call('/api/scan', { method: 'POST', origin: null, body: JSON.stringify({ deviceId: 'x', imageUrl: PNG }) })).status).toBe(403);
    expect((await call('/api/scan', { method: 'POST', body: JSON.stringify({ deviceId: 'phone-1', imageUrl: 'data:text/plain;base64,aGk=' }) })).status).toBe(400);
    expect((await call('/api/scan', { method: 'POST', body: JSON.stringify({ imageUrl: PNG }) })).status).toBe(400); // no deviceId
  });

  it('POST /api/ingest accepts an extraction from api/extract', async () => {
    const r = await call('/api/ingest', { method: 'POST', body: JSON.stringify({ deviceId: 'phone-2', extraction: { store_text: 'LULU HYPERMARKET', purchased_at: null, total_kwd: null, lines: [{ raw_text: 'ARIEL AUTO 2.5KG', qty: 1, unit_price_kwd: 3.05, line_total_kwd: 3.05 }] } }) });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ storeNameEn: 'Lulu Hypermarket', status: 'processed' });
  });

  it('rate-limits scans per device', async () => {
    let last = 0;
    for (let i = 0; i <= SCAN_RATE.perMinute; i++) last = (await call('/api/ingest', { method: 'POST', body: JSON.stringify({ deviceId: 'spammer', extraction: { lines: [] } }) })).status;
    expect(last).toBe(429);
  });

  it('products search, detail with prices/history, optimiser', async () => {
    const list = (await (await call('/api/products?q=tilda')).json()) as { slug: string; bestPrice: { priceKwd: number } | null }[];
    expect(list.map((p) => p.slug)).toContain('tilda-basmati-5kg');
    expect(list[0]!.bestPrice!.priceKwd).toBeGreaterThan(0);
    const arabic = (await (await call('/api/products?q=' + encodeURIComponent('عيش تيلدا'))).json()) as { slug: string }[];
    expect(arabic.map((p) => p.slug)).toContain('tilda-basmati-5kg');

    const id = db.select().from(products).where(eq(products.slug, 'tilda-basmati-5kg')).get()!.id;
    const detail = (await (await call(`/api/products/${id}`)).json()) as { prices: unknown[]; history: unknown[]; aliases: unknown[] };
    expect(detail.prices.length).toBeGreaterThan(3);
    expect(detail.history.length).toBeGreaterThan(10);
    expect((await call('/api/products/999999')).status).toBe(404);

    const plans = (await (await call('/api/optimize', { method: 'POST', body: JSON.stringify({ location: { lat: 29.3, lng: 48.0 }, items: [{ productId: id, qty: 1 }] }) })).json()) as { total: number }[];
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0]!.total).toBeGreaterThan(0);
    expect((await call('/api/optimize', { method: 'POST', body: JSON.stringify({ listId: 1 }) })).status).toBe(200);
  });

  it('lists, watchlist and alerts per device', async () => {
    const id = db.select().from(products).where(eq(products.slug, 'kdd-milk-ff-1l')).get()!.id;
    const created = await call('/api/lists', { method: 'POST', body: JSON.stringify({ deviceId: 'phone-3', name: 'Week', items: [{ productId: id, qty: 2 }] }) });
    expect(created.status).toBe(201);
    const lists = (await (await call('/api/lists?deviceId=phone-3')).json()) as { id: number }[];
    expect(lists).toHaveLength(1);
    expect(((await (await call(`/api/lists/${lists[0]!.id}`)).json()) as { items: unknown[] }).items).toHaveLength(1);

    expect((await call('/api/watchlist', { method: 'POST', body: JSON.stringify({ deviceId: 'phone-3', productId: id, targetPriceKwd: 0.5 }) })).status).toBe(201);
    // a scan from someone else below the target fires phone-3's alert
    const scan = await call('/api/ingest', { method: 'POST', body: JSON.stringify({ deviceId: 'phone-4', extraction: { store_text: 'MISHREF CO-OP', purchased_at: null, total_kwd: null, lines: [{ raw_text: 'KDD F/F MILK 1LTR', qty: 1, unit_price_kwd: 0.38, line_total_kwd: 0.38 }] } }) });
    expect(scan.status).toBe(200)
    const alerts = (await (await call('/api/alerts?deviceId=phone-3&unseen=1')).json()) as { alert: { id: number; messageEn: string } }[];
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.alert.messageEn).toContain('0.380 KWD');
    expect((await call(`/api/alerts/${alerts[0]!.alert.id}/seen`, { method: 'POST', body: JSON.stringify({ deviceId: 'phone-3' }) })).status).toBe(200);
    expect((await call(`/api/alerts/${alerts[0]!.alert.id}/seen`, { method: 'POST', body: JSON.stringify({ deviceId: 'someone-else' }) })).status).toBe(404);
  });

  it('admin retry works from localhost; unknown routes 404', async () => {
    expect((await call('/api/admin/retry', { method: 'POST', origin: null })).status).toBe(200);
    expect((await call('/api/nope')).status).toBe(404);
  });
});

describe('API server: alerts detail, watch delete, receipts, recent prices', () => {
  const ingest = (deviceId: string, store: string, lines: [string, number][]) =>
    call('/api/ingest', { method: 'POST', body: JSON.stringify({ deviceId, extraction: { store_text: store, purchased_at: null, total_kwd: null, lines: lines.map(([raw_text, p]) => ({ raw_text, qty: 1, unit_price_kwd: p, line_total_kwd: p })) } }) });

  it('GET /api/alerts includes product, store, triggering price, hint and 30-day stats', async () => {
    const id = db.select().from(products).where(eq(products.slug, 'tilda-basmati-5kg')).get()!.id;
    await call('/api/watchlist', { method: 'POST', body: JSON.stringify({ deviceId: 'phone-5', productId: id, targetPriceKwd: 4.6 }) });
    expect((await ingest('phone-6', 'SALWA CO-OP', [['TILDA PURE BASMATI 5KG', 4.45]])).status).toBe(200);
    const alerts = (await (await call('/api/alerts?deviceId=phone-5')).json()) as {
      product: { nameEn: string; nameAr: string }; store: { nameEn: string }; priceKwd: number; hint: string; stats: { min: number; avg: number; max: number };
    }[];
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ product: { nameEn: 'Tilda Pure Basmati Rice 5kg' }, store: { nameEn: 'Salwa Co-op' }, priceKwd: 4.45 });
    expect(['buy_now', 'lower_seen_recently']).toContain(alerts[0]!.hint);
    expect(alerts[0]!.stats.min).toBeLessThanOrEqual(4.45);
    expect(alerts[0]!.stats.max).toBeGreaterThanOrEqual(alerts[0]!.stats.avg);
    expect(alerts[0]!.product.nameAr).toContain('تيلدا');
  });

  it('DELETE /api/watchlist/:id removes only your own watch (POST …/delete also works)', async () => {
    const id = db.select().from(products).where(eq(products.slug, 'nutella-350g')).get()!.id;
    const w = (await (await call('/api/watchlist', { method: 'POST', body: JSON.stringify({ deviceId: 'phone-7', productId: id, targetPriceKwd: 1.2 }) })).json()) as { id: number };
    expect((await call('/api/watchlist', { method: 'OPTIONS' })).headers.get('access-control-allow-methods')).toContain('DELETE');
    expect((await call(`/api/watchlist/${w.id}?deviceId=someone-else`, { method: 'DELETE' })).status).toBe(404);
    expect((await call(`/api/watchlist/${w.id}?deviceId=phone-7`, { method: 'DELETE' })).status).toBe(200);
    expect(await (await call('/api/watchlist?deviceId=phone-7')).json()).toEqual([]);
    expect((await call(`/api/watchlist/${w.id}?deviceId=phone-7`, { method: 'DELETE' })).status).toBe(404);
    const w2 = (await (await call('/api/watchlist', { method: 'POST', body: JSON.stringify({ deviceId: 'phone-7', productId: id, targetPriceKwd: 1.1 }) })).json()) as { id: number };
    expect((await call(`/api/watchlist/${w2.id}/delete`, { method: 'POST', body: JSON.stringify({ deviceId: 'phone-7' }) })).status).toBe(200);
  });

  it('GET /api/receipts and /api/receipts/:id show a device\'s scans with line statuses', async () => {
    const r = (await (await ingest('phone-8', 'LULU HYPERMARKET', [['ARIEL AUTO 2.5KG', 3.05], ['KDD FF MILK 1L', 2.8], ['MYSTERY THING 9X', 1]])).json()) as { receiptId: number };
    const list = (await (await call('/api/receipts?deviceId=phone-8')).json()) as { id: number; summary: Record<string, number>; store: { nameEn: string } }[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: r.receiptId, store: { nameEn: 'Lulu Hypermarket' } });
    const detail = (await (await call(`/api/receipts/${r.receiptId}?deviceId=phone-8`)).json()) as { summary: Record<string, number>; lines: { rawText: string; status: string; product: { nameEn: string } | null; observation: { status: string } | null }[] };
    expect(detail.lines).toHaveLength(3);
    expect(detail.lines[0]).toMatchObject({ status: 'matched', product: { nameEn: 'Ariel Automatic Laundry Powder 2.5kg' }, observation: { status: 'accepted' } });
    expect(detail.lines[1]!.observation?.status).toBe('quarantined'); // 2.800 for 1L milk
    expect(detail.lines[2]).toMatchObject({ status: 'unmatched', product: null });
    expect(detail.summary).toEqual({ lines: 3, saved: 1, held: 1, waiting: 0, newItems: 1 });
    expect((await call(`/api/receipts/${r.receiptId}?deviceId=someone-else`)).status).toBe(404);
  });

  it('GET /api/prices/recent lists real scanned prices only (no seed estimates)', async () => {
    const feed = (await (await call('/api/prices/recent?limit=50')).json()) as { evidence: string; product: { nameEn: string }; store: { nameEn: string }; priceKwd: number; previousPriceKwd: number | null }[];
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((f) => f.evidence === 'receipt' || f.evidence === 'shelf_tag')).toBe(true);
    expect(feed.some((f) => f.product.nameEn === 'Ariel Automatic Laundry Powder 2.5kg' && f.store.nameEn === 'Lulu Hypermarket' && f.priceKwd === 3.05)).toBe(true);
    // the quarantined OCR error is not in the feed
    expect(feed.some((f) => f.priceKwd === 2.8)).toBe(false);
  });
});
