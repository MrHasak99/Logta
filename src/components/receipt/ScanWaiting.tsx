import { Sparkles } from 'lucide-react'
import { useApp } from '../../context/AppContext'

interface Props {
  /** Seconds since the request started (the parent runs the timer). Switches the copy after 8 s. */
  elapsedSeconds: number
  /**
   * Stop watching the progress. The server KEEPS processing the receipt, so the parent must never resubmit it
   * because of this; point the user to "Your recent scans" instead.
   */
  onStopWaiting?: () => void
}

/** Processing screen for the automatic scan. Honest: no fake percentages, since the API reports no progress. */
export default function ScanWaiting({ elapsedSeconds, onStopWaiting }: Props) {
  const { t } = useApp()
  const slow = elapsedSeconds >= 8
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <div className="bg-khatam animate-fade-up overflow-hidden rounded-3xl bg-navy px-6 py-8 text-center text-white shadow-soft">
        <div className="animate-float-soft relative mx-auto mb-6 h-44 w-36 overflow-hidden rounded-xl bg-paper shadow-[0_18px_40px_-14px_rgb(0_0_0/0.55)]">
          <div className="space-y-2.5 px-4 pt-5">
            <div className="mx-auto h-2 w-16 rounded bg-navy/25" />
            {[85, 60, 92, 52, 74, 66, 80].map((w, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="h-1.5 animate-pulse rounded bg-navy/20" style={{ width: `${w * 0.6}%`, animationDelay: `${i * 120}ms` }} />
                <div className="h-1.5 w-6 animate-pulse rounded bg-gold" style={{ animationDelay: `${i * 120}ms` }} />
              </div>
            ))}
          </div>
          <div className="animate-scan-line absolute inset-x-0 h-[3px] bg-brand shadow-[0_0_16px_4px_rgb(34_197_139/0.75)]" />
        </div>

        <Sparkles size={20} className="mx-auto mb-2 animate-pulse text-gold" aria-hidden="true" />
        <p className="text-base font-bold">{slow ? t('scanWait2Title') : t('scanWait1Title')}</p>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/75">{slow ? t('scanWait2Body') : t('scanWait1Body')}</p>

        <div className="mx-auto mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
          <div className="animate-progress-slide h-full w-2/5 rounded-full bg-brand" />
        </div>
      </div>

      {onStopWaiting && (
        <div className="text-center">
          <button type="button" onClick={onStopWaiting} className="min-h-11 rounded-xl px-4 text-sm font-bold text-brand-dark hover:bg-brand-light">
            {t('scanStopWaiting')}
          </button>
          <p className="mx-auto mt-1 max-w-[300px] text-[13px] leading-relaxed text-slate-500">{t('scanStopNote')}</p>
        </div>
      )}
    </div>
  )
}
