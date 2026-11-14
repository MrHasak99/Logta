import { Languages, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useApp } from '../context/AppContext'
import BottomNav, { type TabId } from './BottomNav'

interface Props {
  tab: TabId
  onTabChange: (tab: TabId) => void
  children: ReactNode
}

export default function Layout({ tab, onTabChange, children }: Props) {
  const { t, toggleLang, resetDemoData } = useApp()

  const handleReset = () => {
    if (window.confirm(t('resetConfirm'))) resetDemoData()
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-slate-50 shadow-xl">
      <header className="sticky top-0 z-20 bg-navy px-4 pt-3 pb-3 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg font-black text-navy">
              ل
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-extrabold tracking-tight">
                Logta <span className="text-brand">لقطة</span>
              </h1>
              <p className="text-[11px] text-slate-400">{t('appTagline')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center gap-1 rounded-lg bg-navy-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-navy-700"
              aria-label="Toggle language and layout direction"
            >
              <Languages size={14} />
              {t('switchLang')}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 rounded-lg bg-navy-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-navy-700"
            >
              <RotateCcw size={14} />
              <span className="max-[380px]:hidden">{t('resetDemo')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24">{children}</main>
      <BottomNav active={tab} onChange={onTabChange} />
    </div>
  )
}
