import type { Lang } from '../i18n'
import type { SizeUnit } from '../types/api'

/** Name for the current language, falling back to the other language when one is empty. */
export const nameFor = (o: { nameEn: string; nameAr: string }, lang: Lang): string =>
  (lang === 'ar' ? o.nameAr || o.nameEn : o.nameEn || o.nameAr) || ''

const UNIT_EN: Record<SizeUnit, string> = { g: 'g', kg: 'kg', ml: 'ml', L: 'L', pcs: 'pcs' }
const UNIT_AR: Record<SizeUnit, string> = { g: 'جرام', kg: 'كيلو', ml: 'مل', L: 'لتر', pcs: 'قطعة' }

/** "500 g" / "500 جرام". Whole numbers are printed without decimals. */
export const formatSize = (value: number, unit: SizeUnit, lang: Lang): string => {
  const n = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
  return `${n} ${(lang === 'ar' ? UNIT_AR : UNIT_EN)[unit] ?? unit}`
}

export type TrustBucket = 'estimate' | 'recent' | 'verified'

/** Trust labels agreed with the backend: below 0.6 Estimate, 0.6 to below 0.8 Recent, 0.8 and above Verified. */
export const trustBucket = (trust: number): TrustBucket => (trust < 0.6 ? 'estimate' : trust < 0.8 ? 'recent' : 'verified')

/** Rounds to fils precision (3 decimals). */
export const round3 = (n: number): number => Math.round(n * 1000) / 1000
