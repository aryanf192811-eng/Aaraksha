// src/lib/osrm.ts
// Real road-following routes — no routing engine exists anywhere in this
// codebase today (every prior Polyline was a straight line between two raw
// points). OSRM's public demo server is free, needs no API key, and
// matches the project's existing precedent of calling free public geo
// APIs directly from the frontend (Nominatim reverse-geocoding in the
// checkpoint scanner). geometries=geojson means the response is already
// [lng,lat] pairs — no polyline-decoding library needed, just flip to
// [lat,lng] for Leaflet.
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

// Throttle knobs for callers driving a live-refetch effect off a fast-ticking
// watchPosition callback — GPS jitter alone shouldn't trigger a fresh public-
// server request on every tick. A caller re-fetches only once ≥8s have
// passed AND the position moved ≥30m since the last successful fetch.
export const ROUTE_REFETCH_MIN_INTERVAL_MS = 8000
export const ROUTE_REFETCH_MIN_DISTANCE_M = 30

// Great-circle distance in meters — good enough at this scale (deciding
// "did the rescuer move far enough to bother re-routing"), not meant for
// anything precision-sensitive.
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface Route {
  coordinates: [number, number][] // [lat, lng] pairs, ready for a Leaflet Polyline
  distanceKm: number
  durationMin: number
}

// Returns null on any failure (network, no route found, malformed
// response) rather than throwing — callers always keep the straight-line
// fallback they already had, so a public-demo-server hiccup degrades the
// map instead of breaking it.
export async function getRoute(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<Route | null> {
  try {
    const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}?geometries=geojson&overview=full`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null

    const data = await res.json()
    const route = data?.routes?.[0]
    if (!route?.geometry?.coordinates?.length) return null

    return {
      coordinates: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]),
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    }
  } catch {
    return null
  }
}
