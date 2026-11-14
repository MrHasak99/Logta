import { ArrowLeft, Search, ShoppingBasket, WifiOff } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { BasketItem, BasketPlan, LocationOption, ProductListItem, SelectedLocation } from '../../types/api'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import Skeleton from '../ui/Skeleton'
import SearchField from '../ui/SearchField'
import BasketItemRow from './BasketItemRow'
import LocationChip from './LocationChip'
import LocationSheet from './LocationSheet'
import PlanCard from './PlanCard'
import ProductResultRow from './ProductResultRow'

export interface BasketScreenProps {
  // ---- search
  searchQuery: string
  searchResults: ProductListItem[]
  /** 'idle' = `searchResults` is current; 'loading' / 'error' describe the in-flight or failed request. */
  searchStatus: 'idle' | 'loading' | 'error'
  // ---- basket
  items: BasketItem[]
  // ---- location
  location: SelectedLocation | null
  locationSheetOpen: boolean
  areaOptions: LocationOption[]
  locating?: boolean
  locationDenied?: boolean
  // ---- plans. 'idle' shows the basket builder; anything else shows the plans view.
  plans: BasketPlan[] | null
  planStatus: 'idle' | 'loading' | 'ready' | 'error'
  // ---- callbacks (the parent owns all state and fetching)
  onSearchChange: (query: string) => void
  onAddProduct: (product: ProductListItem) => void
  onQtyChange: (productId: number, qty: number) => void
  onToggleSubstitute: (productId: number, allow: boolean) => void
  onRemove: (productId: number) => void
  onOpenLocation: () => void
  onCloseLocation: () => void
  onUseMyLocation: () => void
  onPickArea: (option: LocationOption) => void
  onFindPlan: () => void
  onEditBasket: () => void
  onRetry: () => void
}

/**
 * Basket Optimizer, presentational. Step A (planStatus 'idle'): search, build the basket, set the location.
 * Step B (any other planStatus): optimiser plans. No fetching or state lives here.
 */
export default function BasketScreen(props: BasketScreenProps) {
  const { t } = useApp()
  const { planStatus } = props
  return (
    <div className="space-y-5 px-4 py-6">
      {planStatus === 'idle' ? <BuildView {...props} /> : <PlansView {...props} />}
      <LocationSheet
        open={props.locationSheetOpen}
        onClose={props.onCloseLocation}
        areaOptions={props.areaOptions}
        selectedAreaId={props.location?.kind === 'area' ? props.location.option.id : null}
        locating={props.locating}
        denied={props.locationDenied}
        onUseMyLocation={props.onUseMyLocation}
        onPickArea={props.onPickArea}
      />
      <span className="sr-only">{t('basketTitle')}</span>
    </div>
  )
}

function BuildView(p: BasketScreenProps) {
  const { t } = useApp()
  const query = p.searchQuery.trim()
  const inBasket = new Set(p.items.map((i) => i.product.id))
  const blocked = p.items.length === 0 ? t('basketNeedItems') : !p.location ? t('basketNeedLocation') : null

  return (
    <>
      <div>
        <h2 className="text-2xl leading-snug font-bold text-ink">{t('basketHeading')}</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{t('basketIntro')}</p>
      </div>

      <SearchField
        value={p.searchQuery}
        onChange={p.onSearchChange}
        placeholder={t('basketSearchPlaceholder')}
        loading={p.searchStatus === 'loading'}
      />

      {query && (
        <section aria-live="polite">
          {p.searchStatus === 'loading' && p.searchResults.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : p.searchStatus === 'error' ? (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {t('basketSearchError')}
            </p>
          ) : p.searchResults.length === 0 ? (
            <EmptyState icon={Search} title={t('basketSearchEmpty', { q: query })} />
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {p.searchResults.map((product) => (
                <ProductResultRow
                  key={product.id}
                  product={product}
                  inBasket={inBasket.has(product.id)}
                  onAdd={() => p.onAddProduct(product)}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="px-1 text-lg font-bold text-ink">{t('basketItems', { n: p.items.length })}</h3>
        {p.items.length === 0 ? (
          <EmptyState icon={ShoppingBasket} title={t('basketEmptyTitle')} body={t('basketEmptyBody')} />
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {p.items.map((item) => (
              <BasketItemRow
                key={item.product.id}
                item={item}
                onQtyChange={(qty) => p.onQtyChange(item.product.id, qty)}
                onToggleSubstitute={(allow) => p.onToggleSubstitute(item.product.id, allow)}
                onRemove={() => p.onRemove(item.product.id)}
              />
            ))}
          </ul>
        )}
        <LocationChip location={p.location} onOpen={p.onOpenLocation} />
      </section>

      {/* Sticky action bar: sits above the bottom nav */}
      <div className="card sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 space-y-2 bg-white/95 p-3.5 backdrop-blur">
        <p className={`text-center text-sm font-semibold ${blocked ? 'text-amber-800' : 'text-brand-dark'}`}>
          {blocked ?? (p.items.length === 1 ? t('basketItemsReadyOne') : t('basketItemsReady', { n: p.items.length }))}
        </p>
        <button
          type="button"
          disabled={!!blocked}
          onClick={p.onFindPlan}
          className="btn btn-primary min-h-14 w-full text-base disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none"
        >
          {t('basketFindPlan')}
        </button>
      </div>
    </>
  )
}

function PlansView(p: BasketScreenProps) {
  const { t } = useApp()
  return (
    <>
      <button
        type="button"
        onClick={p.onEditBasket}
        className="-ms-2 flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-brand-dark hover:bg-brand-light"
      >
        <ArrowLeft size={18} className="rtl:rotate-180" aria-hidden="true" />
        {t('plansEdit')}
      </button>

      {p.planStatus === 'loading' && (
        <div role="status" aria-live="polite" className="space-y-3">
          <p className="px-1 text-[15px] font-semibold text-slate-600">{t('plansLoading')}</p>
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      )}

      {p.planStatus === 'error' && (
        <ErrorState icon={WifiOff} title={t('plansError')} body={t('errNetworkBody')}>
          <button type="button" onClick={p.onRetry} className="btn btn-primary">
            {t('retry')}
          </button>
        </ErrorState>
      )}

      {p.planStatus === 'ready' &&
        (!p.plans || p.plans.length === 0 ? (
          <EmptyState
            icon={ShoppingBasket}
            title={t('plansEmptyTitle')}
            body={t('plansEmptyBody')}
            action={
              <button type="button" onClick={p.onEditBasket} className="btn btn-secondary">
                {t('plansEdit')}
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            {p.plans.map((plan, i) => (
              <PlanCard key={i} plan={plan} rank={i} defaultExpanded={i === 0} />
            ))}
          </div>
        ))}
    </>
  )
}
