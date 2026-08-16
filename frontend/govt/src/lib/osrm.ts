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
