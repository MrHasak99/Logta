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
3. **Review** (`VerificationTable`): receipt details card, ready / needs-attention counts, one card per line (green = matched, amber = check, red = needs match or price), inline guidance, and a sticky confirm bar. Validation is unchanged: confirm is enabled only with a store, at least one line, and every line matched with a price above 0. Low-confidence lines (below 70) are flagged but do not block saving.
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

## Known limitations

- **Recent verified prices** (`RecentScansFeed`) is restyled on top of the `origin/database` demo-estimate labelling: real scans and seeded demo estimates are shown in separate groups, and demo rows carry no confidence or timestamp. The demo group is collapsed to 4 rows with a Show all toggle.
- Default language remains English unless one is saved (`utils/storage.ts`, out of UI scope).
- `Take Photo` needs a real phone to open the camera; desktop falls back to the file picker.
- Low-confidence lines only appear with live AI output; the built-in samples all match at 98%.
- One pre-existing lint warning: `react/set-state-in-effect` in `PriceInput` (`VerificationTable.tsx`). It was kept to preserve behavior.
- Fonts load from Google Fonts, so a first load offline falls back to system fonts.
