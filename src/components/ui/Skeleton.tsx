/** Loading placeholder block. Size it with className (e.g. "h-24 w-full"). */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />
}
