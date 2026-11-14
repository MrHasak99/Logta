import { Trash2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { BasketItem } from '../../types/api'
import { formatSize, nameFor } from '../../utils/apiFormat'
import QtyStepper from '../ui/QtyStepper'

interface Props {
  item: BasketItem
  onQtyChange: (qty: number) => void
  onToggleSubstitute: (allow: boolean) => void
  onRemove: () => void
}

/** A basket line: name, quantity stepper, the "OK to swap" switch and remove. All controlled by props. */
export default function BasketItemRow({ item, onQtyChange, onToggleSubstitute, onRemove }: Props) {
  const { t, lang } = useApp()
  const { product } = item
  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p dir="auto" className="line-clamp-2 text-[15px] leading-snug font-bold text-ink">
            {nameFor(product, lang)}
          </p>
          <p dir="auto" className="mt-0.5 text-sm text-slate-600">
            {[product.brand, formatSize(product.sizeValue, product.sizeUnit, lang)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('basketRemove')}
          title={t('basketRemove')}
          className="-me-2 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={19} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <QtyStepper value={item.qty} onChange={onQtyChange} />
        <button
          type="button"
          role="switch"
          aria-checked={item.allowSubstitute}
          onClick={() => onToggleSubstitute(!item.allowSubstitute)}
          className="flex min-h-11 items-center gap-2.5 rounded-xl text-start text-sm font-medium text-slate-700"
        >
          <span
            aria-hidden="true"
            className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${item.allowSubstitute ? 'bg-brand' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${item.allowSubstitute ? 'start-[1.375rem]' : 'start-0.5'}`}
            />
          </span>
          {t('basketSwapLabel')}
        </button>
      </div>
    </li>
  )
}
