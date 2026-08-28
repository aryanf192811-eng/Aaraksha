// src/components/shared/SOSButton.tsx
// The most important UI element in the tourist app — must be unmissable,
// and must not fire from a stray tap. Requires a deliberate hold, with a
// filling ring around the button as feedback, before it triggers —
// releasing early cancels cleanly with no side effect.
//
// Two interaction modes, both driven by the same pointer-capture/hold-loop
// mechanics below:
//   - Single-stage (default, used by the Safety Center's full-size button):
//     hold 2s, `onTrigger` fires once at 100%. Unchanged from the original
//     behavior — every existing call site keeps working exactly as before.
//   - Two-stage (`twoStage`, used by the Dashboard's quick-access button):
//     hold window is 3s. Releasing between 66% and 100% fires `onQuickSend`
//     (send now, with whatever default category the caller wants) — this is
//     the "hold ~2s" case. Holding all the way to 100% instead fires
//     `onHoldComplete` and does NOT send anything itself — it's the signal
//     for the caller to open a category picker, since holding that long
//     reads as "I want to specify what's wrong," not "send immediately."
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

const SINGLE_STAGE_DURATION_MS = 2000
const TWO_STAGE_DURATION_MS = 3000
const QUICK_SEND_THRESHOLD_PCT = 66

interface SOSButtonProps {
  onTrigger: () => void
  isActive?: boolean
  disabled?: boolean
  loading?: boolean
  /** 'nav' is a small icon-only variant sized for the bottom nav's raised
   *  center slot — no internal "SEND SOS"/"SOS ACTIVE" caption (no room;
   *  the nav renders its own "SOS" label below it), but the live hold
   *  percentage still shows — that feedback is safety-critical and never
   *  gets dropped for space. */
  size?: 'default' | 'compact' | 'nav'
  className?: string
  /** Switches to the 3s two-stage hold described above. Default false — every
   *  existing single-stage call site is unaffected. */
  twoStage?: boolean
  /** twoStage only: fires once on release when the hold was between 66% and
   *  100% of the window. */
  onQuickSend?: () => void
  /** twoStage only: fires once if the hold reaches 100% while still held
   *  (before release). Does not send anything — signals "open the category
   *  picker" to the caller. */
  onHoldComplete?: () => void
  /** Fired every animation-frame tick with the current 0–100 progress, so a
   *  parent can render hint text/percentage outside the button's own small
   *  circle (the compact 96px size has no room for a second line inside). */
  onHoldProgress?: (pct: number) => void
}

