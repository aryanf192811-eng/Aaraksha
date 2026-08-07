// src/hooks/useOfflineSync.ts
import { useEffect } from 'react'
import { useSafetyStore } from '../store/safety.store'
import { db } from '../lib/db'
import sosApi from '../api/sos.api'
import { queryClient } from '../lib/queryClient'
import type { SOSCategory } from '../constants/enums'

export function useOfflineSync() {
  const setOnlineStatus = useSafetyStore((s) => s.setOnlineStatus)

  useEffect(() => {
    const handleOnline  = () => { setOnlineStatus(true); syncQueuedSOS() }
    const handleOffline = () => setOnlineStatus(false)

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check initial state
    setOnlineStatus(navigator.onLine)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnlineStatus])
}

// When connectivity returns, sync queued offline SOS events
async function syncQueuedSOS() {
  const queued = await db.offlineSOSQueue.where('synced').equals(0).toArray()
  if (queued.length === 0) return

  for (const item of queued) {
    try {
      await sosApi.createSOS({
        latitude:        item.latitude,
        longitude:       item.longitude,
        category:        item.category as SOSCategory,
        message:         item.message || 'Queued offline SOS',
        batteryPct:      item.battery,
        tripId:          item.tripId || null,
        isStaleLocation: true,
      })
      await db.offlineSOSQueue.update(item.id!, { synced: 1 })
    } catch {
      // Leave unsynced — will retry on the next 'online' event.
    }
  }
  queryClient.invalidateQueries({ queryKey: ['sos'] })
}
