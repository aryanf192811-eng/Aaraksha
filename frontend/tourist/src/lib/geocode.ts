// src/lib/geocode.ts
// Forward place search — free, keyless Nominatim, same jsonv2 + address-object
// parsing pattern already proven for reverse-geocoding in the govt app's
// checkpoint scanner (frontend/govt/src/pages/CheckpointScanPage.tsx). No
// destination-search API exists anywhere in the tourist app today; every
// "Add Custom Destination" stop is free-text with no coordinates at all.
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'

export interface GeocodeResult {
  label: string
  city: string
  state: string
  lat: number
  lng: number
}

// Returns [] on any failure (network, no results, malformed response) rather
// than throwing — callers fall back to plain free-text entry, matching the
// project's established "degrade gracefully" precedent (osrm.ts#getRoute).
export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const q = query.trim()
  if (q.length < 3) return []

  try {
    const url = `${NOMINATIM_SEARCH}?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=in&addressdetails=1&limit=6`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return []

    const data = await res.json()
    if (!Array.isArray(data)) return []

    return data
      .map((row): GeocodeResult | null => {
        const lat = parseFloat(row.lat)
        const lng = parseFloat(row.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

        const addr = row.address || {}
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.county
          || (typeof row.display_name === 'string' ? row.display_name.split(',')[0].trim() : '')
        const state = addr.state || addr.state_district || ''
        if (!city) return null

        return { label: row.display_name || `${city}, ${state}`, city, state, lat, lng }
      })
      .filter((r): r is GeocodeResult => r !== null)
  } catch {
    return []
  }
}
