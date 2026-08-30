// src/hooks/useGeolocation.ts
// GPS: uses satellite hardware — works WITHOUT internet
import { useState, useCallback } from 'react'
import { getLastCachedLocation } from '../lib/db'
import { useAuthStore } from '../store/auth.store'

interface GeolocationResult {
  latitude: number
  longitude: number
  accuracy?: number
  isStale: boolean
  timestamp: number
}

export function useGeolocation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tourist = useAuthStore((s) => s.tourist)

  const getPosition = useCallback(async (): Promise<GeolocationResult> => {
    setLoading(true)
    setError(null)

    try {
      // Step 1: Try live GPS (satellite-based, works offline). Timeout was
      // 30s -- for SOS specifically that meant a tourist who'd already
      // completed the hold gesture could then sit blocked for up to half a
      // minute before the app even attempted the cached-location fallback
      // below, let alone sent anything. A slow/cold GPS fix (indoors, urban
      // canyon) is common and exactly the situation where every second
      // matters most. 4s is enough for a warm fix; anything slower falls
      // through to cache immediately instead of making help wait on GPS.
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,   // Use GPS chip, not network/wifi
          timeout: 4000,              // fail fast to the cache fallback below
          maximumAge: 300000,         // Accept fix cached in last 5 minutes
        })
      })
      return {
        latitude:  position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy:  position.coords.accuracy,
        isStale:   false,
        timestamp: Date.now(),
      }
    } catch {
      // Step 2: GPS failed — use IndexedDB cached location
      if (tourist?.id) {
        const cached = await getLastCachedLocation(tourist.id)
        if (cached) {
          return {
            latitude:  cached.latitude,
            longitude: cached.longitude,
            accuracy:  cached.accuracyM || undefined,
            isStale:   true,          // Flag as stale so backend marks it
            timestamp: cached.updatedAt,
          }
        }
      }
      // Step 3: No GPS, no cache — throw
      const msg = 'Could not determine your location. Ensure GPS is enabled.'
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [tourist?.id])

  return { getPosition, loading, error }
}
