import { useCallback } from 'react'
import { LOCAL_ALERTS_EVENT } from './alertEngine'
import { useLocalAlerts } from './useLocalAlerts'

/** Browser-mode twin of useUnseenAlertCount: unseen count read from LOGTA_ALERTS, instant on every change. */
export function useLocalUnseenAlertCount(enabled: boolean): [number, () => void] {
  const { alerts } = useLocalAlerts()
  const refresh = useCallback(() => window.dispatchEvent(new Event(LOCAL_ALERTS_EVENT)), [])
  return [enabled ? alerts.filter((a) => !a.seen).length : 0, refresh]
}
