import type { ReceiptLineView, ReceiptListItem } from '../../types/api'

/** How one receipt line ended up, in UI terms. Derived only from the API fields; nothing is assumed. */
export type LineOutcome = 'saved' | 'held' | 'notUsed' | 'waiting' | 'newItem' | 'noPrice' | 'storeNeeded' | 'notSaved'

export function lineOutcome(line: ReceiptLineView, receipt: Pick<ReceiptListItem, 'store'>): LineOutcome {
  if (line.observation?.status === 'accepted') return 'saved'
  if (line.observation?.status === 'quarantined') return 'held'
  if (line.observation?.status === 'rejected') return 'notUsed'
  if (line.status === 'needs_review') return 'waiting'
  if (line.status === 'unmatched') return 'newItem'
  // matched, but no price was recorded
  if (line.unitPriceKwd == null) return 'noPrice'
  if (receipt.store == null) return 'storeNeeded'
  return 'notSaved'
}
