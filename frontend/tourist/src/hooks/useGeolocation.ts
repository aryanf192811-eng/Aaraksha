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
      // Step 1: Try live GPS (satellite-based, works offline)
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,   // Use GPS chip, not network/wifi
          timeout: 30000,             // 30s for satellite fix
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
