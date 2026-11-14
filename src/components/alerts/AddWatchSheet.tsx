import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { ProductListItem } from '../../types/api'
import { formatSize, nameFor, round3 } from '../../utils/apiFormat'
import { formatKwd } from '../../utils/formatters'
import BottomSheet from '../ui/BottomSheet'
import PriceBadge from '../ui/PriceBadge'
import SearchField from '../ui/SearchField'

export interface AddWatchSheetProps {
  open: boolean
  onClose: () => void
  query: string
  onQueryChange: (query: string) => void
  results: ProductListItem[]
  resultsStatus: 'idle' | 'loading' | 'error'
  selected: ProductListItem | null
  onSelect: (product: ProductListItem | null) => void
  /** targetKwd is already rounded to 3 decimals and greater than 0. */
  onSubmit: (productId: number, targetKwd: number) => void
  submitting?: boolean
  submitError?: boolean
}

const QUICK_DROPS = [5, 10, 15]

/** Bottom sheet to add a price watch: pick a product, then a target price (quick chips use the real current price). */
export default function AddWatchSheet(p: AddWatchSheetProps) {
  const { t, lang } = useApp()
  return (
    <BottomSheet open={p.open} onClose={p.onClose} title={t('watchAddCta')}>
      {p.selected ? (
        <TargetForm key={p.selected.id} {...p} product={p.selected} />
      ) : (
        <div className="space-y-3">
          <SearchField value={p.query} onChange={p.onQueryChange} placeholder={t('watchSearchPlaceholder')} loading={p.resultsStatus === 'loading'} />
          {p.resultsStatus === 'error' && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {t('basketSearchError')}
            </p>
          )}
          {p.query.trim() && p.resultsStatus !== 'error' && p.resultsStatus !== 'loading' && p.results.length === 0 && (
            <p className="px-1 text-[15px] text-slate-600">{t('basketSearchEmpty', { q: p.query.trim() })}</p>
          )}
          {p.results.length > 0 && (
            <ul className="card divide-y divide-line overflow-hidden">
              {p.results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => p.onSelect(r)}
                    className="flex min-h-14 w-full flex-col items-start gap-1 px-4 py-3 text-start hover:bg-slate-50"
                  >
                    <span dir="auto" className="text-[15px] leading-snug font-bold text-ink">
                      {nameFor(r, lang)}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                      <span dir="auto">{formatSize(r.sizeValue, r.sizeUnit, lang)}</span>
                      {r.bestPrice && (
                        <>
                          <span dir="ltr" className="font-bold text-ink">
                            {t('priceFrom', { price: formatKwd(r.bestPrice.priceKwd) })}
                          </span>
                          <PriceBadge trust={r.bestPrice.trust} />
                        </>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

function TargetForm({ product, onSelect, onSubmit, submitting, submitError }: AddWatchSheetProps & { product: ProductListItem }) {
  const { t, lang } = useApp()
  const [text, setText] = useState('')
  const best = product.bestPrice
  const parsed = parseFloat(text.replace(',', '.'))
  const valid = Number.isFinite(parsed) && parsed > 0
  const target = valid ? round3(parsed) : null

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (target != null) onSubmit(product.id, target)
      }}
    >
      <div className="card flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p dir="auto" className="text-[15px] leading-snug font-bold text-ink">
            {nameFor(product, lang)}
          </p>
          <p dir="auto" className="mt-0.5 text-sm text-slate-600">
            {formatSize(product.sizeValue, product.sizeUnit, lang)}
          </p>
        </div>
        <button type="button" onClick={() => onSelect(null)} className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold text-brand-dark hover:bg-brand-light">
          {t('watchChange')}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-600">{t('watchCurrentBest')}</span>
        {best ? (
          <span className="flex items-center gap-2">
            <span dir="ltr" className="text-base font-extrabold text-ink">
              {formatKwd(best.priceKwd)}
            </span>
            <PriceBadge trust={best.trust} isPromo={best.isPromo} />
          </span>
        ) : (
          <span className="text-sm font-semibold text-slate-500">{t('watchNoPrice')}</span>
        )}
      </div>

      <div>
        <label htmlFor="watch-target" className="block text-sm font-semibold text-slate-700">
          {t('watchTargetLabel')}
        </label>
        <div className="mt-1.5 flex min-h-12 items-center gap-2 rounded-xl border border-line bg-white px-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
          <input
            id="watch-target"
            dir="ltr"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="0.000"
            className="h-11 min-w-0 flex-1 bg-transparent text-end text-lg font-bold text-ink outline-none"
          />
          <span className="text-sm font-semibold text-slate-500">KD</span>
        </div>
        {text !== '' && !valid && <p className="mt-1.5 text-sm font-medium text-red-700">{t('watchTargetInvalid')}</p>}
        {target != null && best && target >= best.priceKwd && <p className="mt-1.5 text-sm text-gold-dark">{t('watchTargetAbove')}</p>}
      </div>

      {best && (
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-600">{t('watchQuick')}</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_DROPS.map((pct) => {
              const value = round3(best.priceKwd * (1 - pct / 100))
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setText(value.toFixed(3))}
                  className="min-h-11 rounded-full border border-line bg-white px-4 text-sm font-bold text-ink hover:border-brand"
                >
                  <span dir="ltr">−{pct}% · {formatKwd(value)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {submitError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {t('watchSaveError')}
        </p>
      )}

      <button type="submit" disabled={!valid || submitting} className="btn btn-primary min-h-14 w-full text-base disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none">
        {submitting && <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />}
        {submitting ? t('watchSaving') : t('watchSave')}
      </button>
    </form>
  )
}
