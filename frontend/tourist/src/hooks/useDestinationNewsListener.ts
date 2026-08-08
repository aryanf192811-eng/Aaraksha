// src/hooks/useDestinationNewsListener.ts
// Listens for DESTINATION_NEWS_CRITICAL — a govt-authored alert severe
// enough to interrupt, for a destination on the tourist's active trip.
// INFO/WARNING items are pull-based (visible on the trip's News tab
// whenever checked) and don't push a toast.
import { useEffect } from 'react'
import { toast } from 'sonner'
import { connectSocket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'
import { queryClient } from '../lib/queryClient'
import { SOCKET_EVENTS } from '../constants/enums'

interface DestinationNewsCriticalPayload {
  tripId: string
  destinationName: string
  headline: string
  category: string
}

export function useDestinationNewsListener() {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) return
    const socket = connectSocket('tourist', token)

    const onCriticalNews = (data: DestinationNewsCriticalPayload) => {
      toast.error(`${data.destinationName}: ${data.headline}`, { duration: 15000 })
      queryClient.invalidateQueries({ queryKey: ['trips', data.tripId, 'news'] })
    }

    socket.on(SOCKET_EVENTS.DESTINATION_NEWS_CRITICAL, onCriticalNews)
    return () => { socket.off(SOCKET_EVENTS.DESTINATION_NEWS_CRITICAL, onCriticalNews) }
  }, [token])
}
