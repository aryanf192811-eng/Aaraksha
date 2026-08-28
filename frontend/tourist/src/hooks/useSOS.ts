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

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

// navigator.onLine only reflects whether the network interface is up, not
// whether it can actually reach anything — true on a dead Wi-Fi or a
// captive portal. A short-timeout real request is the only way to tell.
async function probeConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false
  try {
    const apiBase = (import.meta.env.VITE_API_URL as string || '').replace(/\/api\/?$/, '')
    await fetch(`${apiBase}/health`, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(2500) })
    return true
  } catch {
    return false
  }
}

export function useSOS() {
  const [sending, setSending] = useState(false)
  const { getPosition } = useGeolocation()
  const { batteryPct } = useBattery()
  const setActiveSOSId = useSafetyStore((s) => s.setActiveSOSId)
  const tourist = useAuthStore((s) => s.tourist)

  const { mutateAsync: triggerSOSApi } = useMutation({
    mutationFn: (data: CreateSOSPayload) => sosApi.createSOS(data),
    onSuccess: (res) => {
      setActiveSOSId(res.data.data.id)
      queryClient.invalidateQueries({ queryKey: ['sos', 'mine'] })
      // ActiveSOSBanner/RescueTrackingCard/the escalation timeline all read
      // from this exact key (sosApi.getActiveRescue) — without invalidating
      // it here, the Safety Center stayed on its idle "Hold to alert" state
      // after a real send until either its own 20s poll happened to fire or
      // the page was manually reloaded. The toast fired; the page didn't.
      queryClient.invalidateQueries({ queryKey: ['sos', 'active-rescue'] })
    },
  })

  // Opens the native SMS compose screen with the structured payload the
  // Twilio inbound webhook parses (see webhook.service.js SOS_PATTERN).
  // This is the actual ceiling of what a web app can do — there is no
  // browser API to transmit an SMS without the user tapping Send, on
  // either Android or iOS. What we control is being honest about that:
  // no "sent" confirmation fires here, only when the tab regains
  // visibility (the closest available proxy for "the user came back from
  // the Messages app").
  const sendOfflineSMS = async (
    category: SOSCategory,
    position: { latitude: number; longitude: number },
    battery: number | null,
    message?: string,
    tripId?: string,
  ) => {
    const body = [
      'AARAKSHA_SOS',
      `ID:${tourist?.id}`,
      `LAT:${position.latitude}`,
      `LNG:${position.longitude}`,
      `CAT:${category}`,
      `BATT:${battery ?? 0}`,
      `TIME:${Math.floor(Date.now() / 1000)}`,
    ].join('|')

    // iOS Safari's sms: scheme needs ';'-separated recipients — a ','
    // silently produces a single malformed "recipient" and the compose
    // screen opens with no one addressed. Android/Chrome accept ','.
    const separator = IS_IOS ? ';' : ','
    const emergencyNumbers = import.meta.env.VITE_EMERGENCY_NUMBERS || ''
    const numbers = [emergencyNumbers, ...(tourist?.emergency_contacts?.map((c) => c.phone) || [])]
      .filter(Boolean)
      .join(separator)

    window.location.href = `sms:${numbers}?body=${encodeURIComponent(body)}`

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

    toast.message('Opening Messages…', {
      description: 'Tap Send in your messages app to complete your offline SOS.',
      duration: Infinity,
      id: 'offline-sos-handoff',
    })
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      toast.success('Back in the app', {
        description: 'If you tapped Send in Messages, your offline SOS is on its way. It will also sync automatically once you\'re back online.',
        duration: 10000,
        id: 'offline-sos-handoff',
      })
      document.removeEventListener('visibilitychange', onVisible)
    }
    document.addEventListener('visibilitychange', onVisible)
  }

  const sendSOS = async (category: SOSCategory, message?: string, tripId?: string) => {
    setSending(true)
    try {
      // Step 1: Get GPS coordinates (satellite — works without internet)
      const position = await getPosition()
      const battery = batteryPct

      if (await probeConnectivity()) {
        // ── ONLINE PATH ──────────────────────────────────────────────
        try {
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
        } catch (err) {
          // The health probe passed but the actual POST still failed —
          // a flaky connection, not truly offline. Don't leave the
          // tourist with nothing but an error: fall back to the same SMS
          // path a genuinely offline device would take.
          await sendOfflineSMS(category, position, battery, message, tripId)
          return null
        }
      } else {
        // ── OFFLINE PATH (2G SMS fallback) ───────────────────────────
        await sendOfflineSMS(category, position, battery, message, tripId)
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
