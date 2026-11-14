import { AlertTriangle, Check, CheckCircle2, ChevronDown, CircleHelp, Info, PackagePlus, ShieldCheck, Store, Undo2, X } from 'lucide-react'
import type { ReactNode } from 'react'
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

/** 'new' = no catalogue match; it is auto-created as a new product if the user confirms it. */
type ItemState = 'ok' | 'low' | 'noprice' | 'new'

const itemState = (item: ExtractedItem): ItemState =>
  item.priceKwd <= 0 ? 'noprice' : !item.matchedProductId ? 'new' : item.confidenceScore < LOW_CONFIDENCE ? 'low' : 'ok'

const CARD_TONE: Record<ItemState, string> = {
  ok: 'border-line border-s-brand bg-white',
  low: 'border-amber-300 border-s-amber-400 bg-amber-50/60',
  noprice: 'border-red-300 border-s-red-500 bg-red-50/50',
  new: 'border-sky-200 border-s-sky-400 bg-sky-50/50',
}

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
    <section className="space-y-4">
      {/* Receipt details */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-ink">{t('reviewTitle')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('reviewHint')}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="-me-2 -mt-1 flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink"
          >
            {t('cancel')}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${store ? 'bg-navy text-brand' : 'bg-amber-100 text-amber-700'}`}
          >
            <Store size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p dir="auto" className={`text-lg leading-snug font-bold ${store ? 'text-ink' : 'text-amber-800'}`}>
              {store ? storeName(store) : t('storeNotDetected')}
            </p>
            <p className="text-sm text-slate-500" dir="ltr">
              {review.receiptDate}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1.5 text-sm font-semibold text-brand-dark">
            <ShieldCheck size={15} aria-hidden="true" />
            {review.documentType === 'receipt' ? t('trustReceipt') : t('trustShelf')}
          </span>
          <span
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${result.provider === 'simulated' ? 'bg-gold-light text-gold-dark' : 'bg-slate-100 text-slate-600'}`}
          >
            {result.provider === 'simulated' ? t('modeSimulated') : `${t('modeLive')} · ${result.provider}`}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <Field label={t('store')}>
            <select
              value={review.storeId ?? ''}
              onChange={(e) => onChange({ ...review, storeId: e.target.value || null })}
              className={`${SELECT_CLS} text-sm ${review.storeId ? 'border-line' : 'border-amber-400 bg-amber-50'}`}
            >
              <option value="">{t('selectStore')}</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {storeName(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('documentType')}>
            <select
              value={review.documentType}
              onChange={(e) => onChange({ ...review, documentType: e.target.value as DocumentType })}
              className={`${SELECT_CLS} border-line text-sm`}
            >
              <option value="receipt">{t('docReceipt')}</option>
              <option value="shelf_tag">{t('docShelfTag')}</option>
            </select>
          </Field>
        </div>
      </div>

      {result.notice && (
        <p role="alert" className="flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed font-medium text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> {result.notice}
        </p>
      )}

      {/* Progress summary */}
      {review.items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1.5 text-sm font-bold text-brand-dark">
            <CheckCircle2 size={15} aria-hidden="true" /> {t('readyCount', { n: confirmed })}
          </span>
          {pending > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800">
              <AlertTriangle size={15} aria-hidden="true" /> {t('attentionCount', { n: pending })}
            </span>
          )}
        </div>
      )}

      {review.items.length === 0 ? (
        <p className="card p-8 text-center text-[15px] text-slate-500">{t('noItemsLeft')}</p>
      ) : (
        <ul className="space-y-3">
          {review.items.map((item) => {
            const decision = review.decisions[item.uid] ?? 'pending'
            const state = itemState(item)
            const noPrice = item.priceKwd <= 0
            return (
              <li
                key={item.uid}
                className={`rounded-2xl border border-s-4 p-4 shadow-sm transition-colors ${
                  decision === 'confirmed'
                    ? 'border-line border-s-brand bg-white'
                    : decision === 'rejected'
                      ? 'border-line border-s-slate-300 bg-slate-50 opacity-60'
                      : CARD_TONE[state]
                }`}
              >
                <StatusChip state={state} confidence={item.confidenceScore} label={t('confidenceShort')} t={t} />

                <div className="mt-3 flex items-start justify-between gap-3">
                  <p dir="auto" className={`min-w-0 text-base font-bold text-ink ${decision === 'rejected' ? 'line-through' : ''}`}>
                    {displayName(item)}
                  </p>
                  <p dir="ltr" className="shrink-0 text-lg font-extrabold text-ink">
                    {noPrice ? '—' : formatKwd(item.priceKwd)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {t('rawText')}:{' '}
                  <span dir="auto" className="font-mono font-semibold break-words text-slate-700">
                    {item.rawText}
                  </span>
                </p>

                {state !== 'ok' && (
                  <p
                    className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm leading-relaxed font-medium ${
                      state === 'low'
                        ? 'bg-amber-100/70 text-amber-900'
                        : state === 'new'
                          ? 'bg-sky-100/70 text-sky-900'
                          : 'bg-red-100/70 text-red-800'
                    }`}
                  >
                    <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {state === 'new' ? t('newProductHint') : state === 'noprice' ? t('noPrice') : t('helpLow')}
                  </p>
                )}

                <div className="mt-3.5">
                  {decision === 'pending' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => decide(item.uid, 'rejected')}
                        className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                      >
                        <X size={17} aria-hidden="true" /> {t('rejectLine')}
                      </button>
                      <button
                        type="button"
                        disabled={noPrice}
                        onClick={() => decide(item.uid, 'confirmed')}
                        className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-bold text-navy transition-colors hover:bg-brand-dark hover:text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        <Check size={17} aria-hidden="true" /> {t('confirmLine')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex items-center gap-1.5 text-sm font-bold ${decision === 'confirmed' ? 'text-brand-dark' : 'text-slate-500'}`}
                      >
                        {decision === 'confirmed' ? <Check size={14} /> : <X size={14} />}
                        {decision === 'confirmed' ? t('confirmedLabel') : t('rejectedLabel')}
                      </span>
                      <button
                        type="button"
                        onClick={() => decide(item.uid, 'pending')}
                        className="-me-2 flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-ink"
                      >
                        <Undo2 size={15} aria-hidden="true" /> {t('undoLine')}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Sticky confirmation area: sits just above the bottom nav (~76px tall) */}
      <div className="card sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 space-y-2.5 bg-white/95 p-3.5 backdrop-blur">
        {pending > 0 ? (
          <>
            <p className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-amber-800">
              <AlertTriangle size={16} aria-hidden="true" /> {t('decideLines', { n: pending })}
            </p>
            <button
              type="button"
              onClick={confirmRemaining}
              disabled={review.items.every((i) => review.decisions[i.uid] !== 'pending' || i.priceKwd <= 0)}
              className="btn min-h-12 w-full border border-line bg-white text-sm font-bold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {t('confirmRemaining')}
            </button>
          </>
        ) : (
          review.items.length > 0 && (
            <p
              className={`flex items-center justify-center gap-1.5 text-center text-sm font-semibold ${
                canConfirm ? 'text-brand-dark' : 'text-amber-800'
              }`}
            >
              {canConfirm ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
              {canConfirm
                ? `${t('itemsToSave', { n: confirmed, r: rejected })} · ${trust}% ${t('confidence').toLowerCase()}`
                : review.storeId
                  ? t('noItemsLeft')
                  : t('chooseStoreFirst')}
            </p>
          )
        )}
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
          className="btn btn-primary min-h-14 w-full text-base disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none"
        >
          <CheckCircle2 size={20} aria-hidden="true" /> {t('confirm')}
        </button>
      </div>
    </section>
  )
}

const SELECT_CLS =
  'w-full min-h-12 appearance-none rounded-xl border bg-white ps-3 pe-9 font-semibold text-ink'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-600">
      {label}
      <span className="relative mt-1.5 block">
        {children}
        <ChevronDown size={16} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      </span>
    </label>
  )
}

function StatusChip({
  state,
  confidence,
  label,
  t,
}: {
  state: ItemState
  confidence: number
  label: string
  t: ReturnType<typeof useApp>['t']
}) {
  const config = {
    ok: { cls: 'bg-brand-light text-brand-dark', icon: <CheckCircle2 size={15} aria-hidden="true" />, text: t('statusMatched') },
    new: { cls: 'bg-sky-100 text-sky-800', icon: <PackagePlus size={15} aria-hidden="true" />, text: t('newProduct') },
    low: { cls: 'bg-amber-100 text-amber-800', icon: <AlertTriangle size={15} aria-hidden="true" />, text: t('statusCheck') },
    noprice: { cls: 'bg-red-100 text-red-700', icon: <CircleHelp size={15} aria-hidden="true" />, text: t('statusNoPrice') },
  }[state]
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${config.cls}`}>
      {config.icon}
      {config.text}
      {state !== 'new' && state !== 'noprice' && (
        <span className="font-semibold opacity-80">
          · {label} {confidence}%
        </span>
      )}
    </span>
  )
}
