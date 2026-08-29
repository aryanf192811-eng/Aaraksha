// src/components/shared/SOSHoldOverlay.tsx
// A large, full-screen mirror of the nav SOS button's hold-progress ring.
// The nav button itself is only 64px — while holding it, the user's own
// thumb physically covers that percentage text, so the only real feedback
// during a hold currently lives exactly where it can't be seen. This
// portals a bigger copy of the same ring next to (not on top of) the
// finger, using the identical stroke-dasharray/stroke-dashoffset math
// SOSButton.tsx already uses — not a second animation technique.
import { createPortal } from 'react-dom'
import { Siren } from 'lucide-react'
import { cn } from '../../lib/utils'

const QUICK_SEND_THRESHOLD_PCT = 66

interface SOSHoldOverlayProps {
  /** 0–100. The overlay stays mounted at all times and fades via CSS
   *  (opacity/scale) rather than mounting/unmounting on every hold —
   *  avoids exit-animation timing races entirely. */
  progress: number
  armed: boolean
}

export function SOSHoldOverlay({ progress, armed }: SOSHoldOverlayProps) {
  const visible = progress > 0
  const boxSize = 208
  const strokeWidth = 10
  const radius = (boxSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress / 100)
  const cx = boxSize / 2
  const cy = boxSize / 2

  const thresholdAngle = (QUICK_SEND_THRESHOLD_PCT / 100) * 2 * Math.PI
  const tickInner = radius - 7
  const tickOuter = radius + 7
  const tickX1 = cx + tickInner * Math.cos(thresholdAngle)
  const tickY1 = cy + tickInner * Math.sin(thresholdAngle)
  const tickX2 = cx + tickOuter * Math.cos(thresholdAngle)
  const tickY2 = cy + tickOuter * Math.sin(thresholdAngle)

  return createPortal(
    <div
      aria-hidden="true"
      className={cn(
        // Purely decorative mirror of the hold in progress — the actual
        // hold gesture is owned entirely by SOSButton underneath. Without
        // pointer-events-none here, this full-screen backdrop becomes the
        // topmost element under the still-held finger the instant it
        // mounts (z-[100], fixed inset-0), and lacking select-none/
        // touch-none/-webkit-touch-callout (unlike SOSButton itself)
        // Android's native long-press text-selection + dictionary lookup
        // fires on the overlay's own text mid-hold — confirmed live on a
        // real device (Chrome Android selected "emergency" from "Keep
        // holding for emergency category…" and popped its definition).
        'pointer-events-none select-none touch-none [-webkit-touch-callout:none]',
        'fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5',
        'bg-black/70 backdrop-blur-md',
        'transition-opacity duration-200 ease-out',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div
        className={cn(
          'relative flex items-center justify-center transition-transform duration-200 ease-out',
          visible ? 'scale-100' : 'scale-90'
        )}
        style={{ width: boxSize, height: boxSize }}
      >
        {/* Ambient glow behind the ring — the "charging" feel from the
            reference: a soft radial bloom in the same color the ring is
            currently drawn in, not a separate decorative element. */}
        <div className={cn(
          'absolute inset-2 rounded-full blur-2xl transition-colors duration-300',
          armed ? 'bg-sos/40' : 'bg-primary/30'
        )} />

        <svg className="absolute -rotate-90" width={boxSize} height={boxSize} viewBox={`0 0 ${boxSize} ${boxSize}`}>
          {/* Track — always visible so the full circle reads as "the whole
              journey", not just the filled portion. */}
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="white" strokeOpacity={0.15} strokeWidth={strokeWidth} />
          <line x1={tickX1} y1={tickY1} x2={tickX2} y2={tickY2}
            stroke="white" strokeOpacity={0.55} strokeWidth={2.5} strokeLinecap="round" />
          <circle
            cx={cx} cy={cy} r={radius} fill="none"
            stroke={armed ? '#ef4444' : '#ffffff'}
            strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            className="transition-[stroke] duration-200"
            style={{ filter: armed ? 'drop-shadow(0 0 10px rgba(239,68,68,.65))' : 'drop-shadow(0 0 10px rgba(255,255,255,.5))' }}
          />
        </svg>

        <div className="relative flex flex-col items-center gap-1">
          <Siren className={cn('w-6 h-6 mb-0.5 transition-colors duration-200', armed ? 'text-sos-light' : 'text-white/80')} />
          <span className="text-6xl font-black tabular-nums text-white leading-none">
            {Math.round(progress)}<span className="text-2xl align-top">%</span>
          </span>
        </div>
      </div>

      <p className={cn('text-sm font-bold tracking-wide transition-colors duration-200', armed ? 'text-sos-light' : 'text-white/90')}>
        {armed ? 'Release to send SOS' : 'Keep holding for emergency category…'}
      </p>
    </div>,
    document.body
  )
}
