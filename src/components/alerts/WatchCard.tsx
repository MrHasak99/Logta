import { BellRing, Clock, Target, Trash2, TrendingDown } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { WatchCardData } from '../../types/api'
import { formatSize, nameFor, round3 } from '../../utils/apiFormat'
import { formatKwd } from '../../utils/formatters'
import PriceBadge from '../ui/PriceBadge'

interface Props {
  entry: WatchCardData
  onRemove: (watchId: number) => void
  busy?: boolean
  /** Browser-mode quick test: shown on watches whose target is not reached yet. */
  onSimulateDrop?: (watchId: number) => void
}

/** An active price watch with target vs current best price and a two-step remove. */
export default function WatchCard({ entry, onRemove, busy, onSimulateDrop }: Props) {
  const { t, lang } = useApp()
  const [confirming, setConfirming] = useState(false)
  const { watch, product, currentBest, insight } = entry
  const now = currentBest?.priceKwd ?? null
  const reached = now != null && now <= watch.targetPriceKwd
  const gap = now != null && !reached ? round3(now - watch.targetPriceKwd) : null
  // How close the current price is to the target (target / now). Computed from real prices only.
  const pct = now != null && now > 0 ? Math.min(100, (watch.targetPriceKwd / now) * 100) : null

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p dir="auto" className="text-[15px] leading-snug font-bold text-ink">
            {nameFor(product, lang)}
          </p>
          <p dir="auto" className="mt-0.5 text-sm text-slate-600">
            {[product.brand, formatSize(product.sizeValue, product.sizeUnit, lang)].filter(Boolean).join(' · ')}
          </p>
        </div>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={t('watchRemove')}
            title={t('watchRemove')}
            className="-me-2 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={19} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
          <p className="flex items-center gap-1.5 text-sm text-slate-600">
            <Target size={14} aria-hidden="true" /> {t('watchTarget')}
          </p>
          <p dir="ltr" className="text-lg font-extrabold text-ink">
            {formatKwd(watch.targetPriceKwd)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
          <p className="text-sm text-slate-600">{t('watchNow')}</p>
          {now != null ? (
            <p dir="ltr" className="text-lg font-extrabold text-ink">
              {formatKwd(now)}
            </p>
          ) : (
            <p className="text-sm font-semibold text-slate-500">{t('watchNoPrice')}</p>
          )}
        </div>
      </div>

      {insight && (
        <div className="mt-2.5 rounded-xl bg-slate-50 px-3.5 py-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
              insight.timing === 'buy_now' ? 'bg-brand-light text-brand-dark' : 'bg-amber-100 text-amber-900'
            }`}
          >
            {insight.timing === 'buy_now' ? <BellRing size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
            {insight.timing === 'buy_now' ? t('watchTimingBuyNow') : t('watchTimingWait')}
          </span>
          <dl dir="ltr" className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div>
              <dt className="text-[13px] text-slate-600">{t('alertStatsTitle')} · {t('alertStatLow')}</dt>
              <dd className="text-[15px] font-bold text-ink">{formatKwd(insight.low)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-slate-600">{t('alertStatsTitle')} · {t('alertStatHigh')}</dt>
              <dd className="text-[15px] font-bold text-ink">{formatKwd(insight.high)}</dd>
            </div>
          </dl>
        </div>
      )}

      {currentBest && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <PriceBadge trust={currentBest.trust} isPromo={currentBest.isPromo} />
          {reached ? (
            <span className="rounded-full bg-gold px-3 py-1 text-sm font-bold text-navy">{t('watchReached')}</span>
          ) : (
            gap != null && <span className="text-sm text-slate-600">{t('watchNeedsDrop', { amount: formatKwd(gap) })}</span>
          )}
        </div>
      )}
      {pct != null && !reached && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200" role="presentation">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      )}

      {onSimulateDrop && !reached && !confirming && (
        <button type="button" disabled={busy} onClick={() => onSimulateDrop(watch.id)} className="btn btn-secondary mt-3 min-h-11 w-full text-sm">
          <TrendingDown size={16} aria-hidden="true" /> {t('watchSimulateDrop')}
        </button>
      )}

      {confirming && (
        <div role="alertdialog" aria-label={t('watchRemoveAsk', { product: nameFor(product, lang) })} className="mt-3.5 rounded-xl bg-red-50 px-4 py-3.5">
          <p dir="auto" className="text-[15px] font-bold text-red-800">
            {t('watchRemoveAsk', { product: nameFor(product, lang) })}
          </p>
          <p className="mt-0.5 text-sm text-red-700">{t('watchRemoveHint')}</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary min-h-11 text-sm">
              {t('watchKeep')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRemove(watch.id)}
              className="btn min-h-11 bg-red-600 text-sm text-white hover:bg-red-700"
            >
              {t('watchRemoveConfirm')}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
