# Logta (لُقطة) data model & data layer

> ⚠️ **Data honesty:** every seeded price is an **ESTIMATE for demo purposes only**
> (`evidence = 'seed'`, `seed_source = 'estimate'`). The prices are plausible for Kuwait but were **not** collected from
> any store. Real prices enter only through user photos (`evidence = 'receipt' | 'shelf_tag'`) or the optional
> hand-collected `data/web_snapshot.json` (`seed_source = 'web_snapshot'`, dated). The UI should label estimates as such
> (`CurrentPrice.sourceMix` gives the breakdown).

## Quick start

```bash
npm install            # .npmrc skips native compiles; better-sqlite3 ships prebuilt binaries
npm run db:reset       # drop → migrate → seed  (SQLite file: data/logta.db, override with LOGTA_DB_PATH)
npm test               # vitest, 34 tests
npm run demo:ingest    # ingest the 4 fixture receipts and print a report  (demo:fresh = reset + ingest)
npm run typecheck:server
```

Stack: TypeScript (strict) · SQLite via `better-sqlite3` · Drizzle ORM (migrations in `drizzle/`). No servers, no
Docker, so it runs on Replit. Code lives in `src/db/` (schema, seed) and `src/lib/` (services). These are **Node-only**:
import them from API routes or server code, never from React components. `tsconfig.app.json` excludes them, so the
Vite build is unaffected.

## Using it from the API layer

```ts
import { ingestReceipt, resolveLineWithLlm, optimizeBasket, getPriceMatrix, getCurrentPrice,
         getPriceHistory, getAlertsForUser, parseReceiptExtraction, EXTRACTION_SYSTEM_PROMPT,
         MATCH_SYSTEM_PROMPT, buildMatchUserMessage, parseLlmMatchChoice } from './src/lib/index.ts';

// Feature 1: receipt / shelf-tag scan
const extraction = parseReceiptExtraction(llmJson);          // LLM call 1 output
const report = ingestReceipt(extraction, { userId, llmModel: 'claude-…' });
for (const line of report.lines.filter(l => l.needsLLM)) {   // usually few lines, fewer over time
  const choice = parseLlmMatchChoice(await llm(MATCH_SYSTEM_PROMPT, buildMatchUserMessage(line.rawText, line.candidates!)), line.candidates!);
  resolveLineWithLlm(line.lineId, choice.product_id, { confidence: choice.confidence,
    proposedNameEn: choice.proposed_name_en, proposedNameAr: choice.proposed_name_ar });
}
// report.alerts → notifications; report.lines[].observation.status → 'quarantined' badges

// Feature 2: basket optimiser
const plans = optimizeBasket(listId);                 // defaults to the list owner's home; or pass {lat,lng}
// plans[i]: { stores, itemsPerStore, subtotal, travelCost, total, savingsVsBestSingleStore, missingItems, substitutions, avgTrust }

// Feature 3: price tracking
getCurrentPrice(productId, storeId);   // { priceKwd, trust, lastObservedAt, observationCount, isPromo, sourceMix }
getPriceHistory(productId, { days: 30 });
getAlertsForUser(userId, { unseenOnly: true });
```

## Tables

| table | purpose | notes |
|---|---|---|
| `stores` | 8 co-ops, Lulu (Al-Rai), Carrefour (Avenues), TSC (Salmiya), Taw9eel (online) | `coords_approximate = true`; online stores have `delivery_fee_kwd` / `min_order_kwd` and no coordinates |
| `categories` | 16 categories | `price_volatility` (high/medium/low) drives how fast trust decays |
| `products` | canonical catalogue (147 seeded) | `substitute_group` links interchangeable products (e.g. `milk_full_fat_1L`); `base_qty_for_unit_price` = 100 g / 1000 ml / 1 pc; `created_from = 'receipt'` for promoted items |
| `product_aliases` | **the self-learning part** (~4 per product) | kinds: canonical / receipt_shorthand / colloquial / learned; `store_id` for chain-specific shorthand; `hit_count`, `last_seen_at` |
| `receipts`, `receipt_lines` | every scan and its lines | `image_deleted` defaults to true (images are never kept); each line records `match_method` + `match_confidence` |
| `price_observations` | **append-only** price facts | `evidence`, `seed_source`, `confidence`, `is_promo`, `status` (accepted/quarantined/rejected). Prices are never updated in place; only the status changes |
| `pending_products` | unknown items waiting for promotion | `seen_count`, `distinct_users`, `distinct_stores`, proposed names from the LLM |
| `users` | demo users (no auth) | `trust_weight` rises slowly (+0.01, capped at 1.5) with in-range contributions |
| `shopping_lists`, `list_items` | baskets | `allow_substitute` per item |
| `watchlist`, `alerts` | price targets and fired alerts | bilingual `message_en` / `message_ar` |

Key indexes: `price_observations(product_id, store_id, observed_at)`, `product_aliases(alias_normalized)`,
`products(substitute_group)`.

## Services (`src/lib/`)

