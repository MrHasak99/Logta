import { AlertTriangle, Check, CheckCircle2, PackagePlus, ShieldCheck, Undo2, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { DocumentType, ExtractedItem, ExtractionResult } from '../../data/types'
import { TRUST_WEIGHT } from '../../services/priceCommit'
import { formatKwd } from '../../utils/formatters'

export type ItemDecision = 'pending' | 'confirmed' | 'rejected'

export interface ReviewState {
  storeId: string | null
  documentType: DocumentType
  receiptDate: string
  items: ExtractedItem[]
  /** Per-line decision keyed by item uid. Names and prices are never edited, only confirmed or rejected. */
  decisions: Record<string, ItemDecision>
}

interface Props {
  result: ExtractionResult
  review: ReviewState
  onChange: (review: ReviewState) => void
  onConfirm: () => void
  onCancel: () => void
}

const LOW_CONFIDENCE = 70

export const initialDecisions = (items: ExtractedItem[]): Record<string, ItemDecision> =>
  Object.fromEntries(items.map((i) => [i.uid, i.priceKwd > 0 ? 'pending' : 'rejected'])) // no price = nothing to save

export default function VerificationTable({ result, review, onChange, onConfirm, onCancel }: Props) {
  const { t, lang, stores, products, storeName, productName } = useApp()

  const decide = (uid: string, decision: ItemDecision) =>
    onChange({ ...review, decisions: { ...review.decisions, [uid]: decision } })

  const confirmRemaining = () =>
    onChange({
      ...review,
      decisions: Object.fromEntries(
        review.items.map((i) => [i.uid, review.decisions[i.uid] === 'pending' ? 'confirmed' : review.decisions[i.uid]]),
      ) as Record<string, ItemDecision>,
    })

  const count = (d: ItemDecision) => review.items.filter((i) => review.decisions[i.uid] === d).length
  const pending = count('pending')
  const confirmed = count('confirmed')
  const rejected = count('rejected')
  const canConfirm = !!review.storeId && pending === 0 && confirmed > 0
  const trust = TRUST_WEIGHT[review.documentType]
  const store = stores.find((s) => s.id === review.storeId)

  const displayName = (item: ExtractedItem): string => {
    const product = products.find((p) => p.id === item.matchedProductId)
    if (product) return productName(product)
    const draft = item.newProduct
    if (!draft) return item.rawText
    return (lang === 'ar' ? draft.nameAr || draft.nameEn : draft.nameEn || draft.nameAr) || item.rawText
  }

  return (
    <section className="space-y-3">
      <div className="rounded-2xl bg-navy p-4 text-white">
        <h2 className="text-sm font-bold">{t('reviewTitle')}</h2>
        <p className="mt-0.5 text-xs text-slate-400">{t('reviewHint')}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${store ? 'bg-brand text-navy' : 'bg-amber-400 text-navy'}`}
          >
            {store ? storeName(store) : t('storeNotDetected')}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-navy-800 px-3 py-1 text-xs font-semibold text-brand">
            <ShieldCheck size={13} />
            {review.documentType === 'receipt' ? t('trustReceipt') : t('trustShelf')}
          </span>
          <span className="rounded-full bg-navy-800 px-3 py-1 text-xs text-slate-300">{review.receiptDate}</span>
        </div>

        {/* Only needed when the store could not be read from the image. */}
        {result.storeId === null && (
          <label className="mt-3 block text-[11px] font-semibold text-slate-400">
            {t('store')}
            <select
              value={review.storeId ?? ''}
              onChange={(e) => onChange({ ...review, storeId: e.target.value || null })}
              className="mt-1 w-full rounded-lg border border-navy-700 bg-navy-800 px-2 py-2 text-xs text-white"
            >
              <option value="">{t('selectStore')}</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {storeName(s)}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          {result.provider === 'simulated' ? t('modeSimulated') : `${t('modeLive')} · ${result.provider}`}
        </p>
      </div>

      {result.notice && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {result.notice}
        </p>
      )}

      {review.items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {t('noItemsLeft')}
        </p>
      ) : (
        <ul className="space-y-2">
          {review.items.map((item) => {
            const decision = review.decisions[item.uid] ?? 'pending'
            const noPrice = item.priceKwd <= 0
            const low = item.confidenceScore < LOW_CONFIDENCE
            const isNew = !item.matchedProductId
            return (
              <li
                key={item.uid}
                className={`rounded-xl border p-3 transition-colors ${
                  decision === 'confirmed'
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : decision === 'rejected'
                      ? 'border-slate-200 bg-slate-50 opacity-60'
                      : low
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p dir="auto" className={`text-sm font-bold text-navy ${decision === 'rejected' ? 'line-through' : ''}`}>
                      {displayName(item)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {t('rawText')}: <span dir="auto" className="font-mono font-semibold text-slate-700">{item.rawText}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p dir="ltr" className="text-sm font-extrabold text-navy">
                      {noPrice ? '—' : formatKwd(item.priceKwd)}
                    </p>
                    <ConfidenceBadge value={item.confidenceScore} label={t('confidenceShort')} />
                  </div>
                </div>

                {(isNew || low || noPrice) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {isNew && (
                      <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                        <PackagePlus size={12} /> {t('newProduct')} · {t('newProductHint')}
                      </span>
                    )}
                    {noPrice && (
                      <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        <AlertTriangle size={12} /> {t('noPrice')}
                      </span>
                    )}
                    {low && !noPrice && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        <AlertTriangle size={12} /> {t('lowConfidence')}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-2.5">
                  {decision === 'pending' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => decide(item.uid, 'rejected')}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
                      >
                        <X size={15} /> {t('rejectLine')}
                      </button>
                      <button
                        type="button"
                        disabled={noPrice}
                        onClick={() => decide(item.uid, 'confirmed')}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-navy transition-colors hover:bg-brand-dark hover:text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        <Check size={15} /> {t('confirmLine')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex items-center gap-1 text-xs font-bold ${decision === 'confirmed' ? 'text-emerald-700' : 'text-slate-500'}`}
                      >
                        {decision === 'confirmed' ? <Check size={14} /> : <X size={14} />}
                        {decision === 'confirmed' ? t('confirmedLabel') : t('rejectedLabel')}
                      </span>
                      <button
                        type="button"
                        onClick={() => decide(item.uid, 'pending')}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-navy"
                      >
                        <Undo2 size={12} /> {t('undoLine')}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="sticky bottom-20 space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
        {pending > 0 ? (
          <>
            <p className="text-center text-[11px] font-medium text-amber-700">{t('decideLines', { n: pending })}</p>
            <button
              type="button"
              onClick={confirmRemaining}
              disabled={review.items.every((i) => review.decisions[i.uid] !== 'pending' || i.priceKwd <= 0)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-navy transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {t('confirmRemaining')}
            </button>
          </>
        ) : (
          review.items.length > 0 && (
            <p className="text-center text-[11px] text-slate-500">
              {t('itemsToSave', { n: confirmed, r: rejected })} · {trust}% {t('confidence').toLowerCase()}
            </p>
          )
        )}
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-navy shadow-sm transition-colors hover:bg-brand-dark hover:text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <CheckCircle2 size={18} /> {t('confirm')}
        </button>
        <button type="button" onClick={onCancel} className="w-full py-1.5 text-xs font-semibold text-slate-500 hover:text-navy">
          {t('cancel')}
        </button>
      </div>
    </section>
  )
}

function ConfidenceBadge({ value, label }: { value: number; label: string }) {
  const tone =
    value >= 85 ? 'bg-emerald-100 text-emerald-800' : value >= LOW_CONFIDENCE ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
  return (
    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
      {label} {value}%
    </span>
  )
}
