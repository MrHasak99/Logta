import { Camera, ChevronRight, ImagePlus, LoaderCircle, ScanSearch, Sparkles, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useApp } from '../../context/AppContext'
import type { TKey } from '../../i18n'
import CameraCapture from './CameraCapture'
import { MOCK_RECEIPTS, type MockReceipt } from '../../data/mockReceipts'
import { ACCEPTED_TYPES, compressImage } from '../../utils/image'

export type ScanSource =
  | { kind: 'image'; dataUrl: string; fileName: string }
  | { kind: 'sample'; receipt: MockReceipt }

/** Presentation-only localized labels; unknown sample ids fall back to the label in the data file. */
const SAMPLE_LABEL_KEYS: Record<string, TKey> = {
  'mishref-coop-sample': 'sampleMishref',
  'lulu-sample': 'sampleLulu',
}

interface Props {
  source: ScanSource | null
  onSourceChange: (source: ScanSource | null) => void
  onScan: () => void
}

export default function ImageUploader({ source, onSourceChange, onScan }: Props) {
  const { t, stores, storeName } = useApp()
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [busy, setBusy] = useState<'camera' | 'upload' | null>(null)

  const sampleLabel = (r: MockReceipt) => (SAMPLE_LABEL_KEYS[r.id] ? t(SAMPLE_LABEL_KEYS[r.id]) : r.label)

  const handleFile = async (file: File | undefined, via: 'camera' | 'upload' = 'upload') => {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('badFileType'))
      return
    }
    setError('')
    setBusy(via)
    try {
      const dataUrl = await compressImage(file)
      onSourceChange({ kind: 'image', dataUrl, fileName: file.name })
    } finally {
      setBusy(null)
    }
  }

  // Take Photo: open a live camera view; fall back to the native capture input when the
  // browser has no camera API (or it is blocked), so the button always tries the camera first.
  const openCamera = () => {
    if (typeof navigator.mediaDevices?.getUserMedia === 'function') setCameraOpen(true)
    else cameraRef.current?.click()
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void handleFile(e.dataTransfer.files[0])
  }

  const clear = () => {
    onSourceChange(null)
    setError('')
    if (cameraRef.current) cameraRef.current.value = ''
    if (uploadRef.current) uploadRef.current.value = ''
  }

  return (
    <section className="space-y-5">
      {source ? (
        <div className="card animate-fade-up overflow-hidden">
          <div className="relative">
            {source.kind === 'image' ? (
              <img src={source.dataUrl} alt={t('previewAlt')} className="max-h-96 w-full bg-slate-100 object-contain" />
            ) : (
              <SampleReceiptPreview
                receipt={source.receipt}
                storeLabel={storeName(stores.find((s) => s.id === source.receipt.storeId))}
                badge={t('sampleBadge')}
              />
            )}
            <button
              type="button"
              onClick={clear}
              className="absolute end-3 top-3 flex min-h-11 items-center gap-1.5 rounded-full bg-navy/85 px-3.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-navy"
            >
              <X size={16} aria-hidden="true" /> {t('removeImage')}
            </button>
          </div>
          <div className="p-4">
            <button type="button" onClick={onScan} className="btn btn-primary min-h-14 w-full text-base">
              <ScanSearch size={20} aria-hidden="true" /> {t('scanNow')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Camera-first capture card (also a drag & drop target on desktop) */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`card overflow-hidden transition-shadow ${dragging ? 'ring-2 ring-brand ring-offset-2 ring-offset-paper' : ''}`}
          >
            <CaptureIllustration />
            <div className="px-5 pt-5 pb-5 text-center">
              <h3 className="text-lg font-bold text-ink">{dragging ? t('dropTitle') : t('captureTitle')}</h3>
              <p className="mx-auto mt-1 max-w-[280px] text-sm leading-relaxed text-slate-500">{t('captureHint')}</p>

              {/* Take Photo opens a live camera view (this input is only its fallback); Upload Image opens the gallery / file picker. */}
              <input
                ref={cameraRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                capture="environment"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0], 'camera')}
              />
              <input
                ref={uploadRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0], 'upload')}
              />

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={openCamera}
                  className="btn btn-primary min-h-14 w-full text-base"
                >
                  {busy === 'camera' ? (
                    <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Camera size={20} aria-hidden="true" />
                  )}
                  {t('takePhoto')}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => uploadRef.current?.click()}
                  className="btn btn-secondary min-h-12 w-full"
                >
                  {busy === 'upload' ? (
                    <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ImagePlus size={18} aria-hidden="true" />
                  )}
                  {t('uploadImage')}
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-500">{t('dropHint')}</p>

              {cameraOpen && (
                <CameraCapture
                  onClose={() => setCameraOpen(false)}
                  onUnavailable={() => {
                    setCameraOpen(false)
                    cameraRef.current?.click()
                  }}
                  onCapture={(file) => {
                    setCameraOpen(false)
                    void handleFile(file, 'camera')
                  }}
                />
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="h-px flex-1 bg-line" />
            {t('orDivider')}
            <span className="h-px flex-1 bg-line" />
          </div>

          {/* Demo samples: always visible so the flow can be shown without a real receipt */}
          <div className="rounded-3xl border border-gold/60 bg-gold-light/70 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-navy">
                <Sparkles size={20} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-bold text-ink">{t('useSample')}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{t('sampleHint')}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              {MOCK_RECEIPTS.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSourceChange({ kind: 'sample', receipt: r })
                      setError('')
                    }}
                    className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-start shadow-sm transition-all hover:border-brand hover:shadow-md active:scale-[0.99]"
                  >
                    <span
                      dir="auto"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-base font-bold text-brand"
                    >
                      {sampleLabel(r).charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span dir="auto" className="block text-[15px] leading-snug font-bold text-ink">
                        {sampleLabel(r)}
                      </span>
                      <span className="block text-sm text-slate-500">{t('sampleLines', { n: r.lines.length })}</span>
                    </span>
                    <ChevronRight size={20} className="shrink-0 text-brand-dark rtl:rotate-180" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {source && error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  )
}

