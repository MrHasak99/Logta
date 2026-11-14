import { Bell, BellOff, Eye, WifiOff } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { AlertEntry, ProductListItem, WatchCardData } from '../../types/api'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import Skeleton from '../ui/Skeleton'
import AddWatchSheet from './AddWatchSheet'
import AlertCard from './AlertCard'
import WatchCard from './WatchCard'

export interface AlertsScreenProps {
  alerts: AlertEntry[]
  watches: WatchCardData[]
  status: 'loading' | 'ready' | 'error'
  /** Ids with a request in flight (disables the matching button). */
  busyAlertIds?: number[]
  busyWatchIds?: number[]
  // ---- add-watch sheet (controlled by the parent)
  addSheet: {
    open: boolean
    query: string
    results: ProductListItem[]
    resultsStatus: 'idle' | 'loading' | 'error'
    selected: ProductListItem | null
    submitting?: boolean
    submitError?: boolean
  }
  onMarkSeen: (alertId: number) => void
  onRemoveWatch: (watchId: number) => void
  onOpenAddWatch: () => void
  onCloseAddWatch: () => void
  onAddQueryChange: (query: string) => void
  onSelectProduct: (product: ProductListItem | null) => void
  onSubmitWatch: (productId: number, targetKwd: number) => void
  onRetry: () => void
  /** Browser mode only: fires a test alert for a watch that has not reached its target. */
  onSimulateDrop?: (watchId: number) => void
}

/** Price Alerts, presentational: new and earlier alerts, active watches, and the add-watch sheet. */
export default function AlertsScreen(p: AlertsScreenProps) {
  const { t } = useApp()
  const unseen = p.alerts.filter((a) => !a.alert.seen)
  const earlier = p.alerts.filter((a) => a.alert.seen)

  return (
    <div className="space-y-6 px-4 py-6">
      <div>
        <h2 className="text-2xl leading-snug font-bold text-ink">{t('alertsTitle')}</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{t('alertsDesc')}</p>
      </div>

      {p.status === 'loading' && (
        <div role="status" className="space-y-3" aria-live="polite">
          <span className="sr-only">{t('loadingShort')}</span>
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      )}

      {p.status === 'error' && (
        <ErrorState icon={WifiOff} title={t('alertsLoadError')} body={t('errNetworkBody')}>
          <button type="button" onClick={p.onRetry} className="btn btn-primary">
            {t('retry')}
          </button>
        </ErrorState>
      )}

      {p.status === 'ready' && (
        <>
          <section className="space-y-3">
            {p.alerts.length === 0 ? (
              <EmptyState icon={BellOff} title={t('alertsEmptyTitle')} body={t('alertsEmptyBody')} />
            ) : (
              <>
                {unseen.length > 0 && (
                  <>
                    <h3 className="flex items-center gap-2 px-1 text-lg font-bold text-ink">
                      {t('alertsNewTitle')}
                      <span className="rounded-full bg-gold px-2.5 py-0.5 text-sm font-bold text-navy">{unseen.length}</span>
                    </h3>
                    {unseen.map((a) => (
                      <AlertCard key={a.alert.id} entry={a} onMarkSeen={p.onMarkSeen} busy={p.busyAlertIds?.includes(a.alert.id)} />
                    ))}
                  </>
                )}
                {earlier.length > 0 && (
                  <>
                    <h3 className="px-1 pt-1 text-lg font-bold text-ink">{t('alertsEarlierTitle')}</h3>
                    {earlier.map((a) => (
                      <AlertCard key={a.alert.id} entry={a} onMarkSeen={p.onMarkSeen} />
                    ))}
                  </>
                )}
              </>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="px-1 text-lg font-bold text-ink">{t('watchTitle')}</h3>
            {p.watches.length === 0 ? (
              <EmptyState icon={Bell} title={t('watchEmptyTitle')} body={t('watchEmptyBody')} />
            ) : (
              p.watches.map((w) => (
                <WatchCard key={w.watch.id} entry={w} onRemove={p.onRemoveWatch} busy={p.busyWatchIds?.includes(w.watch.id)} onSimulateDrop={p.onSimulateDrop} />
              ))
            )}
          </section>
        </>
      )}

      {/* Sticky action bar: sits above the bottom nav */}
      <div className="card sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 bg-white/95 p-3.5 backdrop-blur">
        <button type="button" onClick={p.onOpenAddWatch} className="btn btn-primary min-h-14 w-full text-base">
          <Eye size={20} aria-hidden="true" /> {t('watchAddCta')}
        </button>
      </div>

      <AddWatchSheet
        open={p.addSheet.open}
        onClose={p.onCloseAddWatch}
        query={p.addSheet.query}
        onQueryChange={p.onAddQueryChange}
        results={p.addSheet.results}
        resultsStatus={p.addSheet.resultsStatus}
        selected={p.addSheet.selected}
        onSelect={p.onSelectProduct}
        onSubmit={p.onSubmitWatch}
        submitting={p.addSheet.submitting}
        submitError={p.addSheet.submitError}
      />
    </div>
  )
}
