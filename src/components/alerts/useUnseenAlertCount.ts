import { useCallback, useEffect, useState } from 'react'
import { ALERTS_CHANGED_EVENT, api } from '../../api/client'

/** Unseen-alert count for the nav badge: refreshed on start, window focus, every 2 min and after scans. */
export function useUnseenAlertCount(enabled: boolean): [number, () => void] {
  const [count, setCount] = useState(0)
  const refresh = useCallback(() => {
    if (!enabled) return
    api.alerts(true).then((a) => setCount(a.length)).catch(() => {})
  }, [enabled])
  useEffect(() => {
    if (!enabled) return
    refresh()
    const id = setInterval(refresh, 120_000)
    window.addEventListener('focus', refresh)
    window.addEventListener(ALERTS_CHANGED_EVENT, refresh)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(ALERTS_CHANGED_EVENT, refresh)
    }
  }, [enabled, refresh])
  return [count, refresh]
}
