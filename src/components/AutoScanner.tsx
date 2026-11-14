import { useCallback, useEffect, useRef, useState } from 'react'
import { api, notifyAlertsChanged, scanErrorKind, type ExtractionInput, type ScanReport } from '../api/client'
import { useApp } from '../context/AppContext'
import type { MockReceipt } from '../data/mockReceipts'
import type { ApiStore, ReceiptDetail, ReceiptListItem, ScanErrorKind, ScanReportAlert } from '../types/api'
import ReceiptHistoryList from './receipt/ReceiptHistoryList'
import ReceiptResult from './receipt/ReceiptResult'
import ScanError from './receipt/ScanError'
import ScanWaiting from './receipt/ScanWaiting'
import ImageUploader, { type ScanSource } from './scanner/ImageUploader'

/** What to (re)send: a photo, or a built-in sample turned into extraction JSON. */
type Payload = { kind: 'image'; dataUrl: string } | { kind: 'extraction'; extraction: ExtractionInput }

type Step =
  | { name: 'upload' }
  | { name: 'waiting' }
  | { name: 'error'; kind: ScanErrorKind; retryAfter?: number }
  | { name: 'result'; receipt: ReceiptDetail; report?: ScanReport }

const POLL_MS = 20_000
const MAX_POLLS = 9

const sampleToExtraction = (r: MockReceipt): ExtractionInput => ({
  store_text: `${r.storeHeader} ${r.storeSubHeader ?? ''}`.trim(),
  purchased_at: null,
  total_kwd: null,
  lines: r.lines.map((l) => ({ raw_text: l.raw, qty: 1, unit_price_kwd: l.price, line_total_kwd: l.price })),
})

/** Only this device's alerts from a scan report, in the shape the result card needs. */
const myAlerts = (report: ScanReport | undefined): ScanReportAlert[] =>
  (report?.alerts ?? []).filter((a) => a.userId === report?.userId).map((a) => ({ messageEn: a.alert.messageEn, messageAr: a.alert.messageAr, hint: a.hint }))

/**
 * Automatic scanner (API mode): the server matches, saves and learns everything. No confirmation step.
 * Container component — owns state and fetching; the receipt/* components are presentational.
 */
