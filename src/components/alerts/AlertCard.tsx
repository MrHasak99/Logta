import { BellRing, Check, Store, TrendingDown } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { AlertEntry } from '../../types/api'
import { formatSize, nameFor } from '../../utils/apiFormat'
import { formatKwd, timeAgo } from '../../utils/formatters'

interface Props {
  entry: AlertEntry
  onMarkSeen: (alertId: number) => void
  /** True while the mark-as-seen request is in flight. */
  busy?: boolean
}

/** One fired price alert. `hint` and `stats` may be null on older alerts, in which case the server message is shown. */
export default function AlertCard({ entry, onMarkSeen, busy }: Props) {
  const { t, lang } = useApp()
  const { alert, product, store, priceKwd, hint, stats } = entry
  const unseen = !alert.seen
  const message = lang === 'ar' ? alert.messageAr || alert.messageEn : alert.messageEn || alert.messageAr

  // Position of the triggering price inside the 30-day range (computed from real stats only).
  const range = stats && stats.max > stats.min ? Math.min(100, Math.max(0, ((priceKwd - stats.min) / (stats.max - stats.min)) * 100)) : null

  return (
    <article className={`card overflow-hidden p-4 ${unseen ? 'border-s-4 border-s-gold' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p dir="auto" className="text-[15px] leading-snug font-bold text-ink">
            {nameFor(product, lang)}
          </p>
          <p dir="auto" className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
            <Store size={14} className="shrink-0" aria-hidden="true" />
            <span>
              {nameFor(store, lang)} · {formatSize(product.sizeValue, product.sizeUnit, lang)}
            </span>
          </p>
        </div>
        <p dir="ltr" className="shrink-0 text-xl font-extrabold text-ink">
          {formatKwd(priceKwd)}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {unseen && <span className="rounded-full bg-gold px-2.5 py-0.5 text-[13px] font-bold text-navy">{t('alertNew')}</span>}
        {hint === 'buy_now' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1 text-sm font-bold text-brand-dark">
            <BellRing size={14} aria-hidden="true" /> {t('alertHintBuyNow')}
          </span>
        )}
        {hint === 'lower_seen_recently' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
            <TrendingDown size={14} aria-hidden="true" /> {t('alertHintLower')}
          </span>
        )}
        <span className="text-sm text-slate-500">
          {t('alertTarget', { amount: formatKwd(entry.watch.targetPriceKwd) })} · {timeAgo(entry.observedAt, lang)}
        </span>
      </div>

      {stats ? (
        <section className="mt-3.5 rounded-xl bg-slate-50 px-3.5 py-3" dir="ltr" aria-label={t('alertStatsTitle')}>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{t('alertStatsTitle')}</p>
          {range != null && (
            <div className="relative mt-3 mb-1 h-1.5 rounded-full bg-slate-200">
              <span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-dark shadow"
                style={{ left: `${range}%` }}
              />
            </div>
          )}
          <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            {(
              [
                ['alertStatLow', stats.min],
                ['alertStatAvg', stats.avg],
                ['alertStatHigh', stats.max],
              ] as const
            ).map(([key, value]) => (
              <div key={key}>
                <dt className="text-[13px] text-slate-600">{t(key)}</dt>
                <dd className="text-[15px] font-bold text-ink">{formatKwd(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <p dir="auto" className="mt-3.5 rounded-xl bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-700">
          {message}
        </p>
      )}

      <div className="mt-3.5">
        {unseen ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onMarkSeen(alert.id)}
            className="btn btn-secondary min-h-11 w-full text-sm"
          >
            <Check size={16} aria-hidden="true" /> {t('alertMarkSeen')}
          </button>
        ) : (
          <p className="flex min-h-8 items-center gap-1.5 text-sm font-medium text-slate-500">
            <Check size={15} aria-hidden="true" /> {t('alertSeen')}
          </p>
        )}
      </div>
    </article>
  )
}
