import { ChevronRight, ScanLine, WifiOff } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { ReceiptListItem } from '../../types/api'
import { nameFor } from '../../utils/apiFormat'
import { timeAgo } from '../../utils/formatters'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import Skeleton from '../ui/Skeleton'

interface Props {
  /** GET /api/receipts, newest first. */
  receipts: ReceiptListItem[]
  status: 'loading' | 'ready' | 'error'
  onOpen: (receiptId: number) => void
  onRetry?: () => void
}

/** "Your recent scans": this device's receipts, including ones the user stopped waiting for. */
export default function ReceiptHistoryList({ receipts, status, onOpen, onRetry }: Props) {
  const { t, lang } = useApp()
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-lg font-bold text-ink">{t('histTitle')}</h2>

      {status === 'loading' && (
        <div className="space-y-2" role="status">
          <span className="sr-only">{t('loadingShort')}</span>
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {status === 'error' && (
        <ErrorState icon={WifiOff} title={t('errNetworkTitle')} body={t('errNetworkBody')}>
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn btn-primary">
              {t('retry')}
            </button>
          )}
        </ErrorState>
      )}

      {status === 'ready' &&
        (receipts.length === 0 ? (
          <EmptyState icon={ScanLine} title={t('histEmpty')} />
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {receipts.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="text-[15px] leading-snug font-bold text-ink">
                      {r.store ? nameFor(r.store, lang) : r.storeTextRaw || t('storeNotDetected')}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {t('histSummary', { saved: r.summary.saved, held: r.summary.held, waiting: r.summary.waiting })}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
                      <span>{timeAgo(r.uploadedAt, lang)}</span>
                      {r.status === 'failed' && <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">{t('rcptFailedTitle')}</span>}
                      {r.status === 'partial' && r.store == null && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">{t('rcptChipStoreNeeded')}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-brand-dark">{t('histOpen')}</span>
                  <ChevronRight size={18} className="shrink-0 text-brand-dark rtl:rotate-180" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}
