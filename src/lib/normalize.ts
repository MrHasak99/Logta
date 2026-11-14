/**
 * Text normalisation for receipt lines, shelf tags and product aliases.
 * Handles English, Arabic, mixed text, Arabic-Indic digits and unit spellings.
 */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Arabic diacritics (harakat), superscript alef, Quranic marks and tatweel. */
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Unit spellings → canonical token. Keys are post-normalisation tokens (Arabic already unified). */
const UNIT_MAP: Record<string, string> = {
  // litres
  l: 'l', lt: 'l', ltr: 'l', ltrs: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l', lit: 'l',
  'لتر': 'l', 'ليتر': 'l', 'لترات': 'l', 'ل': 'l',
  // millilitres
  ml: 'ml', mls: 'ml', 'مل': 'ml', 'ملل': 'ml', 'مللي': 'ml', 'ملي': 'ml', 'مليلتر': 'ml',
  // grams
  g: 'g', gm: 'g', gms: 'g', gr: 'g', grm: 'g', grms: 'g', gram: 'g', grams: 'g', gramme: 'g',
  'جم': 'g', 'غم': 'g', 'غرام': 'g', 'جرام': 'g', 'غ': 'g', 'جرامات': 'g', 'غرامات': 'g',
  // kilograms
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  'كجم': 'kg', 'كغ': 'kg', 'كيلو': 'kg', 'كيلوجرام': 'kg', 'كيلوغرام': 'kg', 'كلغ': 'kg', 'كيلوجرامات': 'kg',
  // pieces
  pcs: 'pcs', pc: 'pcs', pce: 'pcs', piece: 'pcs', pieces: 'pcs', s: 'pcs', 'حبه': 'pcs', 'حبات': 'pcs', 'قطعه': 'pcs', 'قطع': 'pcs',
};

/** Convert ٠-٩ and ۰-۹ to 0-9, and the Arabic decimal separator ٫ to '.'. */
export function toWesternDigits(s: string): string {
  let out = '';
  for (const ch of s) {
    const a = ARABIC_INDIC.indexOf(ch);
    if (a >= 0) { out += String(a); continue; }
    const p = PERSIAN_DIGITS.indexOf(ch);
    if (p >= 0) { out += String(p); continue; }
    out += ch === '٫' ? '.' : ch === '٬' ? ',' : ch;
  }
  return out;
}

