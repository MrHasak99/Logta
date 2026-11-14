import { Languages, RotateCcw } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useApp } from '../context/AppContext'
import BottomNav, { type TabId } from './BottomNav'

interface Props {
  tab: TabId
  onTabChange: (tab: TabId) => void
  children: ReactNode
  /** Unseen price alerts (automatic mode); shown as a badge on the Alerts tab. */
  alertsBadge?: number
}

/** Viewfinder brackets around the letter ل: "a snapshot" (لُقطة). */
function LogoMark() {
  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-navy-800 shadow-inner">
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
        <g stroke="#22C58B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 14V10a3 3 0 0 1 3-3h4" />
          <path d="M26 7h4a3 3 0 0 1 3 3v4" />
          <path d="M7 26v4a3 3 0 0 0 3 3h4" />
          <path d="M33 26v4a3 3 0 0 1-3 3h-4" />
        </g>
      </svg>
      <span className="relative text-xl leading-none font-bold text-gold">ل</span>
    </div>
  )
}

export default function Layout({ tab, onTabChange, children, alertsBadge }: Props) {
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
      <header className="bg-khatam sticky top-0 z-20 rounded-b-[1.75rem] bg-navy px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4 text-white shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoMark />
            <div className="min-w-0 leading-none">
              <h1 className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold">لُقطة</span>
                <span className="text-sm font-semibold tracking-wide text-brand">Logta</span>
              </h1>
              <p className="mt-1.5 truncate text-[13px] font-medium text-white/70">{t('appTagline')}</p>
            </div>
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
      <BottomNav active={tab} onChange={onTabChange} alertsBadge={alertsBadge} />

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
