import { Receipt, Tag } from 'lucide-react'
import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import type { PriceSource } from '../../data/types'
import { latestEntry } from '../../services/priceCommit'
import { formatKwd, timeAgo } from '../../utils/formatters'

const FEED_SIZE = 20

export default function RecentScansFeed() {
  const { t, lang, priceEntries, products, stores, scanRecords, productName, storeName } = useApp()

  const rows = useMemo(() => {
    // Only the current price per product/store, newest first. Prefer user-verified sources.
    const verified = priceEntries
      .filter((e) => e.source !== 'Initial Index')
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const seen = new Set<string>()
    const out = []
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

  const sourceLabel = (s: PriceSource) => (s === 'Receipt Scan' ? t('srcReceipt') : s === 'Shelf Tag' ? t('srcShelf') : t('srcInitial'))

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between px-1">
        <div>
          <h2 className="text-sm font-extrabold text-navy">{t('feedTitle')}</h2>
          <p className="text-[11px] text-slate-500">{t('feedSubtitle')}</p>
        </div>
        {scanRecords.length > 0 && (
          <span className="rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-bold text-brand-dark">
            {t('verifiedScans', { n: scanRecords.length })}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
          {t('feedEmpty')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {rows.map(({ entry, previous }) => {
            const product = products.find((p) => p.id === entry.productId)
            const store = stores.find((s) => s.id === entry.storeId)
            const delta = previous ? entry.priceKwd - previous.priceKwd : null
            return (
              <li key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    entry.source === 'Receipt Scan' ? 'bg-navy text-brand' : 'bg-brand-light text-brand-dark'
                  }`}
                >
                  {entry.source === 'Receipt Scan' ? <Receipt size={15} /> : <Tag size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate text-[13px] font-bold text-navy">
                    {productName(product)}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {storeName(store)} · {sourceLabel(entry.source)} · {entry.confidence}% · {timeAgo(entry.timestamp, lang)}
                  </p>
                </div>
                <div className="shrink-0 text-end" dir="ltr">
                  <p className="text-sm font-extrabold text-navy">{formatKwd(entry.priceKwd)}</p>
                  {delta !== null && Math.abs(delta) >= 0.0005 && (
                    <p className={`text-[11px] font-bold ${delta < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {delta < 0 ? '↓' : '↑'} {Math.abs(delta).toFixed(3)} KD
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
