# Logta | لُقطة — UI/UX Handoff

Branch: `ui-ux`. Presentation layer only: no changes to services, context, data schema or matching/commit logic.

## Brand

| Token (Tailwind class) | Value | Use |
|---|---|---|
| `brand` | `#22C58B` Mint | Primary buttons, active nav pill, accents |
| `brand-dark` | `#0F5C4D` Primary green | Text on light surfaces, hover, secondary buttons |
| `brand-light` | `#E3F6EE` | Soft tints, "matched" chips |
| `navy` / `navy-800` / `navy-700` | `#073F35` / `#0A4D41` / `#0F5C4D` Deep green | Header, dark surfaces |
| `gold`, `gold-light`, `gold-dark` | `#F2C14E`, `#FDF3D6`, `#7A5A0C` | Highlights only: sample card, new price, demo labels |
| `paper` | `#F8F6F1` | App background |
| `ink` | `#1E2421` | Body text |
| `line` | `#E8E3D8` | Hairline borders |

- Tailwind's `slate-*` scale is **remapped to warm neutrals** in `src/index.css`, so any `slate-*` class is on-brand.
- Never use mint as text on white (about 2.2:1 contrast). Use `brand-dark`. Text on mint buttons is `navy`.
- Fonts: **Inter** (Latin) and **IBM Plex Sans Arabic**, loaded from Google Fonts in `index.html`. One stack serves both languages.
- Wordmark: **لُقطة** (with damma) + "Logta". Logo mark: viewfinder brackets around a gold ل (`Layout.tsx` `LogoMark`, `public/favicon.svg`).

## Design conventions

- Mobile-first, max width 480px, 16px page gutter, 4px spacing grid.
- Radii: 12–14px controls, 20–24px cards. No gradients. Depth comes from soft green-tinted shadows (`shadow-soft`, `shadow-card`, `shadow-nav`).
- Body text 14–16px. 12–13px only for tertiary text (nav labels, badges, tagline). Touch targets are at least 44px.
- Use **logical** utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `border-s-*`, `rtl:rotate-180`) so RTL works automatically. Keep prices and codes in `dir="ltr"`; user-facing names in `dir="auto"`.
- Status colours: green = matched / cheaper, amber = low confidence, red = needs match / higher, gold = new / demo, grey = unchanged.
- Motion is short (150–400ms) and disabled under `prefers-reduced-motion`.

## Reusable pieces (`src/index.css`)

- `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-on-dark` (48px minimum height; add `min-h-14` for primary CTAs)
- `.card` (white, warm border, soft shadow)
- `.bg-khatam` (subtle eight-point star pattern for dark surfaces)
- Animations: `animate-fade-up`, `animate-pop-in`, `animate-float-soft`, `animate-scan-line`, `animate-progress-slide`
- Global focus ring (`:focus-visible`, mint)

## Screens

1. **Scanner home** (`ReceiptScanner` → `ImageUploader`): camera-first card with **Take Photo** (`capture="environment"`) and **Upload Image** (drag and drop still works on desktop), then a highlighted gold "sample receipt" card. Sample labels are localized in `ImageUploader.tsx` by sample id (the data file is untouched).
2. **Scanning** (`ScanningAnimation`): receipt with a scan line, plus the status text.
3. **Review** (`VerificationTable`): receipt details card and one card per line with inline guidance and a sticky action bar. The current flow is the team's **Confirm / Reject** review (lines must be decided before saving), restyled in the Logta design system.
4. **Success** (`SuccessSummary`): added / updated counts and a price-change list built from the real deltas, plus a sticky "Scan another" button.
5. **Recent verified prices** (`RecentScansFeed`): shown on the home and success states only. Two groups: verified scans (receipt / shelf-tag badges, confidence, time) and clearly labelled demo estimates.
6. **Basket Optimizer / Price Alerts** (`PlaceholderScreen`): branded "Coming soon" cards. Replace the usage in `App.tsx` when the features land.

## Navigation and layout behavior

- `Layout`: sticky green header (language toggle, reset-demo icon with an in-app confirm dialog), `main` with `pb-32`, fixed `BottomNav` (3 tabs).
- The scanner tab stays mounted (hidden) while on other tabs, so an in-progress scan survives tab switches.
- Sticky action bars (review confirm, success next action) sit at `bottom-[calc(5.5rem+env(safe-area-inset-bottom))]`, above the nav (about 76px tall). If the nav height changes, update that offset.
- Verified at 360px and 390px, English LTR and Arabic RTL, with no horizontal scroll.

## i18n

All UI copy is in `src/i18n.ts` (`en` + `ar`, typed by `TKey`). Add every new string to both.

## New presentational screens (not wired to anything yet)

Full behaviour, copy and API mapping live in [UI_UX_AUTO_PIPELINE_SPEC.md](UI_UX_AUTO_PIPELINE_SPEC.md). This is the short version.

**All components below are presentational:** props in, callbacks out. They do no fetching, hold no application state (only small UI state such as an expanded card or a typed target price) and are **not mounted anywhere**. `App.tsx` still renders the "coming soon" placeholders and the manual scanner is unchanged. Types live in `src/types/api.ts` (frontend copies of the API JSON; `src/lib` is Node-only and cannot be imported). Strings live in `src/i18nBasketAlerts.ts`.

