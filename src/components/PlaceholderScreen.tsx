import type { LucideIcon } from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { TKey } from '../i18n'

interface Props {
  icon: LucideIcon
  title: TKey
  description: TKey
  /** Kept for compatibility with existing callers; no longer shown in the UI. */
  featureNumber?: number
}

/** Branded "coming soon" screen for features that are not built yet. Presentation only. */
export default function PlaceholderScreen({ icon: Icon, title, description }: Props) {
  const { t } = useApp()
  return (
    <div className="px-4 py-8">
      <div className="bg-khatam animate-fade-up overflow-hidden rounded-3xl bg-navy px-6 py-12 text-center text-white shadow-soft">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-navy-800 shadow-[0_0_0_10px_rgb(34_197_139/0.15)]">
          <Icon size={42} className="text-brand" aria-hidden="true" />
        </div>
        <span className="inline-block rounded-full bg-gold px-4 py-1.5 text-sm font-bold text-navy">{t('comingSoon')}</span>
        <h2 className="mt-4 text-2xl font-bold">{t(title)}</h2>
        <p className="mx-auto mt-3 max-w-[300px] text-base leading-relaxed text-white/75">{t(description)}</p>
      </div>
    </div>
  )
}
