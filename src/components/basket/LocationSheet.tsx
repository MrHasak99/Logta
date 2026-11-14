import { Check, LoaderCircle, MapPin, Navigation } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { LocationOption } from '../../types/api'
import BottomSheet from '../ui/BottomSheet'

interface Props {
  open: boolean
  onClose: () => void
  areaOptions: LocationOption[]
  selectedAreaId?: string | null
  /** True while the browser is resolving the position. */
  locating?: boolean
  /** True when the user denied location access. */
  denied?: boolean
  onUseMyLocation: () => void
  onPickArea: (option: LocationOption) => void
}

/** Location picker: use the device position, or choose an area (built by the parent from the stores' areas). */
export default function LocationSheet({
  open,
  onClose,
  areaOptions,
  selectedAreaId,
  locating,
  denied,
  onUseMyLocation,
  onPickArea,
}: Props) {
  const { t, lang } = useApp()
  return (
    <BottomSheet open={open} onClose={onClose} title={t('basketLocationTitle')}>
      <button type="button" onClick={onUseMyLocation} disabled={locating} className="btn btn-primary min-h-14 w-full text-base">
        {locating ? <LoaderCircle size={20} className="animate-spin" aria-hidden="true" /> : <Navigation size={20} aria-hidden="true" />}
        {locating ? t('basketLocating') : t('basketLocationUse')}
      </button>
      {denied && (
        <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {t('basketLocationDenied')}
        </p>
      )}

      <p className="mt-5 mb-2 text-sm font-semibold text-slate-600">{t('basketChooseArea')}</p>
      <ul className="card divide-y divide-line overflow-hidden">
        {areaOptions.map((o) => {
          const selected = o.id === selectedAreaId
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onPickArea(o)}
                aria-pressed={selected}
                className="flex min-h-12 w-full items-center gap-3 px-4 text-start text-[15px] font-semibold text-ink hover:bg-slate-50"
              >
                <MapPin size={17} className="shrink-0 text-brand-dark" aria-hidden="true" />
                <span dir="auto" className="flex-1">
                  {lang === 'ar' ? o.labelAr : o.labelEn}
                </span>
                {selected && <Check size={18} className="text-brand-dark" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>
    </BottomSheet>
  )
}
