import { AlertTriangle, CloudOff, FileX, ImageOff, PlugZap, ScanLine, ShieldAlert, Timer, WifiOff, type LucideIcon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { TKey } from '../../i18n'
import type { ScanErrorKind } from '../../types/api'
import ErrorState from '../ui/ErrorState'

interface Config {
  icon: LucideIcon
  tone: 'red' | 'amber'
  title: TKey
  body: TKey
  /** Which callback the main button uses, and its label. */
  primary: 'retry' | 'secondary' | 'none'
  /** Label for `onSecondary` when it is the main or a second button. */
  secondaryLabel?: TKey
  /** Also offer a plain Try again next to a secondary primary button. */
  alsoRetry?: boolean
}

const CONFIG: Record<ScanErrorKind, Config> = {
  badFile: { icon: FileX, tone: 'red', title: 'errBadFileTitle', body: 'errBadFileBody', primary: 'secondary', secondaryLabel: 'errChooseOther' },
  unreadable: { icon: ScanLine, tone: 'amber', title: 'errUnreadableTitle', body: 'errUnreadableBody', primary: 'retry', secondaryLabel: 'errChooseOther' },
  tooLarge: { icon: ImageOff, tone: 'amber', title: 'errTooLargeTitle', body: 'errTooLargeBody', primary: 'secondary', secondaryLabel: 'errChooseOther' },
  rateLimitMinute: { icon: Timer, tone: 'amber', title: 'errRateMinuteTitle', body: 'errRateMinuteBody', primary: 'retry' },
  rateLimitHour: { icon: Timer, tone: 'amber', title: 'errRateHourTitle', body: 'errRateHourBody', primary: 'secondary', secondaryLabel: 'errOk' },
  aiFailed: { icon: CloudOff, tone: 'red', title: 'errAiTitle', body: 'errAiBody', primary: 'retry' },
  unavailable: { icon: PlugZap, tone: 'amber', title: 'errUnavailableTitle', body: 'errUnavailableBody', primary: 'secondary', secondaryLabel: 'errOk' },
  forbidden: { icon: ShieldAlert, tone: 'red', title: 'errForbiddenTitle', body: 'errForbiddenBody', primary: 'secondary', secondaryLabel: 'errOk' },
  network: { icon: WifiOff, tone: 'red', title: 'errNetworkTitle', body: 'errNetworkBody', primary: 'secondary', secondaryLabel: 'histTitle', alsoRetry: true },
  // A client-side timeout does NOT mean the scan failed: the server may still save it. Point to recent scans first.
  timeout: { icon: Timer, tone: 'amber', title: 'errTimeoutTitle', body: 'errTimeoutBody', primary: 'secondary', secondaryLabel: 'histTitle', alsoRetry: true },
  server: { icon: AlertTriangle, tone: 'red', title: 'errServerTitle', body: 'errServerBody', primary: 'retry' },
}

interface Props {
  kind: ScanErrorKind
  /**
   * Seconds until a rate limit lifts (from the Retry-After header, counted down by the parent).
   * For `rateLimitHour` this is converted to whole minutes for the copy.
   */
  retryAfterSeconds?: number
  onRetry?: () => void
  onSecondary?: () => void
}

/**
 * Error card for scanning problems. Retry never needs a re-upload (the parent keeps the photo), and a timeout or
 * network error must never auto-resend the receipt: the server may already have saved it.
 */
export default function ScanError({ kind, retryAfterSeconds, onRetry, onSecondary }: Props) {
  const { t } = useApp()
  const c = CONFIG[kind]
  const n = kind === 'rateLimitHour' ? Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60)) : Math.max(0, Math.ceil(retryAfterSeconds ?? 0))
  const waiting = kind === 'rateLimitMinute' && n > 0

  const retryBtn = (cls: string) => (
    <button type="button" onClick={onRetry} disabled={!onRetry || waiting} className={`btn ${cls}`}>
      {t('retry')}
    </button>
  )
  const secondaryBtn = (cls: string) =>
    c.secondaryLabel && (
      <button type="button" onClick={onSecondary} disabled={!onSecondary} className={`btn ${cls}`}>
        {t(c.secondaryLabel)}
      </button>
    )

  return (
    <ErrorState icon={c.icon} tone={c.tone} title={t(c.title)} body={t(c.body, { n })}>
      {c.primary === 'retry' && retryBtn('btn-primary')}
      {c.primary === 'secondary' && secondaryBtn('btn-primary')}
      {c.primary === 'retry' && c.secondaryLabel && secondaryBtn('btn-secondary')}
      {c.primary === 'secondary' && c.alsoRetry && retryBtn('btn-secondary')}
    </ErrorState>
  )
}
