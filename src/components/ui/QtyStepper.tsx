import { Minus, Plus } from 'lucide-react'
import { useApp } from '../../context/AppContext'

interface Props {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

/** Quantity control with 44px buttons. Controlled: the parent owns the number. */
export default function QtyStepper({ value, onChange, min = 1, max = 99 }: Props) {
  const { t } = useApp()
  return (
    <div role="group" aria-label={t('basketQty')} className="flex items-center rounded-xl border border-line bg-white">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={t('basketDecrease')}
        className="flex h-11 w-11 items-center justify-center rounded-s-xl text-brand-dark transition-colors hover:bg-brand-light disabled:text-slate-300 disabled:hover:bg-transparent"
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <span aria-live="polite" dir="ltr" className="min-w-9 text-center text-base font-bold text-ink">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={t('basketIncrease')}
        className="flex h-11 w-11 items-center justify-center rounded-e-xl text-brand-dark transition-colors hover:bg-brand-light disabled:text-slate-300 disabled:hover:bg-transparent"
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
