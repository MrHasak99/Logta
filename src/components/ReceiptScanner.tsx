import { useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import type { ExtractionResult, ScanSummary } from '../data/types'
import { extractReceipt } from '../services/aiExtractor'
import ImageUploader, { type ScanSource } from './scanner/ImageUploader'
import RecentScansFeed from './scanner/RecentScansFeed'
import ScanningAnimation from './scanner/ScanningAnimation'
import SuccessSummary from './scanner/SuccessSummary'
import VerificationTable, { type ReviewState } from './scanner/VerificationTable'

type Step =
  | { name: 'upload' }
  | { name: 'scanning' }
  | { name: 'review'; result: ExtractionResult; review: ReviewState }
  | { name: 'success'; summary: ScanSummary }

export default function ReceiptScanner() {
  const { t, products, stores, commitScan } = useApp()
  const [source, setSource] = useState<ScanSource | null>(null)
  const [step, setStep] = useState<Step>({ name: 'upload' })
  // Guards against a stale extraction resolving after the user started over.
  const runId = useRef(0)

  const handleScan = async () => {
    if (!source) return
    const id = ++runId.current
    setStep({ name: 'scanning' })
    const input =
      source.kind === 'sample'
        ? ({ kind: 'sample', receipt: source.receipt } as const)
        : ({ kind: 'image', dataUrl: source.dataUrl } as const)
    const result = await extractReceipt(input, products, stores)
    if (id !== runId.current) return
    setStep({
      name: 'review',
      result,
      review: {
        storeId: result.storeId,
        documentType: result.documentType,
        receiptDate: result.receiptDate,
        items: result.items,
      },
    })
  }

  const handleConfirm = () => {
    if (step.name !== 'review' || !step.review.storeId) return
    const { review } = step
    const summary = commitScan({
      storeId: review.storeId!,
      documentType: review.documentType,
      receiptDate: review.receiptDate,
      items: review.items,
    })
    setStep({ name: 'success', summary })
  }

  const reset = () => {
    runId.current++
    setSource(null)
    setStep({ name: 'upload' })
  }

  return (
    <div className="space-y-6 px-4 py-6">
      {step.name === 'upload' && (
        <>
          <div>
            <h2 className="text-2xl leading-snug font-bold text-ink">{t('scanTitle')}</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{t('scanSubtitle')}</p>
          </div>
          <ImageUploader source={source} onSourceChange={setSource} onScan={() => void handleScan()} />
        </>
      )}

      {step.name === 'scanning' && <ScanningAnimation />}

      {step.name === 'review' && (
        <VerificationTable
          result={step.result}
          review={step.review}
          onChange={(review) => setStep({ ...step, review })}
          onConfirm={handleConfirm}
          onCancel={reset}
        />
      )}

      {step.name === 'success' && <SuccessSummary summary={step.summary} onReset={reset} />}

      {/* Keep the flow focused: the feed only shows on the home and success states. */}
      {(step.name === 'upload' || step.name === 'success') && <RecentScansFeed />}
    </div>
  )
}
