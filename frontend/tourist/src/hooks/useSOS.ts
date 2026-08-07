// src/hooks/useSOS.ts
// The most critical hook in the Tourist PWA.
// Two paths: ONLINE -> REST API, OFFLINE -> SMS URI + IndexedDB queue
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import sosApi, { type CreateSOSPayload } from '../api/sos.api'
import { useGeolocation } from './useGeolocation'
import { useBattery } from './useBattery'
import { useSafetyStore } from '../store/safety.store'
import { useAuthStore } from '../store/auth.store'
import { db } from '../lib/db'
import { queryClient } from '../lib/queryClient'
import type { SOSCategory } from '../constants/enums'

export function useSOS() {
  const [sending, setSending] = useState(false)
  const { getPosition } = useGeolocation()
  const { batteryPct } = useBattery()
  const setActiveSOSId = useSafetyStore((s) => s.setActiveSOSId)
  const isOnline = useSafetyStore((s) => s.isOnline)
  const tourist = useAuthStore((s) => s.tourist)

  const { mutateAsync: triggerSOSApi } = useMutation({
    mutationFn: (data: CreateSOSPayload) => sosApi.createSOS(data),
    onSuccess: (res) => {
      setActiveSOSId(res.data.data.id)
      queryClient.invalidateQueries({ queryKey: ['sos', 'mine'] })
    },
  })

  const sendSOS = async (category: SOSCategory, message?: string, tripId?: string) => {
    setSending(true)
    try {
      // Step 1: Get GPS coordinates (satellite — works without internet)
      const position = await getPosition()
      const battery = batteryPct

      if (isOnline) {
        // ── ONLINE PATH ──────────────────────────────────────────────
        const payload: CreateSOSPayload = {
          latitude:          position.latitude,
          longitude:         position.longitude,
          locationAccuracyM: position.accuracy || null,
          isStaleLocation:   position.isStale,
          category,
          message:           message || null,
          batteryPct:        battery,
          tripId:            tripId || null,
        }
        const res = await triggerSOSApi(payload)
        toast.success('SOS sent. Emergency contacts notified.', { duration: 6000 })
        return res.data.data
      } else {
        // ── OFFLINE PATH (2G SMS fallback) ───────────────────────────
        const emergencyNumbers = import.meta.env.VITE_EMERGENCY_NUMBERS || ''
        const body = [
          'AARAKSHA_SOS',
          `ID:${tourist?.id}`,
          `LAT:${position.latitude}`,
          `LNG:${position.longitude}`,
          `CAT:${category}`,
          `BATT:${battery ?? 0}`,
          `TIME:${Math.floor(Date.now() / 1000)}`,
        ].join('|')

        // Open native SMS app with pre-filled message
        const numbers = [
          emergencyNumbers,
          ...(tourist?.emergency_contacts?.map((c) => c.phone) || []),
        ].filter(Boolean).join(',')

        window.location.href = `sms:${numbers}?body=${encodeURIComponent(body)}`

        // Queue for Background Sync when connectivity returns
        await db.offlineSOSQueue.add({
          category,
          latitude:  position.latitude,
          longitude: position.longitude,
          message,
          battery:   battery ?? 0,
          timestamp: Date.now(),
          synced:    0,
          tripId,
        })

        toast.warning('Offline SOS sent via SMS. Will sync when connected.', { duration: 8000 })
        return null
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send SOS'
      toast.error(msg)
      throw err
    } finally {
      setSending(false)
    }
  }

  return { sendSOS, sending }
}
