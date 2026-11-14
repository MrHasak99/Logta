import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}

/** Friendly empty state: dashed card, mint icon tile, short copy and an optional action. */
export default function EmptyState({ icon: Icon, title, body, action }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand-dark">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="text-base font-bold text-ink">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-[280px] text-[15px] leading-relaxed text-slate-600">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
