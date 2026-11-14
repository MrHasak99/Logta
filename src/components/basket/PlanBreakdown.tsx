import { AlertTriangle, Globe, Repeat2, Store } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { BasketPlan, StoreType } from '../../types/api'
import { nameFor } from '../../utils/apiFormat'
import { formatKwd } from '../../utils/formatters'
import PriceBadge from '../ui/PriceBadge'

const TYPE_KEY = {
  coop: 'storeTypeCoop',
  hypermarket: 'storeTypeHypermarket',
  supermarket: 'storeTypeSupermarket',
  online: 'storeTypeOnline',
} as const satisfies Record<StoreType, string>

/** Per-store item lists, swaps and missing items for one plan. */
export default function PlanBreakdown({ plan }: { plan: BasketPlan }) {
  const { t, lang } = useApp()

  // The API gives swapped-in products' Arabic names only on the plan lines, so look them up there.
  const lineNameFor = (productId: number) => {
    for (const s of plan.itemsPerStore) {
      const line = s.items.find((l) => l.productId === productId)
      if (line) return nameFor(line, lang)
    }
    return ''
  }

  return (
    <div className="space-y-4">
      {plan.itemsPerStore.map((store) => (
        <section key={store.storeId} className="overflow-hidden rounded-2xl border border-line bg-white">
          <header className="flex items-center gap-3 bg-slate-50 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-brand">
              {store.type === 'online' ? <Globe size={19} aria-hidden="true" /> : <Store size={19} aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <p dir="auto" className="text-[15px] leading-snug font-bold text-ink">
                {nameFor(store, lang)}
              </p>
              <p className="text-sm text-slate-600">
                {t(TYPE_KEY[store.type])}
                {store.deliveryFee > 0 && <span dir="auto"> · {t('planDeliveryLine', { amount: formatKwd(store.deliveryFee) })}</span>}
              </p>
            </div>
            <p dir="ltr" className="text-base font-extrabold text-ink">
              {formatKwd(store.subtotal)}
            </p>
          </header>
          <ul className="divide-y divide-line">
            {store.items.map((line) => (
              <li key={`${line.requestedProductId}-${line.productId}`} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="text-[15px] leading-snug font-semibold text-ink">
                    {nameFor(line, lang)}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                    <span dir="ltr">
                      {line.qty} × {formatKwd(line.unitPriceKwd)}
                    </span>
                    <PriceBadge trust={line.trust} isPromo={line.isPromo} />
                    {line.substituted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[13px] font-semibold text-sky-800">
                        <Repeat2 size={13} aria-hidden="true" /> {t('planSwapped')}
                      </span>
                    )}
                  </p>
                </div>
                <p dir="ltr" className="shrink-0 text-[15px] font-bold text-ink">
                  {formatKwd(line.lineTotalKwd)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {plan.substitutions.length > 0 && (
        <section className="rounded-2xl bg-sky-50 px-4 py-3.5">
          <h4 className="flex items-center gap-2 text-sm font-bold text-sky-900">
            <Repeat2 size={16} aria-hidden="true" /> {t('planSwapsTitle')}
          </h4>
          <ul className="mt-2 space-y-1.5 text-sm text-sky-900">
            {plan.substitutions.map((s) => (
              <li key={`${s.requestedProductId}-${s.productId}`} dir="auto" className="leading-snug">
                {s.requestedNameEn} → {lineNameFor(s.productId) || s.nameEn}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.missingItems.length > 0 && (
        <section role="alert" className="rounded-2xl bg-amber-50 px-4 py-3.5">
          <h4 className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle size={16} aria-hidden="true" /> {t('planMissingTitle')}
          </h4>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-900">
            {plan.missingItems.map((m) => (
              <li key={m.productId} dir="auto" className="leading-snug">
                {nameFor(m, lang)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
