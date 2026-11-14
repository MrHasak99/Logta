import { useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { evaluateNewEntries, loadAlerts, loadWatches, saveAlerts, saveWatches, seedDemo } from './alertEngine'

/**
 * Always-mounted (see App.tsx) so alerts fire even while another tab is showing:
 *  - first load (or after resetDemoData): pre-seeds the 3 demo watches,
 *  - afterwards: every price entry added to AppContext (receipt / shelf-tag scan) is evaluated against the watches.
 */
export function useAlertTrigger(enabled: boolean) {
  const { products, priceEntries } = useApp()
  const processed = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!enabled) return
    const watches = loadWatches()

    if (watches === null) {
      const seeded = seedDemo(products, priceEntries)
      saveWatches(seeded.watches)
      saveAlerts(seeded.alerts)
      processed.current = new Set(priceEntries.map((e) => e.id))
      return
    }

    if (processed.current === null) {
      // Page (re)load with existing watches: everything already stored was evaluated in an earlier session.
      processed.current = new Set(priceEntries.map((e) => e.id))
      return
    }

    const seen = processed.current
    const fresh = priceEntries.filter((e) => !seen.has(e.id))
    if (!fresh.length) return
    for (const e of fresh) seen.add(e.id)

    const alerts = loadAlerts()
    const created = evaluateNewEntries({ watches, newEntries: fresh, allEntries: priceEntries, alerts })
    if (created.length) saveAlerts([...created, ...alerts])
  }, [enabled, products, priceEntries])
}
