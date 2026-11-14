import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { ApiStore, BasketItem, BasketPlan, LocationOption, ProductListItem, SelectedLocation } from '../../types/api'
import BasketScreen from './BasketScreen'

const BASKET_KEY = 'logta:basket'
const LOCATION_KEY = 'logta:location'

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

/** Area picker options from the physical stores' areas (approximate coordinates). */
const areasFrom = (stores: ApiStore[]): LocationOption[] =>
  stores
    .filter((s) => s.lat != null && s.lng != null && s.areaEn)
    .map((s) => ({ id: `area-${s.id}`, labelEn: s.areaEn!, labelAr: s.areaAr ?? s.areaEn!, lat: s.lat!, lng: s.lng! }))
    .filter((o, i, all) => all.findIndex((x) => x.labelEn === o.labelEn) === i)
    .sort((a, b) => a.labelEn.localeCompare(b.labelEn))

/** Basket Optimizer container: owns search, basket, location and plan state; BasketScreen is presentational. */
export default function BasketContainer() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductListItem[]>([])
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [items, setItems] = useState<BasketItem[]>(() => load<BasketItem[]>(BASKET_KEY, []))
  const [location, setLocation] = useState<SelectedLocation | null>(() => load<SelectedLocation | null>(LOCATION_KEY, null))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [stores, setStores] = useState<ApiStore[]>([])
  const [locating, setLocating] = useState(false)
  const [denied, setDenied] = useState(false)
  const [plans, setPlans] = useState<BasketPlan[] | null>(null)
  const [planStatus, setPlanStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const searchAbort = useRef<AbortController | null>(null)

  useEffect(() => save(BASKET_KEY, items), [items])
  useEffect(() => save(LOCATION_KEY, location), [location])
  useEffect(() => {
    api.stores().then(setStores).catch(() => setStores([]))
  }, [])
  const areaOptions = useMemo(() => areasFrom(stores), [stores])

  // debounced search; an empty query shows a few popular products
  const runSearch = (q: string) => {
    searchAbort.current?.abort()
    const ctrl = new AbortController()
    searchAbort.current = ctrl
    setSearchStatus('loading')
    api
      .searchProducts(q.trim(), q.trim() ? 20 : 8, ctrl.signal)
      .then((r) => {
        if (ctrl.signal.aborted) return
        setResults(r)
        setSearchStatus('idle')
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setSearchStatus('error')
      })
  }
  useEffect(() => {
    const id = setTimeout(() => runSearch(query), query ? 250 : 0)
    return () => clearTimeout(id)
  }, [query])

  const findPlan = async () => {
    const loc = location?.kind === 'gps' ? { lat: location.lat, lng: location.lng } : location?.kind === 'area' ? { lat: location.option.lat, lng: location.option.lng } : null
    if (!loc) {
      setSheetOpen(true)
      return
    }
    setPlanStatus('loading')
    try {
      setPlans(await api.optimize(items.map((i) => ({ productId: i.product.id, qty: i.qty, allowSubstitute: i.allowSubstitute })), loc))
      setPlanStatus('ready')
    } catch {
      setPlanStatus('error')
    }
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setDenied(true)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setDenied(false)
        setLocation({ kind: 'gps', lat: pos.coords.latitude, lng: pos.coords.longitude })
        setSheetOpen(false)
      },
      () => {
        setLocating(false)
        setDenied(true)
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  const update = (productId: number, patch: Partial<BasketItem>) =>
    setItems((xs) => xs.map((i) => (i.product.id === productId ? { ...i, ...patch } : i)))

  return (
    <BasketScreen
      searchQuery={query}
      searchResults={results}
      searchStatus={searchStatus}
      items={items}
      location={location}
      locationSheetOpen={sheetOpen}
      areaOptions={areaOptions}
      locating={locating}
      locationDenied={denied}
      plans={plans}
      planStatus={planStatus}
      onSearchChange={setQuery}
      onAddProduct={(product) =>
        setItems((xs) => (xs.some((i) => i.product.id === product.id) ? xs.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)) : [...xs, { product, qty: 1, allowSubstitute: true }]))
      }
      onQtyChange={(productId, qty) => (qty <= 0 ? setItems((xs) => xs.filter((i) => i.product.id !== productId)) : update(productId, { qty }))}
      onToggleSubstitute={(productId, allow) => update(productId, { allowSubstitute: allow })}
      onRemove={(productId) => setItems((xs) => xs.filter((i) => i.product.id !== productId))}
      onOpenLocation={() => setSheetOpen(true)}
      onCloseLocation={() => setSheetOpen(false)}
      onUseMyLocation={useMyLocation}
      onPickArea={(option) => {
        setLocation({ kind: 'area', option })
        setSheetOpen(false)
      }}
      onFindPlan={() => void findPlan()}
      onEditBasket={() => {
        setPlanStatus('idle')
        setPlans(null)
      }}
      onRetry={() => (planStatus === 'error' ? void findPlan() : runSearch(query))}
    />
  )
}