| Area | Entry component and key files | Main props (callbacks use the `on…` prefix) |
|---|---|---|
| **Basket Optimizer** `src/components/basket/` | `BasketScreen` (+ `ProductResultRow`, `BasketItemRow`, `LocationChip`, `LocationSheet`, `PlanCard`, `PlanBreakdown`) | `searchQuery`, `searchResults`, `searchStatus`, `items: BasketItem[]`, `location`, `locationSheetOpen`, `areaOptions`, `plans: BasketPlan[] \| null`, `planStatus: idle \| loading \| ready \| error` (`idle` = builder, anything else = plans view). Callbacks: search, add / qty / swap / remove, open / close / use-my-location / pick-area, `onFindPlan`, `onEditBasket`, `onRetry` |
| **Price Alerts** `src/components/alerts/` | `AlertsScreen` (+ `AlertCard`, `WatchCard`, `AddWatchSheet`) | `alerts: AlertEntry[]`, `watches: WatchCardData[]` (frontend joins `currentBest`), `status`, `addSheet {...}`, `busyAlertIds?`, `busyWatchIds?`. Callbacks: `onMarkSeen`, `onRemoveWatch`, `onOpenAddWatch`, `onCloseAddWatch`, `onAddQueryChange`, `onSelectProduct`, `onSubmitWatch(productId, targetKwd)`, `onRetry`. `BottomNav` accepts an optional `alertsBadge` count |
| **Automatic receipt result** `src/components/receipt/` | `ReceiptResult` (+ `ReceiptLineRow`, `lineOutcome.ts`), `ScanWaiting`, `ScanError`, `ReceiptHistoryList` | `ReceiptResult`: `receipt: ReceiptDetail` plus optional `refreshing`, `learnedAliases`, `autoPromoted`, `alerts` (pre-filtered to this device), `stores`, `choosingStore`, `onChooseStore`, `onScanAnother`, `onViewAlerts`, `onRetry`. `ScanWaiting`: `elapsedSeconds`, `onStopWaiting`. `ScanError`: `kind: ScanErrorKind`, `retryAfterSeconds`, `onRetry`, `onSecondary`. `ReceiptHistoryList`: `receipts`, `status`, `onOpen`, `onRetry` |
| Shared | `src/components/ui/` | `PriceBadge` (trust to Estimate / Recent / Verified), `QtyStepper`, `SearchField`, `BottomSheet`, `EmptyState`, `ErrorState`, `Skeleton` |

Conventions that matter when wiring:

- **Trust labels** come from one rule (`trustBucket` in `src/utils/apiFormat.ts`): below 0.6 Estimate, 0.6 to below 0.8 Recent, 0.8 and above Verified. Estimates are never styled like verified prices.
- **Automatic results never say "confirm" or "pending approval".** The server has already saved what it could: lines are Saved, Held, Waiting for AI, New item or Not saved.
- **Cancel or timeout never means resend.** The server keeps processing a cancelled scan; point users to Your recent scans.
- Savings, alerts and prices are shown only when the API supplies them; nothing is computed from invented baselines (quick target chips use the real current price).

### Integration requirements for the frontend developer

1. A stable `deviceId` (e.g. `crypto.randomUUID()` in `localStorage`) and an API client reading `VITE_API_BASE`.
2. Map HTTP errors to `ScanErrorKind` (400 bad file / unreadable, 413 too large, 429 per-minute vs hourly with `Retry-After`, 502 AI failed, 503 unavailable, 403 forbidden, network, client timeout) and count down `retryAfterSeconds`.
3. Keep the photo in memory for Retry and for "choose the store" re-sends; never auto-resend after a cancel or timeout.
4. After a scan, show `ReceiptResult` from `GET /api/receipts/:id` and poll every 30 to 60 s while `summary.waiting > 0`.
5. Filter `report.alerts` by this device's `userId` before passing `alerts`.
6. Build `areaOptions` from `GET /api/stores` (`areaEn` / `areaAr`, `lat` / `lng`; the online store has none) and geolocation.
7. Join each watch with its current best price (`WatchCardData.currentBest`) and pass the unseen-alert count to `BottomNav` via `Layout`.
8. Keep the manual Confirm / Reject flow until the team agrees the automatic flow is the demo path. Do not mix the local 28-product catalogue with server products.

### Limitations of the new screens

- Verified only with temporary fake data at 360 and 390 px in English and Arabic; never run against the real API.
- Substitution names in plans are English-only in the API (Arabic is looked up from the plan lines, else English is shown).
- No push notifications: alerts need polling.
- Travel cost in plans is an estimate (straight-line distance x 1.3) and is labelled as such.
- `Layout` does not pass `alertsBadge` yet.

## Known limitations

- **Recent verified prices** (`RecentScansFeed`) is restyled on top of the `origin/database` demo-estimate labelling: real scans and seeded demo estimates are shown in separate groups, and demo rows carry no confidence or timestamp. The demo group is collapsed to 4 rows with a Show all toggle.
- Default language remains English unless one is saved (`utils/storage.ts`, out of UI scope).
- `Take Photo` needs a real phone to open the camera; desktop falls back to the file picker.
- Low-confidence lines only appear with live AI output; the built-in samples all match at 98%.
- One lint warning remains in `VerificationTable.tsx` (`react/only-export-components`, from the confirm / reject change by a teammate). It is not UI-owned logic.
- Fonts load from Google Fonts, so a first load offline falls back to system fonts.
