import { Check, Minus, ScanLine, Sparkles, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { PriceDelta, ScanSummary } from '../../data/types'
import { formatKwd } from '../../utils/formatters'

interface Props {
  summary: ScanSummary
  onReset: () => void
}

type Tone = 'down' | 'up' | 'flat' | 'new'

const TONES: Record<Tone, { icon: LucideIcon; ring: string; chip: string; amount: string }> = {
  down: { icon: TrendingDown, ring: 'bg-emerald-100 text-emerald-700', chip: 'bg-emerald-50 text-emerald-700', amount: 'text-emerald-700' },
  up: { icon: TrendingUp, ring: 'bg-red-100 text-red-600', chip: 'bg-red-50 text-red-600', amount: 'text-red-600' },
  flat: { icon: Minus, ring: 'bg-slate-100 text-slate-500', chip: 'bg-slate-100 text-slate-600', amount: 'text-slate-500' },
  new: { icon: Sparkles, ring: 'bg-gold-light text-gold-dark', chip: 'bg-gold-light text-gold-dark', amount: 'text-gold-dark' },
}

const toneOf = (d: PriceDelta): Tone =>
  d.delta === null ? 'new' : Math.abs(d.delta) < 0.0005 ? 'flat' : d.delta < 0 ? 'down' : 'up'

export default function SuccessSummary({ summary, onReset }: Props) {
  const { t, stores, products, storeName, productName } = useApp()
  const store = stores.find((s) => s.id === summary.storeId)

  // Everything below is derived from the real deltas returned by the commit.
  const rows = summary.deltas.map((d) => ({ d, tone: toneOf(d) }))
  const count = (tone: Tone) => rows.filter((r) => r.tone === tone).length
  const chips: { tone: Tone; text: string }[] = (
    [
      { tone: 'down', n: count('down'), key: 'statCheaper' },
      { tone: 'up', n: count('up'), key: 'statHigher' },
      { tone: 'flat', n: count('flat'), key: 'statSame' },
      { tone: 'new', n: count('new'), key: 'statNew' },
    ] as const
  )
    .filter((c) => c.n > 0)
    .map((c) => ({ tone: c.tone, text: t(c.key, { n: c.n }) }))

  return (
    <section className="space-y-4">
      {/* Confirmation hero */}
      <div className="bg-khatam animate-pop-in overflow-hidden rounded-3xl bg-navy px-5 pt-7 pb-5 text-center text-white shadow-soft">
        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-navy shadow-[0_0_0_8px_rgb(34_197_139/0.22)]">
          <Check size={34} strokeWidth={3} aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold">{t('successTitle')}</h2>
        <p dir="auto" className="mt-1 text-base font-semibold text-brand">
          {storeName(store)}
        </p>
        <p className="mx-auto mt-1.5 max-w-[280px] text-sm leading-relaxed text-white/70">{t('successHint')}</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat value={summary.added} label={t('itemsAdded')} />
          <Stat value={summary.updated} label={t('itemsUpdated')} />
        </div>
      </div>

      {/* Price changes */}
      {rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 pt-4 pb-3">
            <h3 className="text-base font-bold text-ink">{t('changesTitle')}</h3>
            {chips.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <span key={c.tone} className={`rounded-full px-3 py-1 text-sm font-bold ${TONES[c.tone].chip}`}>
                    {c.text}
                  </span>
                ))}
              </div>
            )}
          </div>

          <ul className="divide-y divide-line">
            {rows.map(({ d, tone }) => {
              const { icon: Icon, ring, chip, amount } = TONES[tone]
              const product = productName(products.find((p) => p.id === d.productId))
              const badge =
                tone === 'down' ? t('badgeCheaper') : tone === 'up' ? t('badgeHigher') : tone === 'flat' ? t('badgeSame') : t('badgeNew')
              return (
                <li key={d.productId} className="flex items-center gap-3 px-4 py-3.5">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ring}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="text-[15px] leading-snug font-bold text-ink">
                      {product}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {d.previousPrice !== null ? (
                        <>
                          {t('wasPrice')} <span dir="ltr" className="inline-block">{formatKwd(d.previousPrice)}</span>
                        </>
                      ) : (
                        t('firstPrice')
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-end" dir="ltr">
                    <p className="text-base font-extrabold text-ink">{formatKwd(d.newPrice)}</p>
                    <p className="mt-1 flex items-center justify-end gap-1.5">
                      {d.delta !== null && tone !== 'flat' && (
                        <span className={`text-sm font-bold ${amount}`}>
                          {tone === 'down' ? '↓' : '↑'} {Math.abs(d.delta).toFixed(3)}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${chip}`}>{badge}</span>
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Next action: stays above the bottom nav */}
      <div className="card sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 bg-white/95 p-3.5 backdrop-blur">
        <button type="button" onClick={onReset} className="btn btn-primary min-h-14 w-full text-base">
          <ScanLine size={20} aria-hidden="true" /> {t('scanAnother')}
        </button>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-3.5">
      <p className="text-3xl leading-none font-extrabold text-gold">{value}</p>
      <p className="mt-1.5 text-sm font-medium text-white/80">{label}</p>
    </div>
  )
}