| function | what it does |
|---|---|
| `normalizeAlias(text)` | lowercase, strip punctuation and Latin accents; ٠-٩ → 0-9; أ/إ/آ→ا, ة→ه, ى→ي; remove tatweel/diacritics; split `1ltr` → `1 l`; unify units (ltr/lt/لتر → l, gm/جم/غرام → g, kg/كجم/كيلو → kg, pcs/حبة → pcs) |
| `matchLine(raw, storeId?)` | cascade: **exact alias** (store-specific first) → **fuzzy** (token Jaro-Winkler + consonant skeleton + trigram Dice, size must agree, ≥0.82 with a margin) → `{ needsLLM, candidates: top 10 }`. A confident fuzzy or LLM match (≥0.85) **inserts a learned alias** |
| `recordObservation(obs)` | median of accepted prices for that product/store over 30 days; >35% off → `quarantined`; an independent observation (different user or receipt) within 25% auto-accepts it; no history → accepted with confidence × 0.7 |
| `trustScore(obs, now)` | `evidenceWeight × exp(−ageDays/τ) × confidence × userTrustWeight`; weights receipt 1.0, shelf_tag 0.85, manual 0.5, seed 0.4; τ = 3/10/30 days for high/medium/low volatility |
| `getCurrentPrice` / `getPriceMatrix` | trust-weighted median of the latest 10 accepted observations. A fresh promo (≤3 days) is the current price; stale promos are ignored. `trust` = 0.7·max + 0.3·mass, so seed-only estimates top out around 0.58 and fresh receipts approach 1 |
| `optimizeBasket(listId, loc, opts)` | all 1–3-store combinations; each item goes to the cheapest store in the combo; same-group substitution by unit price only when the item is missing; travel = best-order round trip × 1.3 road factor × 0.008 KWD/km (+ optional time cost); online = delivery fee, min order enforced; returns the top 3 |
| `checkAlerts(obs)` | accepted observation ≤ target → alert with 30-day min/avg/max; "buy now" if within 3% of the 30-day minimum, otherwise "a lower price was seen recently" |
| `ingestUnmatched` / `promotePending` | upsert unknown text; ready when `seen_count ≥ 3` and `distinct_users ≥ 2`; promotion creates the product and its aliases |
| `ingestReceipt` / `resolveLineWithLlm` | the end-to-end pipeline used by the API |
| `llm-contract.ts` | types, JSON schemas and the exact system prompts for LLM call 1 (extraction) and call 2 (choose a candidate or null). This layer never calls an LLM |

## Seed (`src/db/seed.ts`, deterministic: mulberry32 RNG)
- 12 stores, 16 categories, 147 products from brands common in Kuwait (KDD, Almarai, KFM, Tilda, Afia, Al Alali,
  Rawdatain, Fairy, Ariel, Clorox, Fine, Sadia, Puck, Lurpak, Nescafé, Lipton, Indomie, Vimto…), several per substitute group.
- ~600 aliases: EN and AR canonical names, receipt shorthand, colloquial Kuwaiti (`عيش` rice, `دياي` chicken, `ماي` water,
  `روب` yoghurt, `شكر` sugar, `طماط` tomato), plus 5 store-specific shorthands. Brands with an uncertain Arabic spelling
  keep the Latin brand name plus a correct Arabic description.
- ~41k observations over 60 days, with ~85% of products stocked per store (fewer bulky items at TSC/online). Price model:
  base price × store index (co-ops cheaper on staples, hypermarkets on bulk/household, TSC +10%, online +5%) × per-store
  offset × noise; occasional permanent price changes; produce follows a 14-day market wave; **co-op weekly promos**
  (~15% of products, 10–25% off, Thu–Sat, `is_promo`). Observed daily for produce and every 2–3 days otherwise.
- 25 demo receipt observations from 3 users over the last 10 days; 2 shopping lists (15 and 6 items); 3 watchlist items.
- `data/web_snapshot.json` importer (`src/db/import-web-snapshot.ts`) runs during the seed if the file exists. Its
  header comment documents the file format.

---

## The self-learning loop (one page, for the pitch)

```
   📸 photo ──► LLM extracts lines ──► matchLine()
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
        exact alias hit            fuzzy match (≥0.85)        no confident match
        (free, instant)            → ✨ learn alias           → LLM picks from 10 candidates
              │                          │                     → ✨ learn alias
              │                          │                     → or null → pending_products
              ▼                          ▼                          ▼
        price observation ──► outlier check ──► trust-weighted current price ──► alerts / optimiser
                                                                         │
                         3 sightings by 2+ users ──► 🌱 new product in the catalogue
```

**1. Every photo teaches the system a new spelling.** Receipts are full of shorthand (`ALM FF MLK 1L`,
`حليب ك.د.د كامل 1ل`). The first time we see one, fuzzy matching or the LLM resolves it. From then on it's an exact alias
lookup: zero AI cost, instant, and store-aware. In the demo, receipt 4 hits the lines that needed AI in receipts 2–3 as
exact matches. **"The more photos people take, the less AI we need."**

**2. Every photo makes prices more accurate.** Observations are append-only facts with a trust score: real receipts
outweigh estimates, and old prices fade, faster for tomatoes (τ = 3 days) than for rice (τ = 30 days). Seed estimates
alone never look more than "medium" trusted; a fresh receipt pushes a price towards full trust.

**3. Bad data protects itself.** An OCR slip (0.280 read as 2.800) is quarantined instead of corrupting prices. A real
price jump is accepted once a second, independent shopper confirms it.

**4. The catalogue grows itself.** Unknown items collect sightings; after 3 sightings by 2+ users they're promoted to
real products with their receipt text as the first alias.

**5. Everyone benefits from everyone.** One shopper's receipt updates the price matrix for the basket optimiser and
fires another shopper's price alert.

## Known gaps / next steps
- No auth: `users` are demo personas; API routes should pass `userId`.
- `resolveStore` matches header keywords for the 12 seeded stores only; unknown stores leave `store_id` null
  (lines are matched, but no prices are recorded) until the user picks the store (`ingestReceipt(…, { storeId })`).
- Matching loads all aliases per line (fine for ~1k aliases). Cache or index trigrams if the catalogue grows to many thousands.
- `rejected` observation status exists but nothing sets it yet (reserved for moderation).
- Store coordinates are approximate, and travel cost is a straight-line × 1.3 estimate, not routing.
