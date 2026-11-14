import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  icon: LucideIcon
  title: string
  body: string
  /** red = hard failure, amber = limit / try later */
  tone?: 'red' | 'amber'
  /** Buttons (use `.btn` classes, 44px minimum). */
  children?: ReactNode
}

/** Reusable error card. Never a full-screen modal; the photo/input stays in the parent so Retry needs no re-upload. */
export default function ErrorState({ icon: Icon, title, body, tone = 'red', children }: Props) {
  const toneCls =
    tone === 'red'
      ? { card: 'border-red-200 bg-red-50/60', icon: 'bg-red-100 text-red-700', title: 'text-red-800' }
      : { card: 'border-amber-300 bg-amber-50/70', icon: 'bg-amber-100 text-amber-800', title: 'text-amber-900' }
  return (
    <div role="alert" className={`rounded-2xl border px-5 py-6 text-center ${toneCls.card}`}>
      <span className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${toneCls.icon}`}>
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className={`text-base font-bold ${toneCls.title}`}>{title}</p>
      <p className="mx-auto mt-1 max-w-[300px] text-[15px] leading-relaxed text-slate-700">{body}</p>
      {children && <div className="mt-4 flex flex-col gap-2.5">{children}</div>}
    </div>
  )
}
