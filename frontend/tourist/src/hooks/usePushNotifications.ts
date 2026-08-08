// src/hooks/usePushNotifications.ts
// Push notifications reach a tourist even when the app tab is closed or the
// phone is asleep — unlike the Socket.IO listeners elsewhere in this app
// (useSOSStatusListener, useWeatherAlerts, useGroupSOSListener), which only
// fire while a tab is actually open and connected. Registers a dedicated
// service worker at /push/ (see public/push/sw.js) so it doesn't interfere
// with vite-plugin-pwa's own SW at the root scope.
import { useCallback, useState } from 'react'
import pushApi from '../api/push.api'

const PUSH_SW_SCOPE = '/push/'
const PUSH_SW_URL = '/push/sw.js'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function usePushNotifications() {
  const [subscribing, setSubscribing] = useState(false)

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) return false
    setSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return false

      const { data: keyRes } = await pushApi.getVapidPublicKey()
      if (!keyRes.data.publicKey) return false // backend has no VAPID keys configured

      // NOT navigator.serviceWorker.ready — that resolves only once a
      // worker controls the CURRENT PAGE, but this SW's scope (/push/)
      // never does, so `.ready` would hang forever. The registration
      // returned by register() is enough to subscribe on.
      const registration = await navigator.serviceWorker.register(PUSH_SW_URL, { scope: PUSH_SW_SCOPE })

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyRes.data.publicKey) as BufferSource,
        })
      }

      const json = subscription.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false

      await pushApi.subscribe({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } })
      return true
    } catch {
      return false
    } finally {
      setSubscribing(false)
    }
  }, [])

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      const registration = await navigator.serviceWorker.getRegistration(PUSH_SW_SCOPE)
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await pushApi.unsubscribe(subscription.endpoint)
        await subscription.unsubscribe()
      }
    } catch {
      // Best-effort — a failed unsubscribe just means the toggle can be retried
    }
  }, [])

  return { subscribe, unsubscribe, subscribing }
}