/** Unify Arabic letter variants and strip diacritics/tatweel. */
export function normalizeArabicLetters(s: string): string {
  return s
    .replace(ARABIC_MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

/**
 * Normalise an alias / receipt line for matching.
 *  - lowercase, NFKC
 *  - Arabic-Indic digits → 0-9
 *  - unify Arabic letters (أ/إ/آ→ا, ة→ه, ى→ي), strip tatweel and diacritics
 *  - strip punctuation (keeps decimal points inside numbers)
 *  - split numbers from glued units ("1ltr" → "1 l", "٥كيلو" → "5 kg")
 *  - unify units (ltr/lt/l/لتر → l, gm/g/جم/غرام → g, kg/كجم/كيلو → kg …)
 *  - canonicalise numbers ("1.50" → "1.5", "05" → "5"), collapse spaces
 */
export function normalizeAlias(input: string): string {
  // NFKD splits Latin accents (é → e + ◌́) and Arabic hamza/madda forms (أ → ا + ◌ٔ); marks are stripped below
  let s = input.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  s = toWesternDigits(s);
  s = normalizeArabicLetters(s);
  // multiplication signs used for packs: "6x330ml", "6*330", "6×330"
  s = s.replace(/(\d)\s*[x×*]\s*(\d)/g, '$1 x $2');
  // keep decimal points between digits, everything else non-alphanumeric → space
  s = s.replace(/(\d)[.,](\d)/g, '$1\u0000$2');
  s = s.replace(/[^\p{L}\p{N}\u0000]+/gu, ' ');
  s = s.replace(/\u0000/g, '.');
  // split digits from letters on either side ("1l" → "1 l", "l1" → "l 1")
  s = s.replace(/(\d)(\p{L})/gu, '$1 $2').replace(/(\p{L})(\d)/gu, '$1 $2');
  const tokens = s
    .split(/\s+/)
    .filter(Boolean)
    .map((tok, i, arr) => {
      if (/^\d+(\.\d+)?$/.test(tok)) return String(Number(tok));
      const unit = UNIT_MAP[tok];
      // single-letter units ("l", "g", "s", "ل", "غ") only count right after a number
      if (unit && (tok.length > 1 || (i > 0 && /^\d/.test(arr[i - 1]!)))) return unit;
      return tok;
    });
  return tokens.join(' ');
}

export type UnitKind = 'mass' | 'volume' | 'count';

export interface ParsedSize {
  /** Size of ONE item in base units: grams, millilitres or pieces. */
  baseQty: number;
  kind: UnitKind;
  /** Number of items in a multipack ("6 x 330 ml" → 6). */
  packCount: number;
}

const UNIT_TO_BASE: Record<string, { kind: UnitKind; factor: number }> = {
  g: { kind: 'mass', factor: 1 },
  kg: { kind: 'mass', factor: 1000 },
  ml: { kind: 'volume', factor: 1 },
  l: { kind: 'volume', factor: 1000 },
  L: { kind: 'volume', factor: 1000 },
  pcs: { kind: 'count', factor: 1 },
};

/** Convert a product's size to base units. */
export function toBaseQty(sizeValue: number, sizeUnit: string): { baseQty: number; kind: UnitKind } {
  const u = UNIT_TO_BASE[sizeUnit] ?? UNIT_TO_BASE[sizeUnit.toLowerCase()];
  if (!u) throw new Error(`Unknown unit: ${sizeUnit}`);
  return { baseQty: sizeValue * u.factor, kind: u.kind };
}

/** Extract the size from a NORMALISED string, e.g. "tilda basmati 5 kg" → 5000 g; "pepsi 6 x 330 ml" → 330 ml ×6. */
export function parseSize(normalized: string): ParsedSize | null {
  const tokens = normalized.split(' ');
  let best: ParsedSize | null = null;
  for (let i = 0; i < tokens.length - 1; i++) {
    const n = Number(tokens[i]);
    const unit = tokens[i + 1]!;
    if (!Number.isFinite(n) || !/^\d/.test(tokens[i]!)) continue;
    const u = UNIT_TO_BASE[unit];
    if (!u) continue;
    let packCount = 1;
    // "6 x 330 ml"
    if (i >= 2 && tokens[i - 1] === 'x' && /^\d+$/.test(tokens[i - 2]!)) packCount = Number(tokens[i - 2]);
    // "330 ml x 6"
    else if (tokens[i + 2] === 'x' && /^\d+$/.test(tokens[i + 3] ?? '')) packCount = Number(tokens[i + 3]);
    // count units alone ("30 pcs") are a size, but a mass/volume size wins over a count
    const parsed: ParsedSize = { baseQty: n * u.factor, kind: u.kind, packCount };
    if (!best || (best.kind === 'count' && u.kind !== 'count')) best = parsed;
  }
  return best;
}

/** Remove size tokens (numbers + units + 'x') so text similarity is not dominated by sizes. */
export function stripSizeTokens(normalized: string): string {
  return normalized
    .split(' ')
    .filter((t) => !/^\d+(\.\d+)?$/.test(t) && !(t in UNIT_TO_BASE) && t !== 'x')
    .join(' ');
}

const ARABIC_CHARS = /[؀-ۿ]/;
const LATIN_CHARS = /[a-zA-Z]/;

export function detectLang(s: string): 'en' | 'ar' | 'mixed' {
  const ar = ARABIC_CHARS.test(s);
  const en = LATIN_CHARS.test(s);
  if (ar && en) return 'mixed';
  return ar ? 'ar' : 'en';
}
