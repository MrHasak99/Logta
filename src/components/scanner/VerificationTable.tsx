import { AlertTriangle, CheckCircle2, ChevronDown, CircleHelp, Info, ShieldCheck, Store, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useApp } from '../../context/AppContext'
import type { DocumentType, ExtractedItem, ExtractionResult } from '../../data/types'
import { TRUST_WEIGHT } from '../../services/priceCommit'
import { roundKwd } from '../../utils/formatters'

export interface ReviewState {
  storeId: string | null
  documentType: DocumentType
  receiptDate: string
  items: ExtractedItem[]
}

interface Props {
  result: ExtractionResult
  review: ReviewState
  onChange: (review: ReviewState) => void
  onConfirm: () => void
  onCancel: () => void
}

const LOW_CONFIDENCE = 70

type ItemState = 'ok' | 'low' | 'noprice' | 'unmatched'

const itemState = (item: ExtractedItem): ItemState =>
  !item.matchedProductId ? 'unmatched' : item.priceKwd <= 0 ? 'noprice' : item.confidenceScore < LOW_CONFIDENCE ? 'low' : 'ok'

const CARD_TONE: Record<ItemState, string> = {
  ok: 'border-line border-s-brand bg-white',
  low: 'border-amber-300 border-s-amber-400 bg-amber-50/60',
  noprice: 'border-red-300 border-s-red-500 bg-red-50/50',
  unmatched: 'border-red-300 border-s-red-500 bg-red-50/50',
}

