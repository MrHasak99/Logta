import { Languages, RotateCcw } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useApp } from '../context/AppContext'
import logo from '../assets/logo.png'
import BottomNav, { type TabId } from './BottomNav'

interface Props {
  tab: TabId
  onTabChange: (tab: TabId) => void
  children: ReactNode
}

export default function Layout({ tab, onTabChange, children }: Props) {
  const { t, toggleLang, resetDemoData } = useApp()
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirmOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmOpen])

  const handleReset = () => {
    resetDemoData()
    setConfirmOpen(false)
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-paper shadow-xl">
      <header className="sticky top-0 z-20 rounded-b-[1.75rem] bg-navy px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4 text-white shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {/* The logo is deep teal on transparent; brightness-0 + invert turns it white for the dark header. */}
            <h1 className="shrink-0">
              <img src={logo} alt="لُقطة Logta" width={63} height={48} className="h-12 w-auto brightness-0 invert" />
            </h1>
            <p className="min-w-0 text-[13px] leading-snug font-medium text-white/70">{t('appTagline')}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleLang}
              className="btn btn-on-dark min-h-11 rounded-full px-3 text-sm font-semibold"
            >
              <Languages size={16} aria-hidden="true" />
              {t('switchLang')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              aria-label={t('resetDemo')}
              title={t('resetDemo')}
              className="btn btn-on-dark h-11 min-h-11 w-11 rounded-full p-0"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-32">{children}</main>
      <BottomNav active={tab} onChange={onTabChange} />

      {confirmOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-navy/60 p-4 backdrop-blur-sm"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-up mb-2 w-full max-w-[448px] rounded-3xl bg-white p-5 shadow-soft"
          >
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-light text-gold-dark">
                <RotateCcw size={20} aria-hidden="true" />
              </span>
              <div>
                <h2 id="reset-title" className="text-base font-bold text-ink">
                  {t('resetTitle')}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('resetConfirm')}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" autoFocus onClick={() => setConfirmOpen(false)} className="btn btn-secondary">
                {t('dialogCancel')}
              </button>
              <button type="button" onClick={handleReset} className="btn bg-navy text-white hover:bg-navy-800">
                {t('resetConfirmYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
