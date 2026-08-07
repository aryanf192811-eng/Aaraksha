// src/hooks/useDMS.ts
import { useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import dmsApi from '../api/dms.api'
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
    refetchInterval: 30_000,  // Refresh every 30s
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
      if (seconds <= 0 && timerRef.current) clearInterval(timerRef.current)
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
    onSuccess: () => {
      toast.success('Checked in! DMS reset.')
      queryClient.invalidateQueries({ queryKey: ['dms'] })
      queryClient.invalidateQueries({ queryKey: ['checkins'] })
    },
  })

  return { dms: dmsData, resetDMS: resetDMSMutation, resetting }
}
