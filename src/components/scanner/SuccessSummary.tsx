import { CheckCircle2, ScanLine, TrendingDown, TrendingUp } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { PriceDelta, ScanSummary } from '../../data/types'
import { formatKwd } from '../../utils/formatters'

interface Props {
  summary: ScanSummary
  onReset: () => void
}

export default function SuccessSummary({ summary, onReset }: Props) {
  const { t, stores, products, storeName, productName } = useApp()
  const store = stores.find((s) => s.id === summary.storeId)

  const describe = (d: PriceDelta): { text: string; tone: 'down' | 'up' | 'flat' | 'new' } => {
    const product = productName(products.find((p) => p.id === d.productId))
    const base = `${product} ${d.previousPrice === null ? t('newPriceAt') : t('updatedAt')} ${storeName(store)}: ${formatKwd(d.newPrice)}`
    if (d.delta === null) return { text: `${base} (${t('firstPrice')})`, tone: 'new' }
    if (Math.abs(d.delta) < 0.0005) return { text: `${base} (${t('unchangedPrev')})`, tone: 'flat' }
    const amount = Math.abs(d.delta).toFixed(3)
    return d.delta < 0
      ? { text: `${base} (↓ ${amount} KD ${t('cheaperThanPrev')})`, tone: 'down' }
      : { text: `${base} (↑ ${amount} KD ${t('pricierThanPrev')})`, tone: 'up' }
  }

  const lines = summary.deltas.map((d) => ({ d, ...describe(d) }))

  return (
    <section className="animate-pop-in overflow-hidden rounded-2xl border border-emerald-200 bg-white">
      <div className="bg-brand px-4 py-5 text-center text-navy">
        <CheckCircle2 size={40} className="mx-auto mb-1.5" />
        <h2 className="text-base font-extrabold">{t('successTitle')}</h2>
        <p className="text-xs font-medium opacity-80">{storeName(store)}</p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 rtl:divide-x-reverse">
        <Stat value={summary.added} label={t('itemsAdded')} />
        <Stat value={summary.updated} label={t('itemsUpdated')} />
      </div>

      <ul className="divide-y divide-slate-100">
        {lines.map(({ d, text, tone }) => (
          <li key={d.productId} className="flex items-start gap-2.5 px-4 py-3 text-[13px] leading-snug">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                tone === 'down'
                  ? 'bg-emerald-100 text-emerald-700'
                  : tone === 'up'
                    ? 'bg-red-100 text-red-600'
                    : tone === 'new'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-slate-100 text-slate-500'
              }`}
            >
              {tone === 'down' ? <TrendingDown size={12} /> : tone === 'up' ? <TrendingUp size={12} /> : <span className="text-[10px] font-bold">•</span>}
            </span>
            <span className="text-slate-700">{text}</span>
          </li>
        ))}
      </ul>

      <div className="p-3">
        <button
          type="button"
          onClick={onReset}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-navy-800"
        >
          <ScanLine size={18} /> {t('scanAnother')}
        </button>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className="text-2xl font-extrabold text-navy">{value}</p>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
    </div>
  )
}
