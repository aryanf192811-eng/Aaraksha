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

// ── Generic key/value store — currently just the auth session, so the
// tourist stays logged in across an app close/reopen (an installed PWA
// otherwise loses sessionStorage the moment it's fully closed, forcing a
// re-login every time). IndexedDB survives that; sessionStorage doesn't.
export interface KeyValueRecord {
  key: string
  value: string
}

class AarakshaDB extends Dexie {
  offlineSOSQueue!: Table<OfflineSOSItem>
  cachedLocations!: Table<CachedLocation>
  cachedTrips!:     Table<CachedTrip>
  keyValueStore!:   Table<KeyValueRecord>

  constructor() {
    super('aaraksha-tourist')
    this.version(1).stores({
      offlineSOSQueue: '++id, timestamp, synced',
      cachedLocations: 'touristId, updatedAt',
      cachedTrips:     'id, updatedAt',
    })
    this.version(2).stores({
      offlineSOSQueue: '++id, timestamp, synced',
      cachedLocations: 'touristId, updatedAt',
      cachedTrips:     'id, updatedAt',
      keyValueStore:   'key',
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

// Zustand's `persist` StateStorage interface — getItem/setItem/removeItem
// may return a value directly or a Promise, so a plain async implementation
// backed by IndexedDB works as a drop-in for whatever storage was used
// before (see auth.store.ts). Used instead of sessionStorage/localStorage
// specifically so login survives a full close-and-reopen of the installed
// PWA, not just a page reload.
export const indexedDBStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const record = await db.keyValueStore.get(name)
    return record?.value ?? null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await db.keyValueStore.put({ key: name, value })
  },
  removeItem: async (name: string): Promise<void> => {
    await db.keyValueStore.delete(name)
  },
}
