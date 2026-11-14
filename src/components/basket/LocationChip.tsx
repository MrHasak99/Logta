import { ChevronDown, MapPin } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { SelectedLocation } from '../../types/api'

interface Props {
  location: SelectedLocation | null
  onOpen: () => void
}

/** Pill that shows where the basket is planned from and opens the location sheet. */
export default function LocationChip({ location, onOpen }: Props) {
  const { t, lang } = useApp()
  const place =
    location == null
      ? null
      : location.kind === 'gps'
        ? t('basketLocationMine')
        : lang === 'ar'
          ? location.option.labelAr
          : location.option.labelEn
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
        location ? 'border-line bg-white text-ink hover:border-brand' : 'border-amber-400 bg-amber-50 text-amber-900'
      }`}
    >
      <MapPin size={16} className={location ? 'text-brand-dark' : 'text-amber-700'} aria-hidden="true" />
      <span dir="auto">{place ? t('basketLocationNear', { place }) : t('basketLocationNone')}</span>
      <ChevronDown size={16} className="text-slate-500" aria-hidden="true" />
    </button>
  )
}
