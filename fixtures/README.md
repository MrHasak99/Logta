# Demo receipt fixtures

Four sample receipts, shaped **exactly** like the LLM extraction output
(`ReceiptExtraction` in `src/lib/llm-contract.ts`):

```json
{ "store_text": "...", "purchased_at": "...", "lines": [{ "raw_text": "...", "qty": 1, "unit_price_kwd": 0.385, "line_total_kwd": 0.385 }], "total_kwd": 0.385 }
```

Use them to (a) test the API without a camera, or (b) print or recreate them as paper receipts and photograph them live.

```bash
npm run demo:fresh     # reset DB + ingest all 4 (same as db:reset then demo:ingest)
```

> The demo script swaps in "now minus a few hours" for `purchased_at`, so the demo looks fresh on any day.
> Lines the alias cascade can't resolve go to a **mock LLM** (a fixed answer table in `scripts/demo-ingest.ts`).
> No real LLM is called.

| # | File | Store / uploader | What it demonstrates |
|---|------|------------------|----------------------|
| 1 | `01-mishref-coop.json` | Mishref Co-op · Umm Khalid | **The happy path.** Mixed Arabic/English (`حليب KDD كامل ١ لتر`), Arabic with Arabic-Indic digits (`حليب المراعي كامل ١ لتر`), receipt shorthand (`TILDA BSMTI 5KG`), colloquial Kuwaiti (`خبز مطاحن`), weighed produce (1.25 kg tomatoes). All exact alias hits, no AI needed. The first sighting of the **unknown item** `ZAATAR MANAKEESH 4PC` goes to `pending_products`. |
| 2 | `02-salwa-coop-promo.json` | Salwa Co-op · Abu Faisal | **🔔 Watchlist alert.** Tilda 5 kg at a promo price of 4.450 KWD drops below Umm Khalid's target of 4.600. *Someone else's photo triggers her alert*, in English and Arabic, with 30-day min/avg/max and a buy-now-or-wait hint. Also: a **store-specific** Arabic shorthand (`دجاج ساديا ١٠٠٠غ`, which only Salwa prints) and a **fuzzy-only** line (`ALMARAI LABN FULLFAT 1LTR`, misspelled, matched at 0.91 → ✨ alias learned). Arabic fuzzy match: `شاي ليبتون ١٠٠ كيس`. |
| 3 | `03-lulu-alrai.json` | Lulu Al-Rai · Noura | **🚧 Outlier quarantine.** `KDD FF MILK 1L` at **2.800**: OCR read 0.280 as 2.800. That is >35% off the 30-day median (~0.40), so it's quarantined and doesn't affect prices or alerts. **🤖 LLM step:** `H/S SHMP CLSC CLN 400` is too abbreviated for fuzzy matching. It returns 10 candidates, the (mock) LLM picks Head & Shoulders 400 ml, and the alias is learned. Second sighting of the zaatar item. |
| 4 | `04-carrefour-avenues.json` | Carrefour Avenues · Umm Khalid | **The payoff: less AI.** `H/S SHMP CLSC CLN 400` and `ALMARAI LABN FULLFAT 1LTR` needed the LLM or fuzzy matching earlier; now they're **exact** hits from learned aliases. Third sighting of the zaatar item, by a 2nd distinct user, makes it ✅ ready for promotion; the demo promotes it into the catalogue. Also: `تونة العلالي ١٨٥ غم` (Arabic + Arabic-Indic digits, fuzzy) and `طماط` (Kuwaiti for tomatoes). |

## Expected `demo:ingest` summary (after `npm run db:reset`)

| metric | value |
|---|---|
| lines processed | 26 |
| exact alias / fuzzy / LLM / unmatched | 19 / 3 / 1 / 3 |
| LLM calls needed | 4 (3 of them are the unknown zaatar item) |
| learned aliases added | 3 |
| quarantined prices | 1 |
| alerts fired | 1 |
| pending products → promoted | 1 (zaatar manakeesh) |

## Tips for the live demo
- Show receipt 3 then receipt 4 back-to-back: *"the same shorthand cost us an AI call a minute ago; now it's free."*
- The alert message is stored on the `alerts` row (`message_en` / `message_ar`), ready to display.
- Re-running `demo:ingest` without a reset will add the observations again. Always use `npm run demo:fresh` before presenting.
