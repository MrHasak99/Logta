/**
 * Contract between the API layer and the LLM. THIS LAYER NEVER CALLS AN LLM — it only defines
 * the shapes and prompts. Flow for the API team:
 *
 *   1. Send the photo + EXTRACTION_SYSTEM_PROMPT → strict JSON matching RECEIPT_EXTRACTION_JSON_SCHEMA.
 *      Validate with parseReceiptExtraction().
 *   2. ingestReceipt(extraction, { userId }) — most lines resolve via aliases (no LLM needed).
 *   3. For each line returned with `needsLLM: true`, send MATCH_SYSTEM_PROMPT + buildMatchUserMessage(line)
 *      → JSON matching LLM_MATCH_JSON_SCHEMA. Then call resolveLineWithLlm(lineId, choice.product_id, …).
 *      A confident choice is learned as a new alias, so the same text never needs the LLM again.
 */
import type { MatchCandidate } from './matching.ts';

// ---------------------------------------------------------------------------
// Call 1 — extraction
// ---------------------------------------------------------------------------

export interface ReceiptExtractionLine {
  /** Line text exactly as printed (keep abbreviations, Arabic, digits as-is). */
  raw_text: string;
  qty: number;
  unit_price_kwd: number | null;
  line_total_kwd: number | null;
}

export interface ReceiptExtraction {
  /** Store name/branch as printed in the header, e.g. "MISHREF CO-OP SOCIETY" or "جمعية مشرف التعاونية". */
  store_text: string | null;
  /** ISO 8601 date-time if printed, else null. */
  purchased_at: string | null;
  lines: ReceiptExtractionLine[];
  total_kwd: number | null;
}

export const RECEIPT_EXTRACTION_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'ReceiptExtraction',
  type: 'object',
  additionalProperties: false,
  required: ['store_text', 'purchased_at', 'lines', 'total_kwd'],
  properties: {
    store_text: { type: ['string', 'null'] },
    purchased_at: { type: ['string', 'null'], description: 'ISO 8601, e.g. 2026-11-13T18:42:00+03:00' },
    total_kwd: { type: ['number', 'null'], minimum: 0 },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['raw_text', 'qty', 'unit_price_kwd', 'line_total_kwd'],
        properties: {
          raw_text: { type: 'string', minLength: 1 },
          qty: { type: 'number', exclusiveMinimum: 0 },
          unit_price_kwd: { type: ['number', 'null'], minimum: 0 },
          line_total_kwd: { type: ['number', 'null'], minimum: 0 },
        },
      },
    },
  },
} as const;

export const EXTRACTION_SYSTEM_PROMPT = `You read photos of Kuwaiti grocery receipts and shelf price tags (co-ops / الجمعيات التعاونية, hypermarkets, supermarkets, delivery apps) and return STRICT JSON only — no prose, no markdown fences.

Output exactly this shape:
{"store_text": string|null, "purchased_at": string|null, "lines": [{"raw_text": string, "qty": number, "unit_price_kwd": number|null, "line_total_kwd": number|null}], "total_kwd": number|null}

Rules:
- One entry per purchased item line. Skip headers, VAT/tax lines, subtotals, payment, change, loyalty points, discounts that are not tied to an item, and footer text.
- raw_text: copy the item text EXACTLY as printed — keep abbreviations (e.g. "ALM FF MLK 1L"), Arabic text, units and Arabic-Indic digits (٠-٩) unchanged. Do not translate, expand or correct it.
- Prices are Kuwaiti dinars (KWD) with 3 decimals (fils). "1.250" means 1 dinar 250 fils. Never drop or move the decimal point.
- qty: the count or weight purchased (weighed produce may be fractional kg, e.g. 1.235). Default 1.
- unit_price_kwd: price per unit/kg; line_total_kwd: qty × unit price as printed. Use null if not printed.
- If an item has a printed discount on the next line, subtract it into that item's line_total_kwd.
- store_text: the store/branch name from the header (e.g. "MISHREF CO-OP SOCIETY", "جمعية مشرف التعاونية", "LULU HYPERMARKET AL-RAI").
- purchased_at: ISO 8601 with +03:00 if a date/time is printed, else null.
- For a single shelf tag: return one line, qty 1, store_text null unless printed.
- If something is unreadable, use null for that field. Never invent items or prices.`;

// ---------------------------------------------------------------------------
// Call 2 — choose a product among candidates (only for lines the alias cascade could not resolve)
// ---------------------------------------------------------------------------

