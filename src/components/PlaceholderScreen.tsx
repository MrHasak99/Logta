import type { LucideIcon } from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { TKey } from '../i18n'

interface Props {
  icon: LucideIcon
  title: TKey
  description: TKey
  featureNumber: number
}

export default function PlaceholderScreen({ icon: Icon, title, description, featureNumber }: Props) {
  const { t } = useApp()
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-navy text-brand">
        <Icon size={36} />
      </div>
      <span className="mb-3 rounded-full bg-brand-light px-3 py-1 text-xs font-bold tracking-wide text-brand-dark uppercase">
        {t('comingSoon')} · Feature {featureNumber}
      </span>
      <h2 className="text-xl font-bold text-navy">{t(title)}</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">{t(description)}</p>
    </div>
  )
}
