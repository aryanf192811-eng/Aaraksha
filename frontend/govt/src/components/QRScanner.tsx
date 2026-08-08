// src/components/QRScanner.tsx
// Full-screen live camera QR scanner for the checkpoint field tool. Decodes
// frames locally via jsQR (pure JS, no native BarcodeDetector dependency —
// that API isn't available in Safari, and this needs to work on whatever
// phone an officer is holding). Manual paste stays available on the parent
// page as a fallback for a camera that's unavailable, denied, or damaged.
import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { X, Camera, AlertTriangle } from 'lucide-react'

interface QRScannerProps {
  onDetected: (data: string) => void
  onClose: () => void
}

export function QRScanner({ onDetected, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        tick()
      } catch (err) {
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Camera access denied — allow camera permission and try again, or paste the code manually.'
            : 'Could not access the camera — paste the code manually instead.'
        )
      }
    }

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || detectedRef.current) return

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })
          if (code && code.data) {
            detectedRef.current = true
            if (navigator.vibrate) navigator.vibrate(100)
            onDetected(code.data)
            return
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-5 h-5" />
          <span className="font-semibold text-sm">Scan Tourist QR Code</span>
        </div>
        <button onClick={onClose} aria-label="Close scanner"
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center gap-3 px-8 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <p className="text-white text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            {/* Scan frame overlay — purely visual, doesn't affect detection */}
            <div className="relative w-64 h-64 pointer-events-none">
              <div className="absolute inset-0 border-2 border-white/70 rounded-2xl" />
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl" />
            </div>
          </>
        )}
      </div>

      <p className="text-white/70 text-xs text-center pb-[max(1.5rem,env(safe-area-inset-bottom))] px-8">
        {error ? 'Close this and use the manual entry field instead.' : 'Point the camera at the tourist\'s Checkpoint Pass QR code'}
      </p>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
