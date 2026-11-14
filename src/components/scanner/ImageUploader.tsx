import { ChevronDown, FileText, ImagePlus, ScanSearch, UploadCloud, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useApp } from '../../context/AppContext'
import { MOCK_RECEIPTS, type MockReceipt } from '../../data/mockReceipts'
import { ACCEPTED_TYPES, compressImage } from '../../utils/image'

export type ScanSource =
  | { kind: 'image'; dataUrl: string; fileName: string }
  | { kind: 'sample'; receipt: MockReceipt }

interface Props {
  source: ScanSource | null
  onSourceChange: (source: ScanSource | null) => void
  onScan: () => void
}

export default function ImageUploader({ source, onSourceChange, onScan }: Props) {
  const { t, stores, storeName } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('badFileType'))
      return
    }
    setError('')
    setBusy(true)
    try {
      const dataUrl = await compressImage(file)
      onSourceChange({ kind: 'image', dataUrl, fileName: file.name })
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void handleFile(e.dataTransfer.files[0])
  }

  const clear = () => {
    onSourceChange(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section className="space-y-3">
      {source ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="relative">
            {source.kind === 'image' ? (
              <img src={source.dataUrl} alt="Receipt preview" className="max-h-80 w-full bg-slate-100 object-contain" />
            ) : (
              <SampleReceiptPreview receipt={source.receipt} storeLabel={storeName(stores.find((s) => s.id === source.receipt.storeId))} badge={t('sampleBadge')} />
            )}
            <button
              type="button"
              onClick={clear}
              className="absolute end-2 top-2 flex items-center gap-1 rounded-full bg-navy/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-navy"
            >
              <X size={14} /> {t('removeImage')}
            </button>
          </div>
          <div className="p-3">
            <button
              type="button"
              onClick={onScan}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-navy shadow-sm transition-colors hover:bg-brand-dark hover:text-white"
            >
              <ScanSearch size={18} /> {t('scanNow')}
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragging ? 'border-brand bg-brand-light/60' : 'border-slate-300 bg-white'
          }`}
        >
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-brand">
            <UploadCloud size={28} />
          </div>
          <p className="text-sm font-bold text-navy">{t('dropTitle')}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t('dropHint')}</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="mt-4 flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-800 disabled:opacity-60"
          >
            <ImagePlus size={16} /> {t('chooseFile')}
          </button>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

      {!source && (
        <>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            {t('orDivider')}
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-brand bg-brand-light/50 px-4 py-3 text-sm font-bold text-brand-dark transition-colors hover:bg-brand-light"
            >
              <span className="flex items-center gap-2">
                <FileText size={18} /> {t('useSample')}
              </span>
              <ChevronDown size={18} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {MOCK_RECEIPTS.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSourceChange({ kind: 'sample', receipt: r })
                        setMenuOpen(false)
                        setError('')
                      }}
                      className="flex w-full items-center justify-between px-4 py-3 text-start text-sm hover:bg-slate-50"
                    >
                      <span className="font-semibold text-navy">{r.label}</span>
                      <span className="text-xs text-slate-500">{r.lines.length} lines</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function SampleReceiptPreview({ receipt, storeLabel, badge }: { receipt: MockReceipt; storeLabel: string; badge: string }) {
  return (
    <div className="bg-slate-100 px-4 py-5">
      <div dir="ltr" className="mx-auto max-w-[260px] bg-white px-4 py-4 font-mono text-[11px] leading-5 text-slate-700 shadow">
        <p className="text-center text-xs font-bold text-navy">{receipt.storeHeader}</p>
        <p className="text-center text-[10px] text-slate-500">{receipt.storeSubHeader}</p>
        <p className="text-center text-[10px] text-slate-400">{storeLabel}</p>
        <div className="my-2 border-t border-dashed border-slate-300" />
        {receipt.lines.map((l, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span className="truncate">{l.raw}</span>
            <span className="shrink-0">{l.price.toFixed(3)}</span>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-slate-300" />
        <p className="text-center text-[10px] text-slate-400">*** {badge} ***</p>
      </div>
    </div>
  )
}
