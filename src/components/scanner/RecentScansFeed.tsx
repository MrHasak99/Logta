import { ChevronDown, FlaskConical, Receipt, ScanLine, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { isDemoEntry } from '../../data/seedData'
import type { PriceEntry } from '../../data/types'
import { latestEntry } from '../../services/priceCommit'
import { formatKwd, timeAgo } from '../../utils/formatters'

const FEED_SIZE = 20
/** Demo estimates are collapsed to this many rows until the user expands them. */
const DEMO_PREVIEW = 4

interface FeedRow {
  entry: PriceEntry
  previous: PriceEntry | undefined
}

export default function RecentScansFeed() {
  const { t, lang, priceEntries, products, stores, scanRecords, productName, storeName } = useApp()
  const [showAllDemo, setShowAllDemo] = useState(false)

  const rows = useMemo(() => {
    // Only the current price per product/store, newest first. Prefer user-verified sources.
    const verified = priceEntries
      .filter((e) => e.source !== 'Initial Index')
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const seen = new Set<string>()
    const out: FeedRow[] = []
    for (const e of verified) {
      const key = `${e.productId}|${e.storeId}`
      if (seen.has(key)) continue
      seen.add(key)
      // Skip superseded entries (a newer Initial Index entry cannot exist, but stay safe).
      if (latestEntry(priceEntries, e.productId, e.storeId)?.id !== e.id) continue
      const previous = priceEntries
        .filter((p) => p.productId === e.productId && p.storeId === e.storeId && p.timestamp < e.timestamp)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
      out.push({ entry: e, previous })
      if (out.length >= FEED_SIZE) break
    }
    return out
  }, [priceEntries])

  // Presentation split: real scans are never mixed with seeded demo data.
  const realRows = rows.filter(({ entry }) => !isDemoEntry(entry))
  const demoRows = rows.filter(({ entry }) => isDemoEntry(entry))
  const visibleDemo = showAllDemo ? demoRows : demoRows.slice(0, DEMO_PREVIEW)

  const sourceLabel = (e: PriceEntry) =>
    isDemoEntry(e) ? t('srcDemo') : e.source === 'Receipt Scan' ? t('srcReceipt') : e.source === 'Shelf Tag' ? t('srcShelf') : t('srcInitial')

  const renderRow = ({ entry, previous }: FeedRow) => {
    const demo = isDemoEntry(entry)
    const product = products.find((p) => p.id === entry.productId)
    const store = stores.find((s) => s.id === entry.storeId)
    const delta = previous ? entry.priceKwd - previous.priceKwd : null
    const isReceipt = entry.source === 'Receipt Scan'
    return (
      <li key={entry.id} className="flex items-start gap-3 px-4 py-3.5">
        <span
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            demo ? 'bg-gold-light text-gold-dark' : isReceipt ? 'bg-navy text-brand' : 'bg-brand-light text-brand-dark'
          }`}
        >
          {demo ? (
            <FlaskConical size={19} aria-hidden="true" />
          ) : isReceipt ? (
            <Receipt size={19} aria-hidden="true" />
          ) : (
            <Tag size={19} aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p dir="auto" className="line-clamp-2 text-[15px] leading-snug font-bold text-ink">
            {productName(product)}
          </p>
          <p dir="auto" className="mt-0.5 truncate text-sm text-slate-600">
            {storeName(store)}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
            <span
              className={`rounded-full px-2.5 py-0.5 font-semibold ${
                demo
                  ? 'border border-dashed border-gold bg-gold-light text-gold-dark'
                  : isReceipt
                    ? 'bg-navy text-brand'
                    : 'bg-brand-light text-brand-dark'
              }`}
            >
              {sourceLabel(entry)}
            </span>
            {/* Seeded demo prices carry no confidence or timestamp: they were never scanned. */}
            {!demo && (
              <span className="whitespace-nowrap">
                <span dir="ltr">{entry.confidence}%</span> · {timeAgo(entry.timestamp, lang)}
              </span>
            )}
          </p>
        </div>

        <div className="shrink-0 text-end" dir="ltr">
          <p className="text-base font-extrabold text-ink">{formatKwd(entry.priceKwd)}</p>
          {/* Seeded demo history is not a real price change, so only verified scans show deltas. */}
          {!demo && delta !== null && Math.abs(delta) >= 0.0005 && (
            <p className={`mt-0.5 text-sm font-bold ${delta < 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {delta < 0 ? '↓' : '↑'} {Math.abs(delta).toFixed(3)} KD
            </p>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-6">
      {/* Verified scans */}
      <section className="space-y-3">
        <div className="px-1">
          <h2 className="text-lg font-bold text-ink">{t('feedTitle')}</h2>
          <p className="text-sm text-slate-600">{t('feedSubtitle')}</p>
          {scanRecords.length > 0 && (
            <span className="mt-2 inline-block rounded-full bg-brand-light px-3 py-1 text-[13px] font-bold text-brand-dark">
              {t('verifiedScans', { n: scanRecords.length })}
            </span>
          )}
        </div>

        {realRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-7 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand-dark">
              <ScanLine size={22} aria-hidden="true" />
            </span>
            <p className="mx-auto max-w-[260px] text-[15px] leading-relaxed text-slate-600">{t('feedEmpty')}</p>
          </div>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">{realRows.map(renderRow)}</ul>
        )}
      </section>

      {/* Seeded demo estimates: clearly separated, never presented as real scans */}
      {demoRows.length > 0 && (
        <section className="space-y-3">
          <div className="px-1">
            <h3 className="flex items-center gap-2 text-base font-bold text-gold-dark">
              <FlaskConical size={18} aria-hidden="true" /> {t('feedDemoTitle')}
            </h3>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{t('feedDemoNote')}</p>
          </div>
          <ul className="card divide-y divide-line overflow-hidden border-dashed border-gold/70">{visibleDemo.map(renderRow)}</ul>
          {demoRows.length > DEMO_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllDemo((v) => !v)}
              aria-expanded={showAllDemo}
              className="btn btn-secondary w-full"
            >
              {showAllDemo ? t('feedShowLess') : t('feedShowAll', { n: demoRows.length })}
              <ChevronDown size={18} className={`transition-transform ${showAllDemo ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          )}
        </section>
      )}
    </div>
  )
}
