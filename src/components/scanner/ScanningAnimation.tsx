import { Sparkles } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function ScanningAnimation() {
  const { t } = useApp()
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-khatam animate-fade-up overflow-hidden rounded-3xl bg-navy px-6 py-8 text-center text-white shadow-soft"
    >
      {/* Receipt paper with a mint scan line sweeping across it */}
      <div className="animate-float-soft relative mx-auto mb-6 h-44 w-36 overflow-hidden rounded-xl bg-paper shadow-[0_18px_40px_-14px_rgb(0_0_0/0.55)]">
        <div className="space-y-2.5 px-4 pt-5">
          <div className="mx-auto h-2 w-16 rounded bg-navy/25" />
          {[85, 60, 92, 52, 74, 66, 80].map((w, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <div
                className="h-1.5 animate-pulse rounded bg-navy/20"
                style={{ width: `${w * 0.6}%`, animationDelay: `${i * 120}ms` }}
              />
              <div className="h-1.5 w-6 animate-pulse rounded bg-gold" style={{ animationDelay: `${i * 120}ms` }} />
            </div>
          ))}
        </div>
        <div className="animate-scan-line absolute inset-x-0 h-[3px] bg-brand shadow-[0_0_16px_4px_rgb(34_197_139/0.75)]" />
      </div>

      <Sparkles size={20} className="mx-auto mb-2 animate-pulse text-gold" aria-hidden="true" />
      <p className="text-base font-bold">{t('scanning')}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/70">{t('scanningSub')}</p>

      <div className="mx-auto mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
        <div className="animate-progress-slide h-full w-2/5 rounded-full bg-brand" />
      </div>
    </div>
  )
}
