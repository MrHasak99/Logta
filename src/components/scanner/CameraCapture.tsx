import { Camera, LoaderCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'

interface Props {
  /** Called with the captured frame as a JPEG file. */
  onCapture: (file: File) => void
  onClose: () => void
  /** Called when the camera cannot be opened (no device, permission denied, insecure context). */
  onUnavailable: () => void
}

/** Full-screen live camera view (rear camera preferred) used by "Take Photo". */
export default function CameraCapture({ onCapture, onClose, onUnavailable }: Props) {
  const { t } = useApp()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const stop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        void video.play().then(() => setReady(true))
      })
      .catch(() => {
        if (!cancelled) onUnavailable()
      })

    return () => {
      cancelled = true
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open the camera once per mount
  }, [])

  const snap = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t('takePhoto')} className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <LoaderCircle size={32} className="animate-spin" aria-hidden="true" />
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute end-3 top-3 flex min-h-11 items-center gap-1.5 rounded-full bg-black/60 px-3.5 text-sm font-semibold text-white backdrop-blur"
        >
          <X size={16} aria-hidden="true" /> {t('closeCamera')}
        </button>
      </div>
      <div className="flex items-center justify-center bg-black px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={!ready}
          onClick={snap}
          aria-label={t('snapPhoto')}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-white/20 text-white transition-transform active:scale-95 disabled:opacity-40"
        >
          <Camera size={30} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
