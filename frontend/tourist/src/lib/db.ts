// src/lib/db.ts
import Dexie, { type Table } from 'dexie'

// ── Offline SOS Queue ───────────────────────────────────────────────────
export interface OfflineSOSItem {
  id?: number
  category: string
  latitude: number
  longitude: number
  message?: string
  battery: number
  timestamp: number
  // IndexedDB key types exclude booleans — a boolean-valued indexed field
  // is silently dropped from its index, so `.where('synced').equals(0)`
  // would never match a `false`-valued record. Store 0/1 instead.
  synced: 0 | 1
  tripId?: string | null
}

// ── Cached tourist location ─────────────────────────────────────────────
export interface CachedLocation {
  touristId: string
  latitude: number
  longitude: number
  batteryPct?: number
  accuracyM?: number
  updatedAt: number
}

// ── Cached trips (for offline viewing) ─────────────────────────────────
export interface CachedTrip {
  id: string
  data: string          // JSON stringified Trip object
  updatedAt: number
}

class AarakshaDB extends Dexie {
  offlineSOSQueue!: Table<OfflineSOSItem>
  cachedLocations!: Table<CachedLocation>
  cachedTrips!:     Table<CachedTrip>

  constructor() {
    super('aaraksha-tourist')
    this.version(1).stores({
      offlineSOSQueue: '++id, timestamp, synced',
      cachedLocations: 'touristId, updatedAt',
      cachedTrips:     'id, updatedAt',
    })
  }
}

export const db = new AarakshaDB()

// Helper: save current location to IndexedDB (called on every online checkin)
export async function cacheLocation(touristId: string, lat: number, lng: number, battery?: number, accuracy?: number) {
  await db.cachedLocations.put({
    touristId, latitude: lat, longitude: lng,
    batteryPct: battery, accuracyM: accuracy, updatedAt: Date.now(),
  })
}

// Helper: get last cached location
export async function getLastCachedLocation(touristId: string) {
  return db.cachedLocations.get(touristId)
}

// Helper: cache a trip for offline viewing
export async function cacheTripData(trip: unknown) {
  const t = trip as { id: string }
  await db.cachedTrips.put({ id: t.id, data: JSON.stringify(trip), updatedAt: Date.now() })
}

// Helper: get cached trip
export async function getCachedTrip(tripId: string) {
  const record = await db.cachedTrips.get(tripId)
  if (!record) return null
  return JSON.parse(record.data)
}