export function SOSButton({
  onTrigger, isActive = false, disabled = false, loading = false, size = 'default', className,
  twoStage = false, onQuickSend, onHoldComplete, onHoldProgress,
}: SOSButtonProps) {
  const holdDurationMs = twoStage ? TWO_STAGE_DURATION_MS : SINGLE_STAGE_DURATION_MS
  const [holdProgress, setHoldProgress] = useState(0) // 0–100
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const triggeredRef = useRef(false)
  // Tracks which single pointer (finger) owns the current hold. Without
  // this, a second finger touching the button mid-hold — or a stray
  // pointerup/leave from an unrelated pointer — could reset or interfere
  // with a legitimate in-progress hold.
  const activePointerIdRef = useRef<number | null>(null)

  const stopHold = useCallback((e?: React.PointerEvent<HTMLButtonElement>) => {
    // Ignore events from a pointer that isn't the one currently holding —
    // e.g. a second finger lifting off shouldn't cancel the first finger's hold.
    if (e && activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return
    if (e?.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* already released */ }
    }

    // Two-stage: a release between the quick-send threshold and 100% fires
    // the default-category send. Computed from the actual elapsed time
    // (not the possibly-stale `holdProgress` state) so a release right at
    // the boundary isn't off by a stale render. Guarded by triggeredRef so
    // this never double-fires alongside the "held to 100%" branch in tick().
    if (twoStage && !triggeredRef.current && startRef.current != null) {
      const elapsed = performance.now() - startRef.current
      const releasedPct = Math.min(100, (elapsed / holdDurationMs) * 100)
      if (releasedPct >= QUICK_SEND_THRESHOLD_PCT) {
        triggeredRef.current = true
        onQuickSend?.()
      }
    }

    activePointerIdRef.current = null
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    startRef.current = null
    setHoldProgress(0)
    onHoldProgress?.(0)
  }, [twoStage, holdDurationMs, onQuickSend, onHoldProgress])

  const tick = useCallback((now: number) => {
    if (startRef.current == null) startRef.current = now
    const elapsed = now - startRef.current
    const pct = Math.min(100, (elapsed / holdDurationMs) * 100)
    setHoldProgress(pct)
    onHoldProgress?.(pct)
    if (pct >= 100) {
      if (!triggeredRef.current) {
        triggeredRef.current = true
        if (twoStage) onHoldComplete?.()
        else onTrigger()
      }
      stopHold()
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [holdDurationMs, twoStage, onTrigger, onHoldComplete, onHoldProgress, stopHold])

  const startHold = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || loading || isActive) return
    // A hold is already in progress (from another finger, or a re-entrant
    // pointerdown) — ignore additional pointers rather than restarting or
    // double-counting the hold.
    if (activePointerIdRef.current != null) return

    activePointerIdRef.current = e.pointerId
    // Pointer capture keeps this element receiving this pointer's events
    // even if the finger drifts a few px off the visual bounds during the
    // hold (natural on a small, pulsing, scaling touch target) — without
    // it, that drift fires a premature pointerleave and silently cancels
    // an otherwise-deliberate hold.
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* unsupported — falls back to normal bubbling */ }

    triggeredRef.current = false
    rafRef.current = requestAnimationFrame(tick)
  }, [disabled, loading, isActive, tick])

  // Unmount mid-hold shouldn't leak the animation frame loop.
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }, [])

  const boxSize = size === 'default' ? 176 : size === 'compact' ? 96 : 64 // px — matches w-44 / w-24 / w-16
  const strokeWidth = 6
  const radius = (boxSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - holdProgress / 100)
  const cx = boxSize / 2
  const cy = boxSize / 2

  // Threshold tick mark at the quick-send boundary — drawn in the same
  // (pre-CSS-rotation) coordinate space the progress ring's dasharray
  // already uses, so it lines up exactly with where "66% around the
  // circle" visually ends up once the wrapping <svg> is rotated -90deg.
  const thresholdAngle = (QUICK_SEND_THRESHOLD_PCT / 100) * 2 * Math.PI
  const tickInner = radius - 5
  const tickOuter = radius + 5
  const tickX1 = cx + tickInner * Math.cos(thresholdAngle)
  const tickY1 = cy + tickInner * Math.sin(thresholdAngle)
  const tickX2 = cx + tickOuter * Math.cos(thresholdAngle)
  const tickY2 = cy + tickOuter * Math.sin(thresholdAngle)

  const armed = twoStage && holdProgress >= QUICK_SEND_THRESHOLD_PCT

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Pulse rings — active while an SOS is live, and (default/compact
          only) as a standing affordance even at rest so the button reads as
          "always armed". The nav variant sits in the bottom bar on every
          screen, permanently in view — a constant ambient pulse there reads
          as flicker, not reassurance, so it only animates when there's a
          real reason to: an actual active SOS. Motion should mean
          something, not just decorate a persistent nav element. */}
      {(size !== 'nav' || isActive) && (
        <>
          <span className={cn('absolute inline-flex h-full w-full rounded-full bg-sos animate-pulse-ring',
            isActive ? 'opacity-40' : 'opacity-20')} />
          <span className={cn('absolute inline-flex h-full w-full rounded-full bg-sos animate-pulse-ring-delayed',
            isActive ? 'opacity-30' : 'opacity-10')} />
        </>
      )}

      {/* Hold-progress ring, plus (twoStage only) a threshold tick mark at
          66% — the point past which releasing sends the default-category
          SOS instead of cancelling. */}
      {(holdProgress > 0 || twoStage) && (
        <svg className="absolute -rotate-90 pointer-events-none" width={boxSize} height={boxSize} viewBox={`0 0 ${boxSize} ${boxSize}`}>
          {twoStage && (
            <line x1={tickX1} y1={tickY1} x2={tickX2} y2={tickY2}
              stroke="white" strokeOpacity={0.85} strokeWidth={2} strokeLinecap="round" />
          )}
          {holdProgress > 0 && (
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="white" strokeOpacity={armed ? 1 : 0.9}
              strokeWidth={armed ? strokeWidth + 1.5 : strokeWidth} strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              className="transition-[stroke-width] duration-150" />
          )}
        </svg>
      )}

      <button
        onPointerDown={startHold}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(e) => e.preventDefault()}
        disabled={disabled || loading}
        className={cn(
          'relative z-10 flex flex-col items-center justify-center gap-2 select-none touch-none',
          '[-webkit-touch-callout:none]', // suppresses Safari's long-press "Save Image/Copy" menu mid-hold
          'rounded-full font-display font-black tracking-wide shadow-2xl',
          'transition-transform duration-200',
          holdProgress > 0 && 'scale-95',
          'focus:outline-none focus:ring-4 focus:ring-sos-light focus:ring-offset-2',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          size === 'default' ? 'w-44 h-44 text-2xl' : size === 'compact' ? 'w-24 h-24 text-sm' : 'w-16 h-16 text-xs',
          isActive
            ? 'bg-sos-dark text-white animate-sos-pulse shadow-sos-dark/50'
            : 'bg-sos hover:bg-sos-dark text-white shadow-sos/40',
        )}
        aria-label={twoStage
          ? 'Hold 2 seconds to send SOS, or hold 3 seconds to choose an emergency category'
          : 'Hold for 2 seconds to send SOS emergency alert'}
      >
        {loading ? (
          <Loader2 className={cn('animate-spin', size === 'default' ? 'w-10 h-10' : size === 'compact' ? 'w-6 h-6' : 'w-5 h-5')} />
        ) : holdProgress > 0 ? (
          <span className={cn('font-black tabular-nums', size === 'default' ? 'text-3xl' : size === 'compact' ? 'text-xl' : 'text-[11px]')}>
            {Math.round(holdProgress)}%
          </span>
        ) : (
          <>
            <AlertTriangle className={cn(size === 'default' ? 'w-10 h-10' : size === 'compact' ? 'w-6 h-6' : 'w-5 h-5')} fill="currentColor" />
            {size !== 'nav' && <span>{isActive ? 'SOS ACTIVE' : 'SEND SOS'}</span>}
          </>
        )}
        {size === 'default' && !isActive && !loading && (
          <span className="text-xs font-medium opacity-80">
            {holdProgress === 0
              ? (twoStage ? 'Hold to alert' : 'Hold 2s to alert')
              : twoStage
                ? (armed ? 'Release to send' : 'Keep holding...')
                : 'Keep holding...'}
          </span>
        )}
      </button>
    </div>
  )
}