export default function AutoScanner({ onViewAlerts }: { onViewAlerts: () => void }) {
  const { t } = useApp()
  const [source, setSource] = useState<ScanSource | null>(null)
  const [step, setStep] = useState<Step>({ name: 'upload' })
  const [elapsed, setElapsed] = useState(0)
  const [stores, setStores] = useState<ApiStore[]>([])
  const [choosingStore, setChoosingStore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [history, setHistory] = useState<ReceiptListItem[]>([])
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const lastPayload = useRef<Payload | null>(null)
  const runId = useRef(0)

  const loadHistory = useCallback(async () => {
    setHistoryStatus('loading')
    try {
      setHistory(await api.receipts(10))
      setHistoryStatus('ready')
    } catch {
      setHistoryStatus('error')
    }
  }, [])

  useEffect(() => {
    void loadHistory()
    api.stores().then(setStores).catch(() => setStores([]))
  }, [loadHistory])

  // elapsed-seconds timer while waiting
  useEffect(() => {
    if (step.name !== 'waiting') return
    setElapsed(0)
    const started = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(id)
  }, [step.name])

  // rate-limit countdown
  useEffect(() => {
    if (step.name !== 'error' || !step.retryAfter) return
    const id = setInterval(() => setStep((s) => (s.name === 'error' && s.retryAfter ? { ...s, retryAfter: Math.max(0, s.retryAfter - 1) } : s)), 1000)
    return () => clearInterval(id)
  }, [step.name]) // the interval decrements via a functional update, so it only needs to restart when the step changes

  // poll the receipt while lines are waiting for the AI
  const receiptId = step.name === 'result' ? step.receipt.id : null
  const waitingCount = step.name === 'result' ? step.receipt.summary.waiting : 0
  useEffect(() => {
    if (receiptId == null || waitingCount === 0) return
    let polls = 0
    const id = setInterval(async () => {
      if (++polls > MAX_POLLS) return clearInterval(id)
      setRefreshing(true)
      try {
        const fresh = await api.receipt(receiptId)
        setStep((s) => (s.name === 'result' && s.receipt.id === fresh.id ? { ...s, receipt: fresh } : s))
      } catch {
        // keep showing the last state
      } finally {
        setRefreshing(false)
      }
    }, POLL_MS)
    return () => clearInterval(id)
  }, [receiptId, waitingCount])

  const send = async (payload: Payload, storeId?: number) => {
    const id = ++runId.current
    lastPayload.current = payload
    setStep({ name: 'waiting' })
    try {
      const report = payload.kind === 'image' ? await api.scanImage(payload.dataUrl, storeId) : await api.ingest(payload.extraction, storeId)
      const receipt = await api.receipt(report.receiptId)
      if (id !== runId.current) return
      setStep({ name: 'result', receipt, report })
      if (report.alerts.length) notifyAlertsChanged()
      void loadHistory()
    } catch (e) {
      if (id !== runId.current) return
      const kind = scanErrorKind(e)
      setStep({ name: 'error', kind, retryAfter: (e as { retryAfter?: number }).retryAfter })
      // a timeout / network drop may still have been saved on the server
      if (kind === 'timeout' || kind === 'network') void loadHistory()
    } finally {
      if (id === runId.current) setChoosingStore(false)
    }
  }

  const handleScan = () => {
    if (!source) return
    void send(source.kind === 'image' ? { kind: 'image', dataUrl: source.dataUrl } : { kind: 'extraction', extraction: sampleToExtraction(source.receipt) })
  }

  const reset = () => {
    runId.current++
    setSource(null)
    setStep({ name: 'upload' })
  }

  const openReceipt = async (receiptIdToOpen: number) => {
    const id = ++runId.current
    setStep({ name: 'waiting' })
    try {
      const receipt = await api.receipt(receiptIdToOpen)
      if (id === runId.current) setStep({ name: 'result', receipt })
    } catch (e) {
      if (id === runId.current) setStep({ name: 'error', kind: scanErrorKind(e) })
    }
  }

  return (
    <div className="space-y-6 px-4 py-6">
      {step.name === 'upload' && (
        <>
          <div>
            <h2 className="text-2xl leading-snug font-bold text-ink">{t('scanTitle')}</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{t('scanSubtitle')}</p>
          </div>
          <ImageUploader source={source} onSourceChange={setSource} onScan={handleScan} />
          <ReceiptHistoryList receipts={history} status={historyStatus} onOpen={(id) => void openReceipt(id)} onRetry={() => void loadHistory()} />
        </>
      )}

      {step.name === 'waiting' && <ScanWaiting elapsedSeconds={elapsed} onStopWaiting={reset} />}

      {step.name === 'error' && (
        <ScanError
          kind={step.kind}
          retryAfterSeconds={step.retryAfter}
          onRetry={() => (lastPayload.current ? void send(lastPayload.current) : reset())}
          onSecondary={reset}
        />
      )}

      {step.name === 'result' && (
        <ReceiptResult
          receipt={step.receipt}
          refreshing={refreshing}
          learnedAliases={step.report?.learnedAliases}
          autoPromoted={step.report?.autoPromoted}
          alerts={myAlerts(step.report)}
          stores={stores.filter((s) => s.type !== 'online')}
          choosingStore={choosingStore}
          onChooseStore={(storeId) => {
            if (!lastPayload.current) return
            setChoosingStore(true)
            void send(lastPayload.current, storeId)
          }}
          onScanAnother={reset}
          onViewAlerts={onViewAlerts}
          onRetry={() => void openReceipt(step.receipt.id)}
        />
      )}
    </div>
  )
}
