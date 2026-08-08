// src/hooks/useZoneWarnings.ts
// Watches the tourist's live position (while the app is open — there's no
// reliable cross-browser background geolocation without native app
// permissions) against their active trip's stops, and warns once when they
// come near a HIGH_RISK / RESTRICTED / ILP_REQUIRED stop. The zone data
// (zone_type, lat/lng per stop) already existed for trip planning; this is
// the first place it gets used live, not just shown at planning time.
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import tripApi from '../api/trip.api'
import { useAuthStore } from '../store/auth.store'
import type { Stop } from '../types/api.types'

const WARN_ZONE_TYPES = new Set(['HIGH_RISK', 'RESTRICTED', 'ILP_REQUIRED'])
const PROXIMITY_KM = 3

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const ZONE_LABELS: Record<string, string> = {
  HIGH_RISK: 'High-Risk Zone', RESTRICTED: 'Restricted Zone', ILP_REQUIRED: 'ILP Required Zone',
}
const ZONE_ADVICE: Record<string, string> = {
  HIGH_RISK: "Stay alert, follow local advisories, and keep your Dead Man's Switch active.",
  RESTRICTED: 'Register with local authorities on arrival — this zone has entry restrictions.',
  ILP_REQUIRED: 'Inner Line Permit required here — carry your documentation.',
}

export function useZoneWarnings() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const warnedRef = useRef(new Set<string>())

  // The trip LIST endpoint deliberately omits `stops` (it only returns
  // jsonb_array_length(stops) as stop_count, to avoid shipping full
  // itineraries in a paginated list) — so this has to fetch each active
  // trip's own detail to get real stop coordinates and zone_type.
  const { data: activeSummaries } = useQuery({
    queryKey: ['trips', 'active-for-zone-check'],
    queryFn: () => tripApi.getMyTrips({ status: 'ACTIVE' }).then((r) => r.data.data),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })

  const activeTripIds = (activeSummaries ?? []).map((t) => t.id).join(',')

  const { data: stops } = useQuery({
    queryKey: ['trips', 'active-stops-for-zone-check', activeTripIds],
    queryFn: async () => {
      const ids = activeTripIds ? activeTripIds.split(',') : []
      const trips = await Promise.all(ids.map((id) => tripApi.getTripById(id).then((r) => r.data.data)))
      return trips.flatMap((t) => (Array.isArray(t.stops) ? t.stops : []))
    },
    enabled: isAuthenticated && activeTripIds.length > 0,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!isAuthenticated || !stops?.length || !('geolocation' in navigator)) return

    const riskyStops: Stop[] = stops.filter((s) => WARN_ZONE_TYPES.has(s.zone_type) && s.lat != null && s.lng != null)
    if (riskyStops.length === 0) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        for (const stop of riskyStops) {
          const key = `${stop.city}|${stop.zone_type}`
          if (warnedRef.current.has(key)) continue
          if (haversineKm(latitude, longitude, stop.lat!, stop.lng!) <= PROXIMITY_KM) {
            warnedRef.current.add(key)
            toast.warning(`Entering ${ZONE_LABELS[stop.zone_type]}: ${stop.city}`, {
              description: ZONE_ADVICE[stop.zone_type],
              duration: 12_000,
            })
          }
        }
      },
      () => { /* best-effort — a watch failure shouldn't surface as an error to the user */ },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [isAuthenticated, stops])
}
