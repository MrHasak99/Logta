import { AlertTriangle, CheckCircle2, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-[11px] font-semibold text-slate-400">
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
          <label className="text-[11px] font-semibold text-slate-400">
            {t('documentType')}
            <select
              value={review.documentType}
              onChange={(e) => onChange({ ...review, documentType: e.target.value as DocumentType })}
              className="mt-1 w-full rounded-lg border border-navy-700 bg-navy-800 px-2 py-2 text-xs text-white"
            >
              <option value="receipt">{t('docReceipt')}</option>
              <option value="shelf_tag">{t('docShelfTag')}</option>
            </select>
          </label>
        </div>
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
            const low = item.confidenceScore < LOW_CONFIDENCE || !item.matchedProductId
            return (
              <li
                key={item.uid}
                className={`rounded-xl border bg-white p-3 ${low ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[11px] text-slate-500">
                    {t('rawText')}: <span dir="auto" className="font-mono font-semibold text-slate-700">{item.rawText}</span>
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ConfidenceBadge value={item.confidenceScore} label={t('confidenceShort')} />
                    <button
                      type="button"
                      onClick={() => removeItem(item.uid)}
                      aria-label={t('removeLine')}
                      title={t('removeLine')}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={item.matchedProductId ?? ''}
                    onChange={(e) => setProduct(item.uid, e.target.value)}
                    aria-label={t('item')}
                    className={`min-w-0 flex-1 rounded-lg border px-2 py-2 text-xs font-semibold ${
                      item.matchedProductId ? 'border-slate-200 text-navy' : 'border-amber-400 text-amber-800'
                    }`}
                  >
                    <option value="">{t('noMatch')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {productName(p)}
                      </option>
                    ))}
                  </select>
                  <PriceInput value={item.priceKwd} onCommit={(v) => updateItem(item.uid, { priceKwd: v, userEdited: true })} label={t('price')} />
                </div>
                {low && item.matchedProductId && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-amber-700">
                    <AlertTriangle size={12} /> {t('lowConfidence')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="sticky bottom-20 space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
        {!canConfirm && review.items.length > 0 && unmatched > 0 && (
          <p className="text-center text-[11px] font-medium text-amber-700">{t('fixLines', { n: unmatched })}</p>
        )}
        {canConfirm && (
          <p className="text-center text-[11px] text-slate-500">
            {t('itemsToSave', { n: saveable })} · {trust}% {t('confidence').toLowerCase()}
          </p>
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
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
      {label} {value}%
    </span>
  )
}

/** Text input that lets the user type freely and snaps to 3 decimals on blur. */
function PriceInput({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
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
    <label className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus-within:border-brand">
      <input
        dir="ltr"
        inputMode="decimal"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="w-16 bg-transparent text-end text-sm font-bold text-navy outline-none"
      />
      <span className="text-[11px] font-semibold text-slate-500">KD</span>
    </label>
  )
}
