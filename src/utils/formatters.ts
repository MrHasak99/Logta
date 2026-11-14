/** Formats a KWD amount with exactly 3 decimals, e.g. `1.450 KD`. */
export const formatKwd = (price: number): string => `${(Number.isFinite(price) ? price : 0).toFixed(3)} KD`

/** Rounds to fils precision (3 decimals) to avoid float artefacts. */
export const roundKwd = (n: number): number => Math.round(n * 1000) / 1000

export const formatDelta = (delta: number): string => {
  const abs = Math.abs(delta)
  if (abs < 0.0005) return 'no change'
  return `${delta < 0 ? '↓' : '↑'} ${abs.toFixed(3)} KD`
}

export const formatDate = (iso: string, lang: 'en' | 'ar' = 'en'): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const timeAgo = (iso: string, lang: 'en' | 'ar' = 'en'): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.round(diff / 60000))
  const hrs = Math.round(mins / 60)
  const days = Math.round(hrs / 24)
  if (lang === 'ar') {
    if (mins < 1) return 'الآن'
    if (mins < 60) return `قبل ${mins} د`
    if (hrs < 24) return `قبل ${hrs} س`
    return `قبل ${days} يوم`
  }
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  return `${days}d ago`
}

export const todayIso = (): string => new Date().toISOString().slice(0, 10)
