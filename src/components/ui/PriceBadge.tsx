import { BadgeCheck, Clock, FlaskConical } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { trustBucket } from '../../utils/apiFormat'

interface Props {
  /** 0-1 trust from the API. Below 0.6 Estimate, 0.6 to below 0.8 Recent, 0.8 and above Verified. */
  trust: number
  isPromo?: boolean
}

/** Honest provenance chip for any price that comes from the API. Estimates are never styled like verified prices. */
export default function PriceBadge({ trust, isPromo }: Props) {
  const { t } = useApp()
  const bucket = trustBucket(trust)
  const config = {
    estimate: {
      cls: 'border border-dashed border-gold bg-gold-light text-gold-dark',
      icon: <FlaskConical size={13} aria-hidden="true" />,
      label: t('trustEstimate'),
    },
    recent: { cls: 'bg-sky-50 text-sky-800', icon: <Clock size={13} aria-hidden="true" />, label: t('trustRecent') },
    verified: { cls: 'bg-brand-light text-brand-dark', icon: <BadgeCheck size={13} aria-hidden="true" />, label: t('trustVerified') },
  }[bucket]
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${config.cls}`}>
        {config.icon}
        {config.label}
      </span>
      {isPromo && (
        <span className="rounded-full bg-gold px-2.5 py-0.5 text-[13px] font-bold text-navy">{t('promoBadge')}</span>
      )}
    </span>
  )
}
