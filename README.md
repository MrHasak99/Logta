<div align="center">

<img src="assets/Logta_in_Deep_Teal.png" alt="Logta logo" width="220" />

# Logta | لُقطة

**Snap a receipt. Learn the prices. Shop smarter in Kuwait.**

*Built at the CODED AI Hackathon, Saturday 14 November 2026*

</div>

---

## Table of contents

- [What is Logta?](#what-is-logta)
- [Team](#team)
- [Project history](#project-history)
- [Features](#features)
- [How the self-learning loop works](#how-the-self-learning-loop-works)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Documentation](#documentation)
- [Demo assets](#demo-assets)
- [A note on data honesty](#a-note-on-data-honesty)
- [License](#license)

---

## What is Logta?

**Logta** (لُقطة, Arabic for a "catch" or "snapshot", as in a bargain you snap up) is a grocery price tracker and
basket optimiser for Kuwait.

Prices for the same basket differ between co-ops, hypermarkets and online grocers, and there is no easy way for a
shopper to see that. Logta's answer is to let shoppers build the price database themselves:

1. **Photograph a receipt.** An AI model reads every line.
2. **Match each line to the catalogue.** Exact and fuzzy alias matching handles most lines for free. The AI is only
   asked about lines the system doesn't recognise yet.
3. **Learn.** Every confident match becomes a new alias, and unknown items that keep showing up are promoted to
   real products automatically, with no human confirmation.
4. **Use the data.** Compare prices across stores, optimise a shopping basket across one to three stores, and get
   alerts when a watched product reaches your target price.

The more people scan, the fewer lines need the AI and the more accurate the prices get.

## Team

Logta was designed and built by a team of four.

| Name | GitHub | Focus |
|---|---|---|
| Hamad AlKhalaf | [@MrHasak99](https://github.com/MrHasak99) | Project scaffolding, receipt scanner UI (camera capture, auto-creation and review flow), AI proxy, client-side basket optimiser and alert engine |
| Abdallah Alshemeri | [@TwinTitan](https://github.com/TwinTitan) | Database and seed data, matching and trust engine, automatic AI pipeline, HTTP API server, tests, Replit deployment |
| Ali Ahmad AlShammari | [@AliAlShammari22](https://github.com/AliAlShammari22) | UI/UX redesign and design system, UX specification, basket / alerts / receipt-status components, logo, in collaboration with Kareem |
| Kareem Anbar | [@KareemAnbar](https://github.com/KareemAnbar) | UI/UX design, working alongside Ali |

> Ali and Kareem worked on the UI/UX together. The git history credits Ali's account for that work.

## Project history

### The event

Logta was built for the **CODED AI Hackathon**, held on **Saturday 14 November 2026, 10:59 am to 5:16 pm** (Kuwait
time, UTC+3).

### The story in one day

The repository was created at 10:26 am with an initial push (plus a placeholder `hello.txt`, removed a minute later),
shortly before the event window opened. The first real code landed at 12:59 pm. From there the team worked in
parallel streams and merged continuously:

- **`main`** carried the project scaffold and the frontend integration (Hamad).
- **`database`** carried the data layer, matching engine, AI pipeline and API server (Abdallah).
- **`ui-ux`** carried the visual redesign and design system (Ali, with Kareem).

Ali also created a temporary branch, `ui-ux-auto-pipeline`, for the automatic-pipeline UX work, and merged it back
through pull request #1.

The last hackathon-day commit is at 4:35 pm, about 40 minutes before the event closed.

### Timeline (14 November 2026, Kuwait time)

| Time | Milestone | Mostly by |
|---|---|---|
| 10:26 | Initial push, repository created | Hamad |
| 12:59 | Application scaffolded with Vite, React and TypeScript | Hamad |
| 13:21 | Drizzle/SQLite schema, migrations and deterministic seed | Abdallah |
| 13:25 | Tailwind CSS v4 and Lucide icons added | Hamad |
| 13:26 | Core library: alias matching cascade, price observations and trust, optimiser, alerts, catalogue growth, receipt pipeline, LLM contract, fixtures | Abdallah |
| 13:32 | Receipt currency extraction and a notice for non-KWD receipts | Hamad |
| 13:41 | Vitest suite for normalisation, matching, quarantine, trust, optimiser, alerts and catalogue growth | Abdallah |
| 13:42 | Data model documentation and fixtures README | Abdallah |
| 13:51 | AI extraction routed through a serverless proxy | Hamad |
| 14:12 | Extraction prompt moved server-side and `/api/extract` hardened (origin check, limits, rate limiting), with behaviour tests | Abdallah |
| 14:24 | Seeded prices labelled as demo estimates, not real scans | Abdallah |
| 14:33 | Logta UI/UX redesign | Ali (with Kareem) |
| 14:43 | Fully automatic AI pipeline: no human confirmation, auto-promotion with dedupe and price backfill, server-side LLM client, HTTP API server | Abdallah |
| 14:43 | Auto-creation of uncatalogued products with a confirm/reject review flow | Hamad |
| 14:47 | Tests for the pipeline, LLM client and API server; API docs; per-IP and per-device scan limits | Abdallah |
| 14:58 | Live camera capture in the receipt scanner | Hamad |
| 14:58 | AI asked only once per unknown text | Abdallah |
| 15:03 | Automatic-pipeline UX specification | Ali |
| 15:12 | API: watchlist delete, alerts with product/store/hint/stats, receipt status, recent-scans feeds | Abdallah |
| 15:30 | Replit hosting: Reserved VM config and SQLite snapshots to Replit Object Storage | Abdallah |
| 15:38 | Basket optimiser, price alerts and receipt-status components (PR #1 merged at 15:43) | Ali |
| 15:48 | Star pattern replaced with a shopping-trolley pattern | Ali |
| 15:52 | Scanner, optimiser and alerts wired to the API; Logta logo added to header and favicon | Abdallah, Ali |
| 15:59 | Client-side smart basket optimiser | Hamad |
| 16:01 | Header hides on scroll down and shows on scroll up | Ali |
| 16:05 | Forgiving `ALLOWED_ORIGINS` parsing on the server | Abdallah |
| 16:19 | Client-side price alert engine and hooks | Hamad |
| 16:35 | A receipt's AI calls run in parallel (max 6), one call per unique text | Abdallah |

The whole project, 50 commits across `main`, `database`, `ui-ux` and `features`, was written on that single day.

## Features

- **AI receipt scanning.** Photo or live camera capture, with server-side extraction prompts. Supports OpenRouter,
  OpenAI and Gemini.
- **Self-learning catalogue.** Exact and fuzzy alias matching, with every confident AI decision stored as a new alias
  so the same line is free next time.
- **Automatic catalogue growth.** Unknown items seen enough times by enough devices become products, or merge into an
  existing one, and earlier receipt prices are backfilled.
- **Trust-weighted prices.** Each price is scored by evidence type, age, product volatility and contributor trust.
  Outliers are quarantined until a second shopper confirms them.
- **Smart basket optimiser.** Considers every combination of one to three stores, includes travel cost, delivery
  fees and minimum orders, and suggests substitutions when an item is missing.
- **Price alerts.** Watch a product, set a target price, and get a "buy now" or "lower price seen recently" alert with
  30-day min/avg/max context.
- **Arabic and English.** Bilingual UI with RTL support, plus matching of Arabic names, receipt shorthand and
  colloquial Kuwaiti words.
- **Multi-currency receipts.** Non-KWD receipts are detected and flagged.
- **Privacy by default.** Receipt images are not kept, and identity is an anonymous device ID with no accounts.

## How the self-learning loop works

```text
photo ──► AI extracts lines ──► alias cascade
                                    │
          ┌─────────────────────────┼──────────────────────────┐
          ▼                         ▼                          ▼
   exact alias hit          fuzzy match (≥ 0.85)      no confident match
   (free, instant)          → learn alias             → AI picks from 10 candidates,
          │                         │                   or proposes a new product
          ▼                         ▼                          ▼
   price observation ──► outlier check ──► trust-weighted current price ──► alerts / optimiser
```

The full explanation, with the schema and services, is in [docs/DATA_MODEL.md](docs/DATA_MODEL.md).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide React |
| Typography | Inter (Latin), IBM Plex Sans Arabic |
| API server | Node.js 22+, TypeScript (run with `tsx`) |
| Database | SQLite via `better-sqlite3`, Drizzle ORM and migrations |
| AI | OpenRouter, OpenAI or Google Gemini (first configured key wins) |
| Testing and linting | Vitest, Oxlint |
| Hosting | Vercel (frontend and extraction proxy), Replit Reserved VM with Object Storage snapshots (API and database) |

## Architecture

```text
Logta/
├── src/
│   ├── components/   React UI: scanner, basket, optimizer, alerts, receipt, layout
│   ├── lib/          Business logic: matching, pipeline, prices/trust, optimizer, alerts, LLM client
│   ├── db/           Drizzle schema, migrations runner, deterministic seed
│   ├── api/ context/ services/ data/ types/ utils/   Frontend plumbing
│   └── i18n.ts       English / Arabic strings
├── server/           HTTP API (app.ts, index.ts) and SQLite backup to Replit Object Storage (backup.ts)
├── api/extract.ts    Serverless receipt-extraction proxy (Vercel)
├── drizzle/          SQL migrations
├── fixtures/         Demo receipts
├── scripts/          demo-ingest.ts
├── tests/            Vitest suites
├── docs/             Project documentation
└── assets/           Logo, demo video, marketing video
```

`src/db/` and `src/lib/` are Node-only. They run on the API server and are never imported by React components.

## Getting started

### Prerequisites

- **Node.js 22 or newer** (required by `better-sqlite3`)
- npm

### Install and run

```bash
npm install

# API server: http://localhost:8787 (seeds the database on first start)
npm run server

# Frontend: http://localhost:5173
npm run dev
```

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server (also serves `/api/extract` locally) |
| `npm run server` | Start the API server |
| `npm run db:reset` | Drop, migrate and re-seed the SQLite database |
| `npm run demo:ingest` | Push the demo receipts through the automatic pipeline |
| `npm run demo:fresh` | `db:reset` followed by `demo:ingest` |
| `npm test` | Run the Vitest suite |
| `npm run lint` | Lint with Oxlint |
| `npm run typecheck:server` | Type-check the server code |
| `npm run build` | Type-check and build the frontend |

### Environment variables

Copy `.env.example` to `.env`. Keys are server-only and are never bundled into the browser.

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | AI provider. Priority is OpenRouter, then OpenAI, then Gemini. With no key, scanning falls back to a simulated parser or returns 503 from the API, and everything else still works. |
| `LOGTA_LLM_MODEL` | Optional model override (default `gpt-4o-mini`) |
| `ALLOWED_ORIGINS` | Comma-separated browser origins allowed to call the API |
| `ADMIN_TOKEN` | Protects `/api/admin/*` (if unset, admin routes answer localhost only) |
| `LOGTA_DB_PATH` | SQLite file path (default `data/logta.db`) |
| `PORT` | API server port (default `8787`) |

## Documentation

| Document | Contents |
|---|---|
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Schema, services, seed data, the self-learning loop |
| [docs/API.md](docs/API.md) | Endpoints, automatic scan flow, environment, rate limits |
| [docs/DEPLOY_REPLIT.md](docs/DEPLOY_REPLIT.md) | Hosting the API on Replit with Object Storage backups |
| [docs/UI_UX_HANDOFF.md](docs/UI_UX_HANDOFF.md) | Brand, design tokens, RTL conventions, screens |
| [docs/UI_UX_AUTO_PIPELINE_SPEC.md](docs/UI_UX_AUTO_PIPELINE_SPEC.md) | UX specification for the automatic scanning pipeline |
| [fixtures/README.md](fixtures/README.md) | Demo receipt fixtures |

## Demo assets

- [Product demo recording](assets/Demo.mov)
- [Marketing video](assets/Marketing.mp4)
- [Logo (deep teal)](assets/Logta_in_Deep_Teal.png)

## A note on data honesty

Every seeded price is an **estimate for demo purposes only**: 12 stores (8 co-ops, Lulu, Carrefour, TSC and the online
store Taw9eel), 147 products, about 600 aliases and about 41,000 simulated observations over 60 days. They are
plausible for Kuwait but were not collected from any store, and the UI labels them as estimates. Real prices enter
only through user receipt scans.

## License

No license has been specified yet. All rights are held by the authors until one is added.

---

<div align="center">

Made in Kuwait at the CODED AI Hackathon by
[Hamad AlKhalaf](https://github.com/MrHasak99),
[Abdallah Alshemeri](https://github.com/TwinTitan),
[Ali Ahmad AlShammari](https://github.com/AliAlShammari22) and
[Kareem Anbar](https://github.com/KareemAnbar).

</div>
