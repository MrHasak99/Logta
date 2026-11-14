import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { ProductListItem } from '../../types/api'
import AlertsScreen from './AlertsScreen'
import {
  alertForCurrentBest,
  makeCtx,
  saveAlerts,
  saveWatches,
  simulateDrop,
  toAlertEntry,
  toProductListItem,
  toWatchCardData,
  type LocalWatch,
} from './alertEngine'
import { useLocalAlerts } from './useLocalAlerts'

const MAX_RESULTS = 8

/**
 * Feature 3 (browser mode): Smart Price Tracking & Alerts. Renders the shared presentational AlertsScreen from
 * the localStorage watchlist (LOGTA_WATCHES / LOGTA_ALERTS). Alerts are created by useAlertTrigger (App.tsx) and
 * by the actions below; the unseen-count badge in the bottom nav reads the same storage.
 */
export default function PriceAlerts() {
  const { products, stores, priceEntries } = useApp()
  const { watches, alerts } = useLocalAlerts()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ProductListItem | null>(null)

  const ctx = useMemo(() => makeCtx(products, stores, priceEntries), [products, stores, priceEntries])

  const alertEntries = useMemo(
    () =>
      alerts
        .map((a) => toAlertEntry(a, ctx))
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .sort((a, b) => b.alert.triggeredAt.localeCompare(a.alert.triggeredAt)),
    [alerts, ctx],
  )

  const watchCards = useMemo(
    () =>
      watches
        .filter((w) => w.active)
        .map((w) => toWatchCardData(w, ctx))
        .filter((w): w is NonNullable<typeof w> => w !== null),
    [watches, ctx],
  )

  const results = useMemo<ProductListItem[]>(() => {
    const raw = query.trim()
    const q = raw.toLowerCase()
    if (!q) return []
    return products
      .filter((p) => p.nameEn.toLowerCase().includes(q) || p.nameAr.includes(raw) || p.aliases.some((a) => a.toLowerCase().includes(q)))
      .slice(0, MAX_RESULTS)
      .map((p) => toProductListItem(p, ctx))
  }, [products, query, ctx])

  const closeSheet = () => {
    setOpen(false)
    setQuery('')
    setSelected(null)
  }

  const markSeen = (alertId: number) => saveAlerts(alerts.map((a) => (a.id === alertId ? { ...a, seen: true } : a)))

  const removeWatch = (watchId: number) => saveWatches(watches.map((w) => (w.id === watchId ? { ...w, active: false } : w)))

  const submitWatch = (productNum: number, targetKwd: number) => {
    const product = products[productNum - 1]
    if (!product) return
    const existing = watches.find((w) => w.active && w.productId === product.id)
    let watch: LocalWatch
    let nextWatches: LocalWatch[]
    if (existing) {
      watch = { ...existing, targetPriceKwd: targetKwd }
      nextWatches = watches.map((w) => (w.id === existing.id ? watch : w))
    } else {
      watch = {
        id: watches.reduce((m, w) => Math.max(m, w.id), 0) + 1,
        productId: product.id,
        targetPriceKwd: targetKwd,
        createdAt: new Date().toISOString(),
        active: true,
      }
      nextWatches = [...watches, watch]
    }
    saveWatches(nextWatches)
    // Target already met today: alert right away, as the sheet warns.
    const immediate = alertForCurrentBest(watch, priceEntries, alerts)
    if (immediate) saveAlerts([immediate, ...alerts])
    closeSheet()
  }

  const simulate = (watchNum: number) => {
    const watch = watches.find((w) => w.id === watchNum)
    if (!watch) return
    const alert = simulateDrop(watch, priceEntries, stores, alerts)
    if (alert) saveAlerts([alert, ...alerts])
  }

  return (
    <AlertsScreen
      alerts={alertEntries}
      watches={watchCards}
      status="ready"
      addSheet={{ open, query, results, resultsStatus: 'idle', selected }}
      onMarkSeen={markSeen}
      onRemoveWatch={removeWatch}
      onOpenAddWatch={() => setOpen(true)}
      onCloseAddWatch={closeSheet}
      onAddQueryChange={setQuery}
      onSelectProduct={setSelected}
      onSubmitWatch={submitWatch}
      onRetry={() => {}}
      onSimulateDrop={simulate}
    />
  )
}
