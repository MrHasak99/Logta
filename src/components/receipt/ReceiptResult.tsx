import { AlertTriangle, BellRing, ChevronDown, Clock, LoaderCircle, PackagePlus, ScanLine, Sparkles, Store, Check } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { TKey } from '../../i18n'
import type { ApiStore, AutoPromotion, ReceiptDetail, ReceiptLineView, ScanReportAlert } from '../../types/api'
import { nameFor } from '../../utils/apiFormat'
import ReceiptLineRow from './ReceiptLineRow'
import { lineOutcome, type LineOutcome } from './lineOutcome'

export interface ReceiptResultProps {
  /** GET /api/receipts/:id (also what to poll while lines are waiting). */
  receipt: ReceiptDetail
  /** True while the frontend is re-checking the receipt for waiting lines. */
  refreshing?: boolean
  // ---- optional extras that exist only in the POST /api/scan report
  learnedAliases?: number
  autoPromoted?: AutoPromotion[]
  /** Alerts fired by this scan that belong to THIS device (the report also contains other shoppers' alerts). */
  alerts?: ScanReportAlert[]
  // ---- partial result: store could not be detected
  stores?: ApiStore[]
  choosingStore?: boolean
  onChooseStore?: (storeId: number) => void
  // ---- actions
  onScanAnother: () => void
  onViewAlerts?: () => void
  onRetry?: () => void
}

type GroupKey = 'saved' | 'held' | 'waiting' | 'newItem' | 'other'

const GROUPS: { key: GroupKey; title: TKey }[] = [
  { key: 'saved', title: 'rcptGroupSaved' },
  { key: 'held', title: 'rcptGroupHeld' },
  { key: 'waiting', title: 'rcptGroupWaiting' },
  { key: 'newItem', title: 'rcptGroupNew' },
  { key: 'other', title: 'rcptGroupOther' },
]

const groupOf = (o: LineOutcome): GroupKey => (o === 'saved' ? 'saved' : o === 'held' ? 'held' : o === 'waiting' ? 'waiting' : o === 'newItem' ? 'newItem' : 'other')

const PREVIEW = 5

/**
 * Result of an automatic scan, presentational. The server has ALREADY saved everything it could, so nothing here is
 * "awaiting approval": lines are Saved, Held, Waiting for AI, New item or Not saved. No Confirm button exists.
 */
