// src/components/shared/SOSButton.tsx
// The most important UI element in the tourist app — must be unmissable,
// and must not fire from a stray tap. Requires a deliberate 2-second hold,
// with a filling ring around the button as feedback, before it triggers —
// releasing early cancels cleanly with no side effect.
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

const HOLD_DURATION_MS = 2000

interface SOSButtonProps {
  onTrigger: () => void
  isActive?: boolean
  disabled?: boolean
  loading?: boolean
  size?: 'default' | 'compact'
  className?: string
}

export function SOSButton({
  onTrigger, isActive = false, disabled = false, loading = false, size = 'default', className,
}: SOSButtonProps) {
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
    activePointerIdRef.current = null
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    startRef.current = null
    setHoldProgress(0)
  }, [])

  const tick = useCallback((now: number) => {
    if (startRef.current == null) startRef.current = now
    const elapsed = now - startRef.current
    const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100)
    setHoldProgress(pct)
    if (pct >= 100) {
      if (!triggeredRef.current) {
        triggeredRef.current = true
        onTrigger()
      }
      stopHold()
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [onTrigger, stopHold])

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

  const boxSize = size === 'default' ? 176 : 96 // px — matches w-44 / w-24
  const strokeWidth = 6
  const radius = (boxSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - holdProgress / 100)

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Pulse rings — active while an SOS is live, and as a standing
          affordance even at rest so the button reads as "always armed". */}
      <span className={cn('absolute inline-flex h-full w-full rounded-full bg-sos animate-pulse-ring',
        isActive ? 'opacity-40' : 'opacity-20')} />
      <span className={cn('absolute inline-flex h-full w-full rounded-full bg-sos animate-pulse-ring-delayed',
        isActive ? 'opacity-30' : 'opacity-10')} />

      {/* Hold-progress ring — fills clockwise as the hold reaches 2s */}
      {holdProgress > 0 && (
        <svg className="absolute -rotate-90 pointer-events-none" width={boxSize} height={boxSize} viewBox={`0 0 ${boxSize} ${boxSize}`}>
          <circle cx={boxSize / 2} cy={boxSize / 2} r={radius} fill="none" stroke="white" strokeOpacity={0.9}
            strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={dashOffset} />
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
          size === 'default' ? 'w-44 h-44 text-2xl' : 'w-24 h-24 text-sm',
          isActive
            ? 'bg-sos-dark text-white animate-sos-pulse shadow-sos-dark/50'
            : 'bg-sos hover:bg-sos-dark text-white shadow-sos/40',
        )}
        aria-label="Hold for 2 seconds to send SOS emergency alert"
      >
        {loading ? (
          <Loader2 className={cn('animate-spin', size === 'default' ? 'w-10 h-10' : 'w-6 h-6')} />
        ) : (
          <>
            <AlertTriangle className={cn(size === 'default' ? 'w-10 h-10' : 'w-6 h-6')} fill="currentColor" />
            <span>{isActive ? 'SOS ACTIVE' : 'SEND SOS'}</span>
            {size === 'default' && !isActive && (
              <span className="text-xs font-medium opacity-80">
                {holdProgress > 0 ? 'Keep holding...' : 'Hold 2s to alert'}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  )
}
