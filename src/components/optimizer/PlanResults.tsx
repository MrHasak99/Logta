import { AlertTriangle, ArrowLeft, ChevronRight, Crown, FlaskConical, Globe, Receipt, Repeat2, ShoppingBasket, Store as StoreIcon, Tag } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { PriceSource } from '../../data/types'
import { nameFor } from '../../utils/apiFormat'
import { formatKwd } from '../../utils/formatters'
import EmptyState from '../ui/EmptyState'
import type { BasketPlan, OptimizerResult, PlanLine, StockNote } from './engine'

interface Props {
  result: OptimizerResult
  onEdit: () => void
}

/** "−0.250 KD" for negatives (only used for plans that lose to the baseline). */
const signedKwd = (n: number) => (n < -0.0005 ? `−${formatKwd(-n)}` : formatKwd(n))

export default function PlanResults({ result, onEdit }: Props) {
  const { t } = useApp()
  const recommended = result.plans[0]
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const backButton = (
    <button
      type="button"
      onClick={onEdit}
      className="-ms-2 flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-brand-dark hover:bg-brand-light"
    >
      <ArrowLeft size={18} className="rtl:rotate-180" aria-hidden="true" />
      {t('plansEdit')}
    </button>
  )

  if (!recommended) {
    return (
      <div className="space-y-5">
        {backButton}
        <EmptyState
          icon={ShoppingBasket}
          title={t('plansEmptyTitle')}
          body={t('plansEmptyBody')}
          action={
            <button type="button" onClick={onEdit} className="btn btn-secondary">
              {t('plansEdit')}
            </button>
          }
        />
      </div>
    )
  }

  const shown = result.plans.find((p) => p.key === selectedKey) ?? recommended
  const isRecommended = shown.key === recommended.key

  return (
    <div className="space-y-5">
      {backButton}
      <PlanHero plan={shown} recommended={isRecommended} />
      <Comparison result={result} recommendedKey={recommended.key} shownKey={shown.key} onSelect={setSelectedKey} />
      <Stops plan={shown} />
      <p className="px-1 text-xs leading-relaxed text-slate-500">{t('optAssumptions')}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero: route + subtotal / travel / net savings
// ---------------------------------------------------------------------------

function PlanHero({ plan, recommended }: { plan: BasketPlan; recommended: boolean }) {
  const { t, lang } = useApp()
  const saves = plan.netSavings > 0.0005
  return (
    <section className="bg-khatam animate-fade-up overflow-hidden rounded-3xl bg-navy p-5 text-white shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-sm font-bold text-navy">
          {recommended && <Crown size={15} aria-hidden="true" />}
          {recommended ? t('optRecommended') : t('optViewingPlan')}
        </span>
        <span className="text-sm font-medium text-white/75">
          {plan.stops.length === 1 ? t('oneStore') : t('storesCount', { n: plan.stops.length })}
        </span>
      </div>

      <ol className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label={t('optRecommended')}>
        {plan.stops.map((stop, i) => (
          <li key={stop.store.id} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={16} className="text-brand rtl:rotate-180" aria-hidden="true" />}
            <span dir="auto" className="rounded-full bg-white/12 px-3 py-1.5 text-[15px] font-bold">
              {nameFor(stop.store, lang)}
            </span>
          </li>
        ))}
      </ol>
      {plan.travelKm > 0 && <p className="mt-2 text-sm text-white/70">{t('optDrivingKm', { km: plan.travelKm.toFixed(1) })}</p>}

      <dl className="mt-4 space-y-2.5 rounded-2xl bg-white/10 p-4">
        <Row label={t('optGrocerySubtotal')} value={formatKwd(plan.subtotal)} />
        <Row
          label={t('optTravelCost')}
          value={plan.travelCost > 0 ? `−${formatKwd(plan.travelCost)}` : formatKwd(0)}
          valueClass="text-amber-300"
          note={plan.deliveryCost > 0 ? t('planDeliveryLine', { amount: formatKwd(plan.deliveryCost) }) : undefined}
        />
        <div className="border-t border-white/15 pt-2.5">
          <Row label={t('optTotalToPay')} value={formatKwd(plan.total)} strong />
        </div>
      </dl>

      <div className={`mt-3 rounded-2xl px-4 py-3.5 ${saves ? 'bg-brand text-navy' : 'bg-white/10 text-white'}`}>
        <p className="text-sm font-semibold">{t('optNetSavings')}</p>
        <p dir="ltr" className={`text-start text-3xl leading-tight font-extrabold ${plan.netSavings < -0.0005 ? 'text-red-300' : ''}`}>
          {signedKwd(plan.netSavings)}
        </p>
        <p className={`mt-0.5 text-sm ${saves ? 'text-navy/80' : 'text-white/70'}`}>
          {saves || plan.netSavings < -0.0005 ? t('optNetSavingsHint') : t('optNoSavings')}
        </p>
      </div>
    </section>
  )
}

function Row({ label, value, valueClass = '', note, strong }: { label: string; value: string; valueClass?: string; note?: string; strong?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className={`text-[15px] ${strong ? 'font-bold' : 'text-white/80'}`}>{label}</dt>
        <dd dir="ltr" className={`${strong ? 'text-xl font-extrabold' : 'text-base font-bold'} ${valueClass}`}>
          {value}
        </dd>
      </div>
      {note && <p dir="auto" className="mt-0.5 text-xs text-white/60">{note}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comparison: best single vs best 2-store vs best 3-store
// ---------------------------------------------------------------------------

function Comparison({
  result,
  recommendedKey,
  shownKey,
  onSelect,
}: {
  result: OptimizerResult
  recommendedKey: string
  shownKey: string
  onSelect: (key: string) => void
}) {
  const { t } = useApp()
  const cards = [
    { n: 1 as const, title: t('optBestSingle') },
    { n: 2 as const, title: t('optBestTwo') },
    { n: 3 as const, title: t('optBestThree') },
  ]
  return (
    <section className="space-y-2.5">
      <div className="px-1">
        <h3 className="text-lg font-bold text-ink">{t('optCompareTitle')}</h3>
        <p className="mt-0.5 text-sm leading-snug text-slate-600">{t('optCompareHint')}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cards.map(({ n, title }) => {
          const plan = result.bestByStoreCount[n]
          if (!plan) {
            return (
              <div key={n} className="flex flex-col rounded-2xl border border-dashed border-slate-300 bg-white/60 p-2.5">
                <p className="text-[13px] leading-tight font-bold text-slate-600">{title}</p>
                <p className="mt-2 text-xs leading-snug text-slate-500">{t('optNoSplit')}</p>
              </div>
            )
          }
          const swaps = plan.stops.reduce((a, s) => a + s.items.filter((l) => l.substituted).length, 0)
          const selected = plan.key === shownKey
          return (
            <button
              key={n}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(plan.key)}
              className={`flex flex-col rounded-2xl border bg-white p-2.5 text-start transition-colors ${
                selected ? 'border-2 border-brand shadow-card' : 'border-line hover:border-brand'
              }`}
            >
              <span className="flex items-start justify-between gap-1">
                <span className="text-[13px] leading-tight font-bold text-ink">{title}</span>
                {plan.key === recommendedKey && <Crown size={14} className="mt-0.5 shrink-0 text-gold-dark" aria-label={t('optRecommended')} />}
              </span>
              <CompareStat label={t('optColItems')} value={formatKwd(plan.subtotal)} />
              <CompareStat label={t('optColTravel')} value={plan.travelCost > 0 ? `−${formatKwd(plan.travelCost)}` : formatKwd(0)} tone="text-amber-700" />
              <CompareStat label={t('optColTotal')} value={formatKwd(plan.total)} />
              <span className={`mt-2 rounded-lg px-2 py-1.5 ${plan.netSavings > 0.0005 ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                <span className="block text-[11px] leading-tight font-semibold">{t('optColSaved')}</span>
                <span dir="ltr" className={`block text-start text-[13px] font-extrabold ${plan.netSavings < -0.0005 ? 'text-red-600' : ''}`}>
                  {signedKwd(plan.netSavings)}
                </span>
              </span>
              {(swaps > 0 || plan.stockNotes.length > 0) && (
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {swaps > 0 && <AmberChip text={t('optSwapsChip', { n: swaps })} />}
                  {plan.stockNotes.length > 0 && <AmberChip text={t('optStockChip', { n: plan.stockNotes.length })} />}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="px-1 text-xs text-slate-500">{t('optTapToView')}</p>
    </section>
  )
}

const CompareStat = ({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) => (
  <span className="mt-1.5 block">
    <span className="block text-[11px] leading-tight text-slate-500">{label}</span>
    <span dir="ltr" className={`block text-start text-[13px] font-bold ${tone}`}>
      {value}
    </span>
  </span>
)

const AmberChip = ({ text }: { text: string }) => (
  <span dir="auto" className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] leading-tight font-bold text-amber-900">
    {text}
  </span>
)

// ---------------------------------------------------------------------------
// Stop-by-stop itemised list
// ---------------------------------------------------------------------------

const SOURCE_STYLE: Record<PriceSource, { cls: string; key: 'srcReceipt' | 'srcShelf' | 'srcInitial' | 'srcDemo'; icon: 'receipt' | 'tag' | 'flask' }> = {
  'Receipt Scan': { cls: 'bg-brand-light text-brand-dark', key: 'srcReceipt', icon: 'receipt' },
  'Shelf Tag': { cls: 'bg-sky-50 text-sky-800', key: 'srcShelf', icon: 'tag' },
  'Initial Index': { cls: 'bg-slate-100 text-slate-700', key: 'srcInitial', icon: 'tag' },
  'Demo Estimate': { cls: 'border border-dashed border-gold bg-gold-light text-gold-dark', key: 'srcDemo', icon: 'flask' },
}

function SourceBadge({ source }: { source: PriceSource }) {
  const { t } = useApp()
  const s = SOURCE_STYLE[source]
  const Icon = s.icon === 'receipt' ? Receipt : s.icon === 'tag' ? Tag : FlaskConical
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${s.cls}`}>
      <Icon size={13} aria-hidden="true" />
      {t(s.key)}
    </span>
  )
}

function Stops({ plan }: { plan: BasketPlan }) {
  const { t, lang } = useApp()
  return (
    <div className="space-y-4">
      {plan.stops.map((stop, i) => (
        <section key={stop.store.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <header className="flex items-center gap-3 bg-slate-50 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-brand">
              {stop.store.isOnline ? <Globe size={19} aria-hidden="true" /> : <StoreIcon size={19} aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <p dir="auto" className="text-[15px] leading-snug font-bold text-ink">
                {nameFor(stop.store, lang)}
              </p>
              <p dir="auto" className="text-sm text-slate-600">
                {t('optStop', { n: i + 1 })} · {stop.store.isOnline ? t('storeTypeOnline') : stop.store.area}
                {stop.deliveryFee > 0 && ` · ${t('planDeliveryLine', { amount: formatKwd(stop.deliveryFee) })}`}
              </p>
            </div>
            <p dir="ltr" className="text-base font-extrabold text-ink">
              {formatKwd(stop.subtotal)}
            </p>
          </header>
          <ul className="divide-y divide-line">
            {stop.items.map((line) => (
              <LineRow key={`${line.requestedProductId}-${line.productId}`} line={line} />
            ))}
          </ul>
        </section>
      ))}

      {plan.stockNotes.length > 0 && (
        <section className="rounded-2xl bg-amber-50 px-4 py-3.5">
          <h4 className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle size={16} aria-hidden="true" /> {t('optStockTitle')}
          </h4>
          <ul className="mt-2 space-y-2 text-sm text-amber-900">
            {plan.stockNotes.map((n) => (
              <li key={`${n.productId}-${n.atStore.id}`} className="flex items-start gap-2 leading-snug">
                <span className="mt-0.5 shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold">{t('optOutOfStock')}</span>
                <span dir="auto">{stockMessage(n, t, lang)}</span>
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

function LineRow({ line }: { line: PlanLine }) {
  const { t, lang } = useApp()
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p dir="auto" className="text-[15px] leading-snug font-semibold text-ink">
            {nameFor(line, lang)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <span dir="ltr">
              {line.qty} × {formatKwd(line.unitPriceKwd)}
            </span>
            <SourceBadge source={line.source} />
            {line.substituted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[13px] font-bold text-amber-900">
                <Repeat2 size={13} aria-hidden="true" /> {t('optSubstituted')}
              </span>
            )}
          </p>
        </div>
        <p dir="ltr" className="shrink-0 text-[15px] font-bold text-ink">
          {formatKwd(line.lineTotalKwd)}
        </p>
      </div>
      {line.substituted && (
        <p dir="auto" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-snug text-amber-900">
          {t('optSubstitutedFor', { name: nameFor({ nameEn: line.requestedNameEn, nameAr: line.requestedNameAr }, lang) })}
        </p>
      )}
    </li>
  )
}

function stockMessage(n: StockNote, t: ReturnType<typeof useApp>['t'], lang: 'en' | 'ar'): string {
  const item = nameFor(n, lang)
  const store = nameFor(n.atStore, lang)
  switch (n.resolution.kind) {
    case 'swapped':
      return t('optOosSwapped', { item, store, sub: nameFor(n.resolution.line, lang), subStore: nameFor(n.resolution.store, lang) })
    case 'elsewhere':
      return t('optOosElsewhere', { item, store, other: nameFor(n.resolution.store, lang) })
    case 'missing':
      return t('optOosMissing', { item, store })
  }
}
