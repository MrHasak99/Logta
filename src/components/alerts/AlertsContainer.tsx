import { useCallback, useEffect, useRef, useState } from 'react'
import { ALERTS_CHANGED_EVENT, api } from '../../api/client'
import type { AlertEntry, ProductListItem, WatchCardData } from '../../types/api'
import AlertsScreen from './AlertsScreen'

type AddSheet = {
  open: boolean
  query: string
  results: ProductListItem[]
  resultsStatus: 'idle' | 'loading' | 'error'
  selected: ProductListItem | null
  submitting?: boolean
  submitError?: boolean
}

const closedSheet: AddSheet = { open: false, query: '', results: [], resultsStatus: 'idle', selected: null }

/** Price Alerts container: owns alerts/watches state and fetching; AlertsScreen is presentational. */
export default function AlertsContainer({ onBadgeChange }: { onBadgeChange: () => void }) {
  const [alerts, setAlerts] = useState<AlertEntry[]>([])
  const [watches, setWatches] = useState<WatchCardData[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busyAlertIds, setBusyAlertIds] = useState<number[]>([])
  const [busyWatchIds, setBusyWatchIds] = useState<number[]>([])
  const [sheet, setSheet] = useState<AddSheet>(closedSheet)
  const searchAbort = useRef<AbortController | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setStatus('loading')
    try {
      const [a, w] = await Promise.all([api.alerts(), api.watches()])
      setAlerts(a)
      // join each watch with its current best price (cheapest store first)
      const withPrices = await Promise.all(
        w.map(async (entry) => {
          try {
            const detail = await api.product(entry.product.id)
            return { ...entry, currentBest: detail.prices[0] ?? null }
          } catch {
            return { ...entry, currentBest: null }
          }
        }),
      )
      setWatches(withPrices)
      setStatus('ready')
    } catch {
      if (!quiet) setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load()
    const onChange = () => void load(true)
    window.addEventListener('focus', onChange)
    window.addEventListener(ALERTS_CHANGED_EVENT, onChange)
    return () => {
      window.removeEventListener('focus', onChange)
      window.removeEventListener(ALERTS_CHANGED_EVENT, onChange)
    }
  }, [load])

  // debounced product search inside the add-watch sheet
  useEffect(() => {
    if (!sheet.open) return
    const id = setTimeout(() => {
      searchAbort.current?.abort()
      const ctrl = new AbortController()
      searchAbort.current = ctrl
      setSheet((s) => ({ ...s, resultsStatus: 'loading' }))
      api
        .searchProducts(sheet.query.trim(), sheet.query.trim() ? 20 : 8, ctrl.signal)
        .then((results) => !ctrl.signal.aborted && setSheet((s) => ({ ...s, results, resultsStatus: 'idle' })))
        .catch(() => !ctrl.signal.aborted && setSheet((s) => ({ ...s, resultsStatus: 'error' })))
    }, sheet.query ? 250 : 0)
    return () => clearTimeout(id)
  }, [sheet.open, sheet.query])

  return (
    <AlertsScreen
      alerts={alerts}
      watches={watches}
      status={status}
      busyAlertIds={busyAlertIds}
      busyWatchIds={busyWatchIds}
      addSheet={sheet}
      onMarkSeen={async (alertId) => {
        setBusyAlertIds((ids) => [...ids, alertId])
        try {
          await api.markAlertSeen(alertId)
          setAlerts((xs) => xs.map((a) => (a.alert.id === alertId ? { ...a, alert: { ...a.alert, seen: true } } : a)))
          onBadgeChange()
        } finally {
          setBusyAlertIds((ids) => ids.filter((x) => x !== alertId))
        }
      }}
      onRemoveWatch={async (watchId) => {
        setBusyWatchIds((ids) => [...ids, watchId])
        try {
          await api.removeWatch(watchId)
          setWatches((xs) => xs.filter((w) => w.watch.id !== watchId))
        } finally {
          setBusyWatchIds((ids) => ids.filter((x) => x !== watchId))
        }
      }}
      onOpenAddWatch={() => setSheet({ ...closedSheet, open: true })}
      onCloseAddWatch={() => setSheet(closedSheet)}
      onAddQueryChange={(query) => setSheet((s) => ({ ...s, query }))}
      onSelectProduct={(selected) => setSheet((s) => ({ ...s, selected, submitError: false }))}
      onSubmitWatch={async (productId, targetKwd) => {
        setSheet((s) => ({ ...s, submitting: true, submitError: false }))
        try {
          await api.addWatch(productId, targetKwd)
          setSheet(closedSheet)
          await load(true)
        } catch {
          setSheet((s) => ({ ...s, submitting: false, submitError: true }))
        }
      }}
      onRetry={() => void load()}
    />
  )
}
