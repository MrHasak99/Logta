import { LoaderCircle, Search, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder: string
  loading?: boolean
}

/** Search input (48px) with an inline clear button. Controlled; debouncing and fetching belong to the parent. */
export default function SearchField({ value, onChange, placeholder, loading }: Props) {
  const { t } = useApp()
  return (
    <div className="relative">
      <Search
        size={18}
        className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-500"
        aria-hidden="true"
      />
      <input
        type="search"
        dir="auto"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-12 w-full rounded-xl border border-line bg-white ps-11 pe-12 text-base text-ink placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      {loading ? (
        <LoaderCircle
          size={18}
          className="absolute end-3.5 top-1/2 -translate-y-1/2 animate-spin text-brand-dark"
          aria-hidden="true"
        />
      ) : (
        value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={t('searchClear')}
            className="absolute end-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )
      )}
    </div>
  )
}
