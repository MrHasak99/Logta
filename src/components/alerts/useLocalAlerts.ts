import { useMemo, useSyncExternalStore } from 'react'
import { LOCAL_ALERTS_EVENT, parseAlerts, parseWatches, rawAlerts, rawWatches, type LocalAlert, type LocalWatch } from './alertEngine'

const subscribe = (cb: () => void) => {
  window.addEventListener(LOCAL_ALERTS_EVENT, cb)
  window.addEventListener('storage', cb) // other tabs
  return () => {
    window.removeEventListener(LOCAL_ALERTS_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** Live view of the localStorage watchlist and alerts (re-renders on every write, including from other tabs). */
export function useLocalAlerts(): { watches: LocalWatch[]; alerts: LocalAlert[] } {
  const w = useSyncExternalStore(subscribe, rawWatches, () => null)
  const a = useSyncExternalStore(subscribe, rawAlerts, () => null)
  const watches = useMemo(() => parseWatches(w) ?? [], [w])
  const alerts = useMemo(() => parseAlerts(a), [a])
  return { watches, alerts }
}
