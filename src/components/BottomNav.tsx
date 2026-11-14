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
  /** Number of unseen price alerts. Shown as a badge on the Alerts tab; hidden at 0 or when omitted. */
  alertsBadge?: number
}

export default function BottomNav({ active, onChange, alertsBadge }: Props) {
  const { t } = useApp()
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-line bg-white/95 shadow-nav backdrop-blur"
      aria-label="Main"
    >
      <ul className="flex px-2 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs transition-colors ${
                  isActive ? 'font-bold text-brand-dark' : 'font-medium text-slate-500 hover:text-brand-dark'
                }`}
              >
                <span
                  className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                    isActive ? 'bg-brand text-navy shadow-[0_6px_14px_-6px_rgb(34_197_139/0.8)]' : 'group-hover:bg-brand-light'
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                  {id === 'alerts' && !!alertsBadge && alertsBadge > 0 && (
                    <span
                      role="status"
                      aria-label={t('alertsBadgeLabel', { n: alertsBadge })}
                      className="absolute -top-0.5 end-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[11px] leading-none font-bold text-navy ring-2 ring-white"
                    >
                      {alertsBadge > 9 ? '9+' : alertsBadge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate leading-tight">{t(label)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
