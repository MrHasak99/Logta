import { X } from 'lucide-react'
import { useEffect, useId, type ReactNode } from 'react'
import { useApp } from '../../context/AppContext'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Modal bottom sheet constrained to the 480px app column. Closes on Escape and on backdrop tap. */
export default function BottomSheet({ open, onClose, title, children }: Props) {
  const { t } = useApp()
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up flex max-h-[88vh] w-full max-w-[480px] flex-col rounded-t-3xl bg-paper shadow-soft"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="-me-2 flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}
