import { Check, Plus } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { ProductListItem } from '../../types/api'
import { formatSize, nameFor } from '../../utils/apiFormat'
import { formatKwd } from '../../utils/formatters'
import PriceBadge from '../ui/PriceBadge'

interface Props {
  product: ProductListItem
  inBasket: boolean
  onAdd: () => void
}

/** One search result: name, size, best price with an honest provenance badge, and an Add button. */
export default function ProductResultRow({ product, inBasket, onAdd }: Props) {
  const { t, lang } = useApp()
  const best = product.bestPrice
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p dir="auto" className="line-clamp-2 text-[15px] leading-snug font-bold text-ink">
          {nameFor(product, lang)}
        </p>
        <p dir="auto" className="mt-0.5 text-sm text-slate-600">
          {[product.brand, formatSize(product.sizeValue, product.sizeUnit, lang)].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
          {best ? (
            <>
              <span dir="ltr" className="font-bold text-ink">
                {t('priceFrom', { price: formatKwd(best.priceKwd) })}
              </span>
              <span>· {product.storeCount === 1 ? t('oneStore') : t('storesCount', { n: product.storeCount })}</span>
              <PriceBadge trust={best.trust} isPromo={best.isPromo} />
            </>
          ) : (
            <span>{t('watchNoPrice')}</span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={inBasket}
        className={`btn min-h-11 shrink-0 px-3.5 text-sm ${inBasket ? 'bg-brand-light text-brand-dark' : 'btn-secondary'}`}
      >
        {inBasket ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
        {inBasket ? t('added') : t('basketAdd')}
      </button>
    </li>
  )
}
