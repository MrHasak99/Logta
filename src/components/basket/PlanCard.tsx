import { ChevronDown, Crown, TrendingDown } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { BasketPlan } from '../../types/api'
import { nameFor, trustBucket } from '../../utils/apiFormat'
import { formatKwd } from '../../utils/formatters'
import PriceBadge from '../ui/PriceBadge'
import PlanBreakdown from './PlanBreakdown'

interface Props {
  plan: BasketPlan
  /** 0 = the first (cheapest) plan returned by the API. */
  rank: number
  defaultExpanded?: boolean
}

/** One optimiser plan: total, honest savings, stores, estimated travel, price confidence, expandable details. */
export default function PlanCard({ plan, rank, defaultExpanded = false }: Props) {
  const { t, lang } = useApp()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const best = rank === 0
  // Only claim savings the API actually reports; never invent a baseline.
  const saves = plan.savingsVsBestSingleStore > 0.0005
  const mostlyEstimates = trustBucket(plan.avgTrust) === 'estimate'

  return (
    <article className={`card overflow-hidden p-4 ${best ? 'border-2 border-brand' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
            best ? 'bg-brand text-navy' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {best && <Crown size={15} aria-hidden="true" />}
          {best ? t('planBest') : t('planOption', { n: rank + 1 })}
        </span>
        <span className="text-sm font-medium text-slate-600">
          {plan.stores.length === 1 ? t('oneStore') : t('storesCount', { n: plan.stores.length })}
        </span>
      </div>

      <div className="mt-3">
        <p className="text-sm font-medium text-slate-600">{t('planTotal')}</p>
        <p dir="ltr" className="text-3xl leading-tight font-extrabold text-ink">
          {formatKwd(plan.total)}
        </p>
        {saves && (
          <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm leading-snug font-bold text-emerald-800">
            <TrendingDown size={17} className="shrink-0" aria-hidden="true" />
            <span dir="auto">{t('planSaves', { amount: formatKwd(plan.savingsVsBestSingleStore) })}</span>
          </p>
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-2">
        {plan.stores.map((s) => (
          <li key={s.id} dir="auto" className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            {nameFor(s, lang)}
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <p dir="auto">{t('planItemsLine', { amount: formatKwd(plan.subtotal) })}</p>
        {plan.travelCost > 0 && (
          <p dir="auto">
            {plan.travelKm > 0
              ? t('planTravelLine', { amount: formatKwd(plan.travelCost), km: plan.travelKm.toFixed(1) })
              : t('planDeliveryLine', { amount: formatKwd(plan.travelCost) })}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="text-sm font-medium text-slate-600">{t('planConfidence')}</span>
        <PriceBadge trust={plan.avgTrust} />
      </div>
      {mostlyEstimates && <p className="mt-1.5 text-sm text-gold-dark">{t('planMostlyEstimates')}</p>}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-bold text-brand-dark transition-colors hover:bg-brand-light"
      >
        {expanded ? t('planHideDetails') : t('planShowDetails')}
        <ChevronDown size={17} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {expanded && (
        <div className="mt-3">
          <PlanBreakdown plan={plan} />
        </div>
      )}
    </article>
  )
}
