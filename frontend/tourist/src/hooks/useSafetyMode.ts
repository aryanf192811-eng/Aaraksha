// src/hooks/useSafetyMode.ts
// Screen Wake Lock, opt-in and time-boxed. Shake-to-SOS (usePanicGesture.ts)
// only works while this app is the visible foreground page -- the single
// most common way that quietly stops being true isn't the tourist switching
// apps, it's the screen auto-locking after its normal idle timeout while
// the app is still technically "open." Safety Mode holds a Wake Lock for a
// bounded window so a tourist who deliberately wants shake-to-SOS live
// through a specific risky stretch doesn't silently lose it to the OS
// screen timeout.
//
// This does NOT make shake detection work in the background -- the Wake
// Lock spec releases the lock the instant the document is hidden (app
// switch, phone put away screen-first), which is the correct, honest
// behavior. See usePanicGesture.ts's own header comment for why background
// detection isn't achievable in a PWA at all (on either platform).
import { useCallback, useEffect, useRef, useState } from 'react'

export function isSafetyModeSupported() {
  return 'wakeLock' in navigator
}

export function useSafetyMode() {
  const [active, setActive] = useState(false)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const releaseLock = useCallback(() => {
    sentinelRef.current?.release().catch(() => {})
    sentinelRef.current = null
  }, [])

  const deactivate = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    releaseLock()
    setActive(false)
    setExpiresAt(null)
  }, [releaseLock])

  const acquireLock = useCallback(async () => {
    try {
      sentinelRef.current = await navigator.wakeLock.request('screen')
    } catch {
      // Can be refused (low battery, permission policy) -- Safety Mode's
      // countdown still runs either way, it just can't then guarantee the
      // screen itself stays on for the full window.
    }
  }, [])

  const activate = useCallback(async (minutes: number) => {
    const until = Date.now() + minutes * 60_000
    setActive(true)
    setExpiresAt(until)
    await acquireLock()
    timeoutRef.current = setTimeout(deactivate, minutes * 60_000)
  }, [acquireLock, deactivate])

  // The Wake Lock spec auto-releases the instant the document is hidden
  // (tab/app switch, screen off via power button) -- re-acquire on return,
  // but only if Safety Mode's own timer hasn't already run out while away.
  useEffect(() => {
    if (!active) return
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && expiresAt != null && Date.now() < expiresAt) {
        acquireLock()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [active, expiresAt, acquireLock])

  useEffect(() => () => {
    releaseLock()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [releaseLock])

  return { active, expiresAt, activate, deactivate }
}
