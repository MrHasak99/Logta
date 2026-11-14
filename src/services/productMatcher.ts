import type { Product, Store } from '../data/types'

export interface MatchResult {
  productId: string | null
  /** 0-100 */
  confidence: number
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Unicode-aware whole-word replacement (JS `\b` ignores Arabic letters). */
const unit = (s: string, words: string[], to: string): string =>
  s.replace(new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.join('|')})(?![\\p{L}\\p{N}])`, 'gu'), to)

/** Normalises receipt text (English or Arabic) for fuzzy comparison. */
export const normalize = (input: string): string => {
  let s = input.toLowerCase()
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
  s = s.replace(/[\u064B-\u065F\u0670\u0640]/g, '') // diacritics + tatweel
  s = s.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  s = s.replace(/٫/g, '.')
  s = s.replace(/[^\p{L}\p{N}.]+/gu, ' ')
  s = s.replace(/(?<!\d)\.|\.(?!\d)/g, ' ') // keep decimal points only
  s = s.replace(/(\d)(\p{L})/gu, '$1 $2').replace(/(\p{L})(\d)/gu, '$1 $2')
  s = unit(s, ['ltr', 'litre', 'liter', 'ليتر', 'لتر'], 'l')
  s = unit(s, ['gm', 'gms', 'gram', 'grams', 'جرام', 'غرام'], 'g')
  s = unit(s, ['kgs', 'kilo', 'كيلو'], 'kg')
  s = unit(s, ['pc', 'pcs', 'pieces', 'piece', 'pk', 'pack', 's', 'قطعه', 'قطع', 'حبات'], 'pcs')
  s = unit(s, ['مل'], 'ml')
  return s.replace(/\s+/g, ' ').trim()
}

const dice = (a: string[], b: string[]): number => {
  if (!a.length || !b.length) return 0
  const setB = new Set(b)
  const setA = new Set(a)
  let hit = 0
  for (const t of setA) if (setB.has(t)) hit++
  return (2 * hit) / (setA.size + setB.size)
}

interface Candidate {
  productId: string
  norm: string
  toks: string[]
}

let cache: { key: Product[]; candidates: Candidate[] } | null = null

const candidatesFor = (products: Product[]): Candidate[] => {
  if (cache?.key === products) return cache.candidates
  const candidates: Candidate[] = []
  for (const p of products) {
    for (const text of [p.nameEn, p.nameAr, ...p.aliases]) {
      const norm = normalize(text)
      if (norm) candidates.push({ productId: p.id, norm, toks: norm.split(' ') })
    }
  }
  cache = { key: products, candidates }
  return candidates
}

/** Matches a raw receipt line to the canonical catalogue. */
export const matchToProduct = (rawText: string, products: Product[]): MatchResult => {
  const norm = normalize(rawText)
  if (!norm) return { productId: null, confidence: 0 }
  const rawToks = norm.split(' ')

  let bestId: string | null = null
  let best = 0
  for (const c of candidatesFor(products)) {
    let score: number
    if (c.norm === norm) {
      score = 0.98
    } else {
      score = dice(rawToks, c.toks) * 0.92
      // Containment of a longer alias gets a mild boost.
      if (c.norm.length >= 6 && (norm.includes(c.norm) || c.norm.includes(norm))) {
        score = Math.max(score, 0.82)
      }
    }
    if (score > best) {
      best = score
      bestId = c.productId
    }
  }

  const confidence = Math.round(best * 100)
  if (!bestId || confidence < 50) return { productId: null, confidence }
  return { productId: bestId, confidence }
}

/** Matches an AI-detected store name to one of the 5 Kuwait stores. */
export const matchStore = (name: string, stores: Store[]): string | null => {
  const norm = normalize(name)
  if (!norm) return null
  let bestId: string | null = null
  let best = 0
  for (const s of stores) {
    for (const text of [s.nameEn, s.nameAr, ...s.aliases]) {
      const n = normalize(text)
      if (!n) continue
      let score = dice(norm.split(' '), n.split(' '))
      if (norm.includes(n) || n.includes(norm)) score = Math.max(score, 0.9)
      if (score > best) {
        best = score
        bestId = s.id
      }
    }
  }
  return best >= 0.5 ? bestId : null
}
