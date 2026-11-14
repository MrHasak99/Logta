import { Sparkles } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function ScanningAnimation() {
  const { t } = useApp()
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <div className="relative mx-auto mb-5 h-40 w-32 overflow-hidden rounded-xl bg-navy">
        <div className="space-y-2.5 p-4">
          {[80, 60, 90, 50, 70, 85].map((w, i) => (
            <div key={i} className="h-1.5 animate-pulse rounded bg-navy-700" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
        <div className="animate-scan-line absolute inset-x-0 h-[3px] bg-brand shadow-[0_0_14px_3px_rgba(16,185,129,0.8)]" />
      </div>
      <p className="flex items-center justify-center gap-2 text-sm font-bold text-navy">
        <Sparkles size={16} className="animate-pulse text-brand" />
        {t('scanning')}
      </p>
      <p className="mt-1.5 text-xs text-slate-500">{t('scanningSub')}</p>
    </div>
  )
}