/** Deep-green panel with a floating receipt inside viewfinder brackets. */
function CaptureIllustration() {
  return (
    <div className="bg-khatam relative flex h-44 items-center justify-center bg-navy" aria-hidden="true">
      <div className="animate-float-soft relative h-36 w-28">
        <svg viewBox="0 0 112 144" className="absolute inset-0 h-full w-full" fill="none">
          <g stroke="#22C58B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 24V11a8 8 0 0 1 8-8h13" />
            <path d="M88 3h13a8 8 0 0 1 8 8v13" />
            <path d="M3 120v13a8 8 0 0 0 8 8h13" />
            <path d="M109 120v13a8 8 0 0 1-8 8H88" />
          </g>
        </svg>
        <div className="absolute inset-4 rounded-md bg-paper px-2.5 py-3 shadow-[0_14px_30px_-10px_rgb(0_0_0/0.5)]">
          <div className="mx-auto mb-2.5 h-1.5 w-10 rounded bg-navy/30" />
          {[80, 56, 88, 64, 72].map((w, i) => (
            <div key={i} className="mb-2 flex items-center justify-between gap-1.5">
              <div className="h-1 rounded bg-navy/20" style={{ width: `${w * 0.55}%` }} />
              <div className="h-1 w-3.5 rounded bg-gold" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SampleReceiptPreview({ receipt, storeLabel, badge }: { receipt: MockReceipt; storeLabel: string; badge: string }) {
  return (
    <div className="bg-khatam bg-navy px-4 py-8">
      <div dir="ltr" className="mx-auto max-w-[280px] rounded-sm bg-paper px-4 py-5 font-mono text-xs leading-6 text-slate-700 shadow-[0_18px_40px_-14px_rgb(0_0_0/0.55)]">
        <p className="text-center text-[13px] font-bold text-navy">{receipt.storeHeader}</p>
        <p className="text-center text-xs text-slate-500">{receipt.storeSubHeader}</p>
        <p className="text-center text-xs text-slate-400">{storeLabel}</p>
        <div className="my-2.5 border-t border-dashed border-slate-300" />
        {receipt.lines.map((l, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span className="truncate">{l.raw}</span>
            <span className="shrink-0 font-semibold">{l.price.toFixed(3)}</span>
          </div>
        ))}
        <div className="my-2.5 border-t border-dashed border-slate-300" />
        <p className="text-center text-xs font-semibold text-gold-dark">*** {badge} ***</p>
      </div>
    </div>
  )
}
