// src/hooks/useDMS.ts
import { useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import dmsApi, { withSecondsRemaining } from '../api/dms.api'
import { useSafetyStore } from '../store/safety.store'
import { useGeolocation } from './useGeolocation'
import { useBattery } from './useBattery'
import { queryClient } from '../lib/queryClient'

export function useDMS() {
  const { setDMS, setDMSWarning } = useSafetyStore()
  const { getPosition } = useGeolocation()
  const { batteryPct } = useBattery()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: dmsData } = useQuery({
    queryKey: ['dms', 'active'],
    queryFn: () => dmsApi.getActiveDMS().then((r) => r.data.data),
    // Poll fast once close to the deadline — the backend cron that actually
    // fires the auto-SOS runs every 5s, so a flat 30s poll left up to ~90s
    // where the countdown sat at "0:00" with nothing visibly happening,
    // reading as "auto-SOS isn't working" during a demo. Tightened further
    // inside the last 10s specifically for short demo-duration switches
    // (as low as 5s total) — a 5s poll against a 10s countdown left a wide
    // enough window that "I'm Safe" could still render clickable a couple
    // seconds after the switch had already triggered server-side.
    refetchInterval: (query) => {
      const remaining = query.state.data?.seconds_remaining
      if (remaining == null) return 30_000
      if (remaining <= 10) return 2_000
      return remaining <= 90 ? 5_000 : 30_000
    },
  })

  // seconds_remaining is only computed by GET /dms/active — always present
  // when dmsData itself is present, but typed optional since create/reset
  // responses don't include it. Default to 0 defensively.
  const initialSeconds = dmsData?.seconds_remaining ?? 0

  // Countdown timer
  useEffect(() => {
    if (!dmsData) { setDMS(null, null); setDMSWarning(false); return }

    setDMS(dmsData.id, initialSeconds)
    setDMSWarning(initialSeconds <= 600) // 10 min warning

    // Update countdown every second locally
    if (timerRef.current) clearInterval(timerRef.current)
    let seconds = initialSeconds

    timerRef.current = setInterval(() => {
      seconds -= 1
      setDMS(dmsData.id, seconds)
      setDMSWarning(seconds <= 600)
      if (seconds <= 600 && seconds > 595) {
        toast.warning('Check-in required in 10 minutes!', { duration: 10000, id: 'dms-warning' })
      }
      if (seconds <= 0 && timerRef.current) {
        clearInterval(timerRef.current)
        // Don't wait for the next poll tick to find out whether the backend
        // cron (runs once a minute) has actually fired the auto-SOS yet.
        queryClient.invalidateQueries({ queryKey: ['dms', 'active'] })
      }
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmsData?.id, initialSeconds])

  const { mutateAsync: resetDMSMutation, isPending: resetting } = useMutation({
    mutationFn: async (dmsId: string) => {
      const position = await getPosition().catch(() => null)
      return dmsApi.resetDMS(dmsId, {
        latitude:   position?.latitude || null,
        longitude:  position?.longitude || null,
        batteryPct: batteryPct || null,
        message:    'Manual check-in',
      })
    },
    // Writes the response straight into the cache instead of only
    // invalidating — invalidate schedules a background refetch, which is
    // one more network round trip that can lose a race against a stale
    // in-flight poll (useDMS's own refetchInterval fires every 5s once
    // near a deadline). Setting the cache directly makes the UI update the
    // instant the mutation resolves, with no dependency on refetch timing.
    onSuccess: (res) => {
      toast.success('Checked in! DMS reset.')
      queryClient.setQueryData(['dms', 'active'], withSecondsRemaining(res.data.data.dms))
      queryClient.invalidateQueries({ queryKey: ['checkins'] })
    },
    // A real race, mostly with short demo-duration switches: the backend's
    // trigger cron (every 5s) can flip status to TRIGGERED between the
    // button rendering as clickable and this request landing — the server
    // correctly 404s rather than silently reviving an already-fired switch,
    // but without this the button just failed with a generic error and the
    // card kept showing a stale, now-broken "I'm Safe" action. Refetching
    // pulls in the real TRIGGERED state so the card switches to its
    // "auto-SOS already sent" view instead of staying stuck.
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        toast.error("Too late — your Dead Man's Switch already triggered and sent an SOS. Check the Safety Center.", { duration: 8000 })
        queryClient.invalidateQueries({ queryKey: ['dms', 'active'] })
      } else {
        toast.error("Couldn't check in — try again")
      }
    },
  })

  // The backend has always supported this (PATCH /dms/:id/status →
  // PAUSED/RESOLVED) and dms.api.ts already had the client method — there
  // was just never a button in the UI to call it, so a tourist had no way
  // to turn an active switch off short of letting it run out.
  const { mutateAsync: disableDMSMutation, isPending: disabling } = useMutation({
    mutationFn: (dmsId: string) => dmsApi.updateDMSStatus(dmsId, 'RESOLVED'),
    onSuccess: () => {
      toast.success("Dead Man's Switch disabled")
      // See the comment on resetDMSMutation's onSuccess — same reasoning.
      // RESOLVED is filtered out of GET /dms/active's own query, so the
      // correct cached value is unconditionally null, no need to wait on
      // a refetch to learn that.
      queryClient.setQueryData(['dms', 'active'], null)
    },
  })

  return { dms: dmsData, resetDMS: resetDMSMutation, resetting, disableDMS: disableDMSMutation, disabling }
}