export default function VerificationTable({ result, review, onChange, onConfirm, onCancel }: Props) {
  const { t, stores, products, storeName, productName } = useApp()

  const updateItem = (uid: string, patch: Partial<ExtractedItem>) =>
    onChange({ ...review, items: review.items.map((i) => (i.uid === uid ? { ...i, ...patch } : i)) })

  const setProduct = (uid: string, productId: string) => {
    const p = products.find((x) => x.id === productId)
    updateItem(uid, {
      matchedProductId: p?.id ?? null,
      canonicalNameEn: p?.nameEn ?? '',
      canonicalNameAr: p?.nameAr ?? '',
      confidenceScore: p ? 100 : 0,
      userEdited: true,
    })
  }

  const removeItem = (uid: string) => onChange({ ...review, items: review.items.filter((i) => i.uid !== uid) })

  const unmatched = review.items.filter((i) => !i.matchedProductId || i.priceKwd <= 0).length
  const saveable = review.items.length - unmatched
  const canConfirm = !!review.storeId && saveable > 0 && unmatched === 0
  const trust = TRUST_WEIGHT[review.documentType]
  const store = stores.find((s) => s.id === review.storeId)
  const lowCount = review.items.filter((i) => itemState(i) === 'low').length

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
            <CheckCircle2 size={15} aria-hidden="true" /> {t('readyCount', { n: saveable })}
          </span>
          {unmatched + lowCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800">
              <AlertTriangle size={15} aria-hidden="true" /> {t('attentionCount', { n: unmatched + lowCount })}
            </span>
          )}
        </div>
      )}

      {review.items.length === 0 ? (
        <p className="card p-8 text-center text-[15px] text-slate-500">{t('noItemsLeft')}</p>
      ) : (
        <ul className="space-y-3">
          {review.items.map((item) => {
            const state = itemState(item)
            return (
              <li key={item.uid} className={`rounded-2xl border border-s-4 p-4 shadow-sm ${CARD_TONE[state]}`}>
                <div className="flex items-start justify-between gap-2">
                  <StatusChip state={state} confidence={item.confidenceScore} label={t('confidenceShort')} t={t} />
                  <button
                    type="button"
                    onClick={() => removeItem(item.uid)}
                    aria-label={t('removeLine')}
                    title={t('removeLine')}
                    className="-me-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={19} aria-hidden="true" />
                  </button>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {t('rawText')}:{' '}
                  <span dir="auto" className="font-mono font-semibold break-words text-slate-700">
                    {item.rawText}
                  </span>
                </p>

                <div className="relative mt-3">
                  <select
                    value={item.matchedProductId ?? ''}
                    onChange={(e) => setProduct(item.uid, e.target.value)}
                    aria-label={t('item')}
                    className={`${SELECT_CLS} min-h-14 text-base font-bold ${
                      item.matchedProductId ? 'border-line text-ink' : 'border-red-400 bg-white text-red-700'
                    }`}
                  >
                    <option value="">{t('noMatch')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {productName(p)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-600">{t('price')}</span>
                  <PriceInput
                    value={item.priceKwd}
                    onCommit={(v) => updateItem(item.uid, { priceKwd: v, userEdited: true })}
                    label={t('price')}
                    invalid={item.priceKwd <= 0}
                  />
                </div>

                {state !== 'ok' && (
                  <p
                    className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm leading-relaxed font-medium ${
                      state === 'low' ? 'bg-amber-100/70 text-amber-900' : 'bg-red-100/70 text-red-800'
                    }`}
                  >
                    <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {state === 'unmatched' ? t('helpUnmatched') : state === 'noprice' ? t('helpNoPrice') : t('helpLow')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Sticky confirmation area: sits just above the bottom nav (~76px tall) */}
      <div className="card sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 space-y-2.5 bg-white/95 p-3.5 backdrop-blur">
        {review.items.length > 0 && (
          <p
            className={`flex items-center justify-center gap-1.5 text-center text-sm font-semibold ${
              canConfirm ? 'text-brand-dark' : 'text-amber-800'
            }`}
          >
            {canConfirm ? (
              <>
                <CheckCircle2 size={16} aria-hidden="true" />
                {t('itemsToSave', { n: saveable })} · {trust}% {t('confidence').toLowerCase()}
              </>
            ) : (
              <>
                <AlertTriangle size={16} aria-hidden="true" />
                {unmatched > 0 ? t('fixLines', { n: unmatched }) : t('chooseStoreFirst')}
              </>
            )}
          </p>
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
    low: { cls: 'bg-amber-100 text-amber-800', icon: <AlertTriangle size={15} aria-hidden="true" />, text: t('statusCheck') },
    noprice: { cls: 'bg-red-100 text-red-700', icon: <CircleHelp size={15} aria-hidden="true" />, text: t('statusNoPrice') },
    unmatched: { cls: 'bg-red-100 text-red-700', icon: <CircleHelp size={15} aria-hidden="true" />, text: t('statusUnmatched') },
  }[state]
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${config.cls}`}>
      {config.icon}
      {config.text}
      {state !== 'unmatched' && (
        <span className="font-semibold opacity-80">
          · {label} {confidence}%
        </span>
      )}
    </span>
  )
}

/** Text input that lets the user type freely and snaps to 3 decimals on blur. */
function PriceInput({
  value,
  onCommit,
  label,
  invalid,
}: {
  value: number
  onCommit: (v: number) => void
  label: string
  invalid?: boolean
}) {
  const [text, setText] = useState(value.toFixed(3))

  useEffect(() => {
    setText(value.toFixed(3))
  }, [value])

  const commit = () => {
    const n = parseFloat(text.replace(',', '.'))
    if (Number.isFinite(n) && n >= 0) {
      const rounded = roundKwd(n)
      setText(rounded.toFixed(3))
      if (rounded !== value) onCommit(rounded)
    } else {
      setText(value.toFixed(3))
    }
  }

  return (
    <label
      className={`flex min-h-12 shrink-0 items-center gap-2 rounded-xl border bg-white px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30 ${
        invalid ? 'border-red-400' : 'border-line'
      }`}
    >
      <input
        dir="ltr"
        inputMode="decimal"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-11 w-20 bg-transparent text-end text-lg font-bold text-ink outline-none"
      />
      <span className="text-sm font-semibold text-slate-500">KD</span>
    </label>
  )
}