export default function ReceiptResult(p: ReceiptResultProps) {
  const { t, lang } = useApp()
  const { receipt } = p
  const { summary } = receipt
  const [showAllSaved, setShowAllSaved] = useState(false)

  const rows = receipt.lines.map((line) => ({ line, outcome: lineOutcome(line, receipt) }))
  const byGroup = (k: GroupKey) => rows.filter((r) => groupOf(r.outcome) === k)

  const failed = receipt.status === 'failed'
  const storeNeeded = !failed && receipt.store == null
  const unfinished = summary.held + summary.waiting + summary.newItems > 0 || summary.saved < summary.lines

  // Hero: never a green check over zero saved prices.
  const hero = failed
    ? { tone: 'red' as const, icon: AlertTriangle, title: t('rcptFailedTitle'), body: t('rcptFailedBody') }
    : storeNeeded
      ? { tone: 'amber' as const, icon: Store, title: t('rcptStoreNeededTitle'), body: t('rcptHeroNothing') }
      : summary.saved > 0
        ? {
            tone: 'green' as const,
            icon: Check,
            title: unfinished ? t('rcptProcessedTitle') : t('rcptSavedTitle'),
            body: summary.waiting > 0 ? t('rcptHeroWaiting') : summary.saved === 1 ? t('rcptHeroSavedOne') : t('rcptHeroSaved', { n: summary.saved }),
          }
        : { tone: 'neutral' as const, icon: Clock, title: t('rcptReceivedTitle'), body: summary.waiting > 0 ? t('rcptHeroWaiting') : t('rcptHeroNothing') }
  const HeroIcon = hero.icon
  const heroIconCls = { green: 'bg-brand text-navy', amber: 'bg-gold text-navy', red: 'bg-red-500 text-white', neutral: 'bg-white/15 text-white' }[hero.tone]

  const tiles: { value: number; label: string; always?: boolean }[] = [
    { value: summary.saved, label: t('rcptTileSaved'), always: true },
    { value: summary.held, label: t('rcptTileHeld') },
    { value: summary.waiting, label: t('rcptTileWaiting') },
    { value: summary.newItems, label: t('rcptTileNew') },
  ].filter((x) => x.always || x.value > 0)

  return (
    <section className="space-y-4">
      {/* Hero */}
      <div className="bg-khatam animate-pop-in overflow-hidden rounded-3xl bg-navy px-5 pt-7 pb-5 text-center text-white shadow-soft">
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full shadow-[0_0_0_8px_rgb(255_255_255/0.1)] ${heroIconCls}`}>
          <HeroIcon size={32} strokeWidth={hero.tone === 'green' ? 3 : 2.2} aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold">{hero.title}</h2>
        <p dir="auto" className="mt-1 text-base font-semibold text-brand">
          {receipt.store ? nameFor(receipt.store, lang) : receipt.storeTextRaw || t('storeNotDetected')}
        </p>
        <p className="mx-auto mt-1.5 max-w-[290px] text-sm leading-relaxed text-white/75">{hero.body}</p>

        {!failed && tiles.length > 0 && (
          <div className={`mt-5 grid gap-3 ${tiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {tiles.map((x) => (
              <div key={x.label} className="rounded-2xl bg-white/10 px-3 py-3.5">
                <p className="text-3xl leading-none font-extrabold text-gold">{x.value}</p>
                <p className="mt-1.5 text-sm font-medium text-white/80">{x.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {failed && p.onRetry && (
        <button type="button" onClick={p.onRetry} className="btn btn-primary w-full">
          {t('retry')}
        </button>
      )}

      {p.refreshing && (
        <p role="status" className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600">
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> {t('rcptRefreshing')}
        </p>
      )}

      {storeNeeded && <StoreChooser stores={p.stores ?? []} busy={p.choosingStore} onChoose={p.onChooseStore} />}

      {!!p.learnedAliases && p.learnedAliases > 0 && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-gold-light px-4 py-3 text-[15px] leading-relaxed font-medium text-gold-dark">
          <Sparkles size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> {t('rcptLearned', { n: p.learnedAliases })}
        </p>
      )}

      {p.alerts?.map((a, i) => (
        <div key={i} className="rounded-2xl border border-gold bg-gold-light/70 px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-bold text-gold-dark">
            <BellRing size={16} aria-hidden="true" /> {t('rcptAlertTitle')}
          </p>
          <p dir="auto" className="mt-1 text-[15px] leading-relaxed text-ink">
            {lang === 'ar' ? a.messageAr || a.messageEn : a.messageEn || a.messageAr}
          </p>
          {p.onViewAlerts && (
            <button type="button" onClick={p.onViewAlerts} className="btn btn-secondary mt-3 min-h-11 w-full text-sm">
              {t('rcptViewAlerts')}
            </button>
          )}
        </div>
      ))}

      {p.autoPromoted?.map((a) => (
        <p key={a.pendingId} dir="auto" className="flex items-start gap-2.5 rounded-2xl bg-sky-50 px-4 py-3 text-[15px] leading-relaxed font-medium text-sky-900">
          <PackagePlus size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {a.action === 'created'
            ? t('rcptPromotedCreated', { name: a.productNameEn })
            : t('rcptPromotedMerged', { text: a.rawText, name: a.productNameEn })}
        </p>
      ))}

      {/* Line groups */}
      {!failed &&
        GROUPS.map(({ key, title }) => {
          const list = byGroup(key)
          if (list.length === 0) return null
          const collapsed = key === 'saved' && !showAllSaved && list.length > PREVIEW
          const visible = collapsed ? list.slice(0, PREVIEW) : list
          return (
            <section key={key} className="space-y-2.5">
              <div className="px-1">
                <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
                  {t(title)}
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-700">{list.length}</span>
                </h3>
                <GroupHint group={key} count={list.length} />
              </div>
              <ul className="card divide-y divide-line overflow-hidden">
                {visible.map(({ line, outcome }) => (
                  <ReceiptLineRow key={(line as ReceiptLineView).lineId} line={line} outcome={outcome} />
                ))}
              </ul>
              {key === 'saved' && list.length > PREVIEW && (
                <button type="button" onClick={() => setShowAllSaved((v) => !v)} aria-expanded={showAllSaved} className="btn btn-secondary w-full">
                  {showAllSaved ? t('feedShowLess') : t('feedShowAll', { n: list.length })}
                  <ChevronDown size={18} className={`transition-transform ${showAllSaved ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
              )}
            </section>
          )
        })}

      {/* Next action: stays above the bottom nav */}
      <div className="card sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 bg-white/95 p-3.5 backdrop-blur">
        <button type="button" onClick={p.onScanAnother} className="btn btn-primary min-h-14 w-full text-base">
          <ScanLine size={20} aria-hidden="true" /> {t('scanAnother')}
        </button>
      </div>
    </section>
  )
}

function GroupHint({ group, count }: { group: GroupKey; count: number }) {
  const { t } = useApp()
  const text =
    group === 'held'
      ? t('rcptGroupHeldHint')
      : group === 'waiting'
        ? count === 1
          ? t('rcptGroupWaitingHintOne')
          : t('rcptGroupWaitingHint', { n: count })
        : group === 'newItem'
          ? t('rcptGroupNewHint')
          : null
  return text ? <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{text}</p> : null
}

/** The only user action in the automatic flow: tell us the store when the server could not. */
function StoreChooser({ stores, busy, onChoose }: { stores: ApiStore[]; busy?: boolean; onChoose?: (storeId: number) => void }) {
  const { t, lang } = useApp()
  const [id, setId] = useState('')
  return (
    <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4">
      <p className="text-base font-bold text-amber-900">{t('rcptChooseStoreTitle')}</p>
      <p className="mt-1 text-[15px] leading-relaxed text-amber-900">{t('rcptChooseStoreBody')}</p>
      <div className="relative mt-3">
        <select
          value={id}
          onChange={(e) => setId(e.target.value)}
          aria-label={t('store')}
          className="min-h-12 w-full appearance-none rounded-xl border border-amber-400 bg-white ps-3 pe-9 text-[15px] font-semibold text-ink"
        >
          <option value="">{t('selectStore')}</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {nameFor(s, lang)}
              {(lang === 'ar' ? s.areaAr : s.areaEn) ? ` · ${lang === 'ar' ? s.areaAr : s.areaEn}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      </div>
      <button
        type="button"
        disabled={!id || busy || !onChoose}
        onClick={() => id && onChoose?.(Number(id))}
        className="btn btn-primary mt-3 min-h-12 w-full disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none"
      >
        {busy && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        {busy ? t('rcptSavingPrices') : t('rcptSavePrices')}
      </button>
    </div>
  )
}