export interface LlmMatchChoice {
  /** One of the candidate product_ids, or null if none is the same product. */
  product_id: number | null;
  /** 0–1. Use ≥ 0.85 only when brand, product type AND size all agree. */
  confidence: number;
  /** For unknown items (product_id null): a clean proposed name so the catalogue can grow. */
  proposed_name_en: string | null;
  proposed_name_ar: string | null;
}

export const LLM_MATCH_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'LlmMatchChoice',
  type: 'object',
  additionalProperties: false,
  required: ['product_id', 'confidence', 'proposed_name_en', 'proposed_name_ar'],
  properties: {
    product_id: { type: ['integer', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    proposed_name_en: { type: ['string', 'null'] },
    proposed_name_ar: { type: ['string', 'null'] },
  },
} as const;

export const MATCH_SYSTEM_PROMPT = `You match one line from a Kuwaiti grocery receipt to a product catalogue. Return STRICT JSON only — no prose.

You get the raw receipt text and a numbered list of candidate products (id, brand, English name, Arabic name, size).
Output: {"product_id": number|null, "confidence": number, "proposed_name_en": string|null, "proposed_name_ar": string|null}

Rules:
- Pick a candidate ONLY if it is the same product: same brand, same product type/variant (e.g. full-fat vs low-fat) and same size/pack. Receipt text is often abbreviated (e.g. "H/S" = Head & Shoulders, "F/F" = full fat, "BSMTI" = basmati, "CHKN" = chicken) or mixes Arabic and English.
- If no candidate is the same product, return product_id null — never pick "the closest" item just to return something.
- confidence: 0.9–1.0 when brand, type and size clearly agree; 0.6–0.85 when one detail is uncertain; below 0.6 → return null instead.
- When product_id is null, propose a clean English and Arabic product name (natural Arabic as printed on Kuwaiti packaging), else set both to null.
- Only use ids from the candidate list.`;

/** Build the user message for call 2. */
export function buildMatchUserMessage(rawText: string, candidates: MatchCandidate[], storeName?: string | null): string {
  const list = candidates
    .map((c) => `- id ${c.productId}: ${c.brand ?? '(no brand)'} | ${c.nameEn} | ${c.nameAr} | size ${c.sizeLabel}`)
    .join('\n');
  return `Receipt line: "${rawText}"${storeName ? `\nStore: ${storeName}` : ''}\n\nCandidates:\n${list || '(none)'}`;
}

// ---------------------------------------------------------------------------
// Validation helpers (no external deps)
// ---------------------------------------------------------------------------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : isNum(v) ? v : isNum(Number(v)) ? Number(v) : null);

/** Parse + sanity-check an extraction (accepts a JSON string or object). Throws on structural errors. */
export function parseReceiptExtraction(input: string | unknown): ReceiptExtraction {
  const raw = typeof input === 'string' ? JSON.parse(input.replace(/^```(?:json)?\s*|\s*```$/g, '')) : input;
  if (!raw || typeof raw !== 'object') throw new Error('Extraction is not an object');
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.lines)) throw new Error('Extraction.lines must be an array');
  const lines: ReceiptExtractionLine[] = o.lines
    .map((l) => l as Record<string, unknown>)
    .filter((l) => typeof l.raw_text === 'string' && l.raw_text.trim())
    .map((l) => ({
      raw_text: String(l.raw_text).trim(),
      qty: numOrNull(l.qty) && numOrNull(l.qty)! > 0 ? numOrNull(l.qty)! : 1,
      unit_price_kwd: numOrNull(l.unit_price_kwd),
      line_total_kwd: numOrNull(l.line_total_kwd),
    }));
  return {
    store_text: typeof o.store_text === 'string' ? o.store_text : null,
    purchased_at: typeof o.purchased_at === 'string' ? o.purchased_at : null,
    lines,
    total_kwd: numOrNull(o.total_kwd),
  };
}

/** Parse + clamp an LLM match choice; ids outside the candidate list become null. */
export function parseLlmMatchChoice(input: string | unknown, candidates: MatchCandidate[]): LlmMatchChoice {
  const raw = typeof input === 'string' ? JSON.parse(input.replace(/^```(?:json)?\s*|\s*```$/g, '')) : input;
  const o = (raw ?? {}) as Record<string, unknown>;
  const id = isNum(o.product_id) && candidates.some((c) => c.productId === o.product_id) ? (o.product_id as number) : null;
  const conf = isNum(o.confidence) ? Math.max(0, Math.min(1, o.confidence)) : 0;
  return {
    product_id: id,
    confidence: id == null ? 0 : conf,
    proposed_name_en: typeof o.proposed_name_en === 'string' ? o.proposed_name_en : null,
    proposed_name_ar: typeof o.proposed_name_ar === 'string' ? o.proposed_name_ar : null,
  };
}
