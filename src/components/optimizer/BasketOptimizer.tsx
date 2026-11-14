import { Check, Plus, Search, ShoppingBasket, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { Product } from '../../data/types'
import type { LocationOption, SelectedLocation } from '../../types/api'
import { formatKwd } from '../../utils/formatters'
import LocationChip from '../basket/LocationChip'
import LocationSheet from '../basket/LocationSheet'
import EmptyState from '../ui/EmptyState'
import QtyStepper from '../ui/QtyStepper'
import SearchField from '../ui/SearchField'
import { buildDemoBasket, QUICK_ADD, resolveProduct } from './demo'
import { currentEntries, optimizeBasket, type BasketLine, type OptimizerResult } from './engine'
import PlanResults from './PlanResults'

/** Arabic area labels for the location picker (the store data only carries English areas). */
const AREA_AR: Record<string, string> = {
  Mishref: 'مشرف',
  Khaldiya: 'الخالدية',
  'Al-Rai': 'الري',
  '360 Mall': 'مول 360',
}

/**
 * Feature 2: Smart Basket Optimizer. Owns the basket, location and result state, runs the browser engine
 * (./engine.ts) and renders either the builder or the net-savings results.
 */
export default function BasketOptimizer() {
  const { t, lang, products, stores, priceEntries, productName } = useApp()

  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<BasketLine[]>([])
  const [location, setLocation] = useState<SelectedLocation | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [denied, setDenied] = useState(false)
  const [result, setResult] = useState<OptimizerResult | null>(null)

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  /** Cheapest in-stock current price per product, for the search rows. */
  const cheapest = useMemo(() => {
    const best = new Map<string, number>()
    for (const e of currentEntries(priceEntries).values()) {
      if (!e.inStock) continue
      const prev = best.get(e.productId)
      if (prev === undefined || e.priceKwd < prev) best.set(e.productId, e.priceKwd)
    }
    return best
  }, [priceEntries])

  const areaOptions = useMemo<LocationOption[]>(() => {
    const seen = new Set<string>()
    const out: LocationOption[] = []
    for (const s of stores) {
      if (s.isOnline || seen.has(s.area)) continue
      seen.add(s.area)
      out.push({ id: s.id, labelEn: s.area, labelAr: AREA_AR[s.area] ?? s.area, lat: s.lat, lng: s.lng })
    }
    return out
  }, [stores])

  const inBasket = useMemo(() => new Set(lines.map((l) => l.productId)), [lines])

  const results = useMemo<Product[]>(() => {
    const raw = query.trim()
    const q = raw.toLowerCase()
    if (!q) return []
    return products
      .filter((p) => p.nameEn.toLowerCase().includes(q) || p.nameAr.includes(raw) || p.aliases.some((a) => a.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [products, query])

  const quickAdd = useMemo(
    () =>
      QUICK_ADD.map((spec) => resolveProduct(spec, products))
        .filter((p): p is Product => !!p && !inBasket.has(p.id)),
    [products, inBasket],
  )

  const resetPlan = () => setResult(null)

  const addProduct = (p: Product) => {
    setLines((prev) => (prev.some((l) => l.productId === p.id) ? prev : [...prev, { productId: p.id, qty: 1, allowSubstitute: true }]))
    setResult(null)
  }
  const patchLine = (productId: string, patch: Partial<BasketLine>) =>
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)))
  const removeLine = (productId: string) => setLines((prev) => prev.filter((l) => l.productId !== productId))

  const loadDemo = () => {
    setLines(buildDemoBasket(products))
    setQuery('')
    setResult(null)
    // One-tap demo: also pick a sensible starting point (Mishref) when none is set yet.
    setLocation((cur) => cur ?? { kind: 'area', option: areaOptions.find((o) => o.labelEn === 'Mishref') ?? areaOptions[0]! })
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setDenied(true)
      return
    }
    setLocating(true)
    setDenied(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ kind: 'gps', lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
        setSheetOpen(false)
      },
      () => {
        setLocating(false)
        setDenied(true)
      },
      { timeout: 8000 },
    )
  }

  const home = location ? (location.kind === 'gps' ? { lat: location.lat, lng: location.lng } : { lat: location.option.lat, lng: location.option.lng }) : null

  const findPlan = () => {
    if (!home || lines.length === 0) return
    setResult(optimizeBasket(lines, home, { products, stores, priceEntries }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const blocked = lines.length === 0 ? t('basketNeedItems') : !home ? t('basketNeedLocation') : null

  return (
    <div className="space-y-5 px-4 py-6">
      {result ? (
        <PlanResults result={result} onEdit={resetPlan} />
      ) : (
        <>
          <div>
            <h2 className="text-2xl leading-snug font-bold text-ink">{t('optHeading')}</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{t('optIntro')}</p>
          </div>

          {/* 1-click judge demo */}
          <section className="bg-khatam overflow-hidden rounded-3xl bg-navy p-4 text-white shadow-soft">
            <p className="text-sm leading-snug text-white/75">{t('optLoadDemoHint')}</p>
            <button type="button" onClick={loadDemo} className="btn btn-primary mt-3 min-h-14 w-full text-base">
              <Sparkles size={20} aria-hidden="true" />
              {t('optLoadDemo')}
            </button>
          </section>

          <SearchField value={query} onChange={setQuery} placeholder={t('basketSearchPlaceholder')} />

          {query.trim() ? (
            <section aria-live="polite">
              {results.length === 0 ? (
                <EmptyState icon={Search} title={t('basketSearchEmpty', { q: query.trim() })} />
              ) : (
                <ul className="card divide-y divide-line overflow-hidden">
                  {results.map((p) => {
                    const added = inBasket.has(p.id)
                    const price = cheapest.get(p.id)
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p dir="auto" className="line-clamp-2 text-[15px] leading-snug font-bold text-ink">
                            {productName(p)}
                          </p>
                          <p dir="auto" className="mt-0.5 text-sm text-slate-600">
                            {p.unitSize}
                            {price !== undefined && (
                              <>
                                {' · '}
                                <span dir="ltr" className="inline-block font-semibold text-ink">
                                  {t('priceFrom', { price: formatKwd(price) })}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addProduct(p)}
                          disabled={added}
                          className={`btn min-h-11 shrink-0 px-3.5 text-sm ${added ? 'bg-brand-light text-brand-dark' : 'btn-secondary'}`}
                        >
                          {added ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                          {added ? t('added') : t('basketAdd')}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ) : (
            quickAdd.length > 0 && (
              <section>
                <p className="mb-2 px-1 text-sm font-semibold text-slate-600">{t('optQuickAdd')}</p>
                <div className="flex flex-wrap gap-2">
                  {quickAdd.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm font-semibold text-brand-dark transition-colors hover:border-brand hover:bg-brand-light"
                    >
                      <Plus size={15} aria-hidden="true" />
                      <span dir="auto">{productName(p)}</span>
                    </button>
                  ))}
                </div>
              </section>
            )
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <h3 className="text-lg font-bold text-ink">{t('basketItems', { n: lines.length })}</h3>
              {lines.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setLines([])
                    setResult(null)
                  }}
                  className="min-h-11 rounded-xl px-2 text-sm font-bold text-slate-600 hover:text-red-600"
                >
                  {t('optClearBasket')}
                </button>
              )}
            </div>
            {lines.length === 0 ? (
              <EmptyState icon={ShoppingBasket} title={t('basketEmptyTitle')} body={t('basketEmptyBody')} />
            ) : (
              <ul className="card divide-y divide-line overflow-hidden">
                {lines.map((line) => {
                  const p = productById.get(line.productId)
                  if (!p) return null
                  return (
                    <li key={line.productId} className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p dir="auto" className="line-clamp-2 text-[15px] leading-snug font-bold text-ink">
                            {productName(p)}
                          </p>
                          <p dir="auto" className="mt-0.5 text-sm text-slate-600">
                            {p.unitSize}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(line.productId)}
                          aria-label={t('basketRemove')}
                          title={t('basketRemove')}
                          className="-me-2 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={19} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <QtyStepper value={line.qty} onChange={(qty) => patchLine(line.productId, { qty })} />
                        <button
                          type="button"
                          role="switch"
                          aria-checked={line.allowSubstitute}
                          onClick={() => patchLine(line.productId, { allowSubstitute: !line.allowSubstitute })}
                          className="flex min-h-11 items-center gap-2.5 rounded-xl text-start text-sm font-medium text-slate-700"
                        >
                          <span
                            aria-hidden="true"
                            className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${line.allowSubstitute ? 'bg-brand' : 'bg-slate-300'}`}
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${line.allowSubstitute ? 'start-[1.375rem]' : 'start-0.5'}`}
                            />
                          </span>
                          {t('basketSwapLabel')}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <LocationChip location={location} onOpen={() => setSheetOpen(true)} />
          </section>

          {/* Sticky action bar above the bottom nav */}
          <div className="card sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 space-y-2 bg-white/95 p-3.5 backdrop-blur">
            <p className={`text-center text-sm font-semibold ${blocked ? 'text-amber-800' : 'text-brand-dark'}`}>
              {blocked ?? (lines.length === 1 ? t('basketItemsReadyOne') : t('basketItemsReady', { n: lines.length }))}
            </p>
            <button
              type="button"
              disabled={!!blocked}
              onClick={findPlan}
              className="btn btn-primary min-h-14 w-full text-base disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none"
            >
              {t('optFindPlan')}
            </button>
          </div>
        </>
      )}

      <LocationSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        areaOptions={areaOptions}
        selectedAreaId={location?.kind === 'area' ? location.option.id : null}
        locating={locating}
        denied={denied}
        onUseMyLocation={useMyLocation}
        onPickArea={(option) => {
          setLocation({ kind: 'area', option })
          setSheetOpen(false)
        }}
      />
      <span className="sr-only" lang={lang}>
        {t('navBasket')}
      </span>
    </div>
  )
}
