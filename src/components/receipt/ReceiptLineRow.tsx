import { Ban, CheckCircle2, CircleHelp, Clock, PackagePlus, ShieldAlert, Store, type LucideIcon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { TKey } from '../../i18n'
import type { ReceiptLineView } from '../../types/api'
import { nameFor } from '../../utils/apiFormat'
import { formatKwd } from '../../utils/formatters'
import type { LineOutcome } from './lineOutcome'

const OUTCOME: Record<LineOutcome, { icon: LucideIcon; cls: string; label: TKey }> = {
  saved: { icon: CheckCircle2, cls: 'bg-brand-light text-brand-dark', label: 'rcptTileSaved' },
  held: { icon: ShieldAlert, cls: 'bg-amber-100 text-amber-900', label: 'rcptTileHeld' },
  waiting: { icon: Clock, cls: 'bg-slate-100 text-slate-700', label: 'rcptTileWaiting' },
  newItem: { icon: PackagePlus, cls: 'bg-sky-100 text-sky-800', label: 'rcptTileNew' },
  notUsed: { icon: Ban, cls: 'bg-slate-100 text-slate-700', label: 'rcptChipNotUsed' },
  noPrice: { icon: CircleHelp, cls: 'bg-slate-100 text-slate-700', label: 'rcptChipNoPrice' },
  storeNeeded: { icon: Store, cls: 'bg-amber-100 text-amber-900', label: 'rcptChipStoreNeeded' },
  notSaved: { icon: CircleHelp, cls: 'bg-slate-100 text-slate-700', label: 'rcptGroupOther' },
}

interface Props {
  line: ReceiptLineView
  outcome: LineOutcome
}

/** One receipt line with its outcome chip. Never says "confirm" or "pending approval": the server already decided. */
export default function ReceiptLineRow({ line, outcome }: Props) {
  const { t, lang } = useApp()
  const { icon: Icon, cls, label } = OUTCOME[outcome]
  const title = line.product ? nameFor(line.product, lang) : line.rawText
  const caption = line.method === 'alias_fuzzy' ? t('rcptMatchFuzzy') : line.method === 'llm' ? t('rcptMatchLlm') : null

  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p dir="auto" className="text-[15px] leading-snug font-bold text-ink">
          {title}
        </p>
        {line.product && (
          <p className="mt-0.5 text-[13px] text-slate-500">
            {t('rawText')}: <span dir="auto" className="font-mono break-words">{line.rawText}</span>
          </p>
        )}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${cls}`}>
            <Icon size={13} aria-hidden="true" /> {t(label)}
          </span>
          {caption && <span className="text-[13px] text-slate-500">{caption}</span>}
        </p>
      </div>
      <div className="shrink-0 text-end" dir="ltr">
        {line.unitPriceKwd != null ? (
          <>
            <p className="text-base font-extrabold text-ink">{formatKwd(line.unitPriceKwd)}</p>
            {line.qty !== 1 && <p className="text-[13px] text-slate-500">× {line.qty}</p>}
          </>
        ) : (
          <p className="text-sm text-slate-500">—</p>
        )}
      </div>
    </li>
  )
}
