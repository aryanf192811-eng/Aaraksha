// src/hooks/usePanicGesture.ts
// Shake-to-SOS backup — for when the phone is in a pocket or bag and the
// screen can't be reached for the 2-second hold. Requires 3 hard shakes
// within 1.5s to arm (so normal walking/bumping can't trip it), then gives
// a 3-second cancellable countdown before actually sending, same as any
// other irreversible action in the app.
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useSOS } from './useSOS'
import { useSafetyStore } from '../store/safety.store'
import { useAuthStore } from '../store/auth.store'

const SHAKE_THRESHOLD = 18       // combined-axis delta per sample
const SHAKES_REQUIRED = 3
const SHAKE_WINDOW_MS = 1500     // all required shakes must land inside this window
const SAMPLE_THROTTLE_MS = 100
const CONFIRM_COUNTDOWN_MS = 3000
const COOLDOWN_MS = 60_000       // don't re-arm immediately after a trigger/cancel

type DeviceMotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

// iOS 13+ requires this to be called from a user gesture (a button tap) —
// cannot be requested automatically on page load. Android/desktop have no
// such API and can just be treated as already-granted.
export async function requestPanicGesturePermission(): Promise<boolean> {
  const DME = window.DeviceMotionEvent as DeviceMotionEventWithPermission | undefined
  if (!DME) return false
  if (typeof DME.requestPermission === 'function') {
    try {
      return (await DME.requestPermission()) === 'granted'
    } catch {
      return false
    }
  }
  return true
}

export function usePanicGesture() {
  const enabled = useSafetyStore((s) => s.panicGestureEnabled)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { sendSOS } = useSOS()
  // sendSOS is a fresh closure every render (useSOS isn't memoized) — track
  // it via ref so the listener effect below only re-subscribes on real
  // enabled/auth changes, not on every render of whatever mounts this hook.
  const sendSOSRef = useRef(sendSOS)
  sendSOSRef.current = sendSOS

  const lastRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const lastSampleAtRef = useRef(0)
  const shakeTimestampsRef = useRef<number[]>([])
  const cooldownUntilRef = useRef(0)
  const armedRef = useRef(false) // true while a countdown toast is pending

  useEffect(() => {
    if (!enabled || !isAuthenticated || !('DeviceMotionEvent' in window)) return

    const onMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return

      const now = Date.now()
      if (now < cooldownUntilRef.current || armedRef.current) return
      if (now - lastSampleAtRef.current < SAMPLE_THROTTLE_MS) return

      const prev = lastRef.current
      lastRef.current = { x: acc.x, y: acc.y, z: acc.z }
      lastSampleAtRef.current = now
      if (!prev) return

      const delta = Math.abs(acc.x - prev.x) + Math.abs(acc.y - prev.y) + Math.abs(acc.z - prev.z)
      if (delta < SHAKE_THRESHOLD) return

      const timestamps = shakeTimestampsRef.current.filter((t) => now - t < SHAKE_WINDOW_MS)
      timestamps.push(now)
      shakeTimestampsRef.current = timestamps

      if (timestamps.length >= SHAKES_REQUIRED) {
        shakeTimestampsRef.current = []
        armedRef.current = true
        cooldownUntilRef.current = now + COOLDOWN_MS

        let cancelled = false
        toast.warning('Panic gesture detected — sending SOS in 3s', {
          duration: CONFIRM_COUNTDOWN_MS,
          action: { label: 'Cancel', onClick: () => { cancelled = true } },
        })

        setTimeout(() => {
          armedRef.current = false
          if (!cancelled) sendSOSRef.current('OTHER', 'Triggered via panic shake gesture')
        }, CONFIRM_COUNTDOWN_MS)
      }
    }

    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [enabled, isAuthenticated])
}
