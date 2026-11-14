import { Bell, ScanLine, ShoppingBasket, type LucideIcon } from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { TKey } from '../i18n'

export type TabId = 'scanner' | 'basket' | 'alerts'

const TABS: { id: TabId; label: TKey; icon: LucideIcon }[] = [
  { id: 'scanner', label: 'navScanner', icon: ScanLine },
  { id: 'basket', label: 'navBasket', icon: ShoppingBasket },
  { id: 'alerts', label: 'navAlerts', icon: Bell },
]

interface Props {
  active: TabId
  onChange: (tab: TabId) => void
}

export default function BottomNav({ active, onChange }: Props) {
  const { t } = useApp()
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-slate-200 bg-white/95 backdrop-blur"
      aria-label="Main"
    >
      <ul className="flex">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-0.5 px-2 pt-2 pb-3 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-brand-dark' : 'text-slate-500 hover:text-navy'
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    isActive ? 'bg-brand-light' : ''
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                {t(label)}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
