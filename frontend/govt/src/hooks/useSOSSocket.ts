// src/hooks/useSOSSocket.ts
// Govt dashboard real-time feed. Reuses the shared connectSocket/disconnectSocket
// singleton from lib/socket.ts (role: 'govt') instead of a second ad-hoc socket
// instance, keeping one connection per tab consistent with the other portals.
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { connectSocket, disconnectSocket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'
import { queryClient } from '../lib/queryClient'
import { SOCKET_EVENTS } from '../constants/enums'

interface SOSReceivedPayload {
  sosId: string
  touristId: string
  touristName?: string
  category: string
}

interface DMSTriggeredPayload {
  sosId: string
  touristId: string
  touristName?: string
  category: string
}

export function useSOSSocket() {
  const token = useAuthStore(s => s.token)
  const [activeSosCount, setActiveSosCount] = useState(0)
  const [latestSOS, setLatestSOS] = useState<SOSReceivedPayload | null>(null)
  // Multiple pages mount this hook at once; only the last one to unmount
  // should actually tear down the shared socket connection.
  const mountCount = useRef(0)

  useEffect(() => {
    if (!token) return
    mountCount.current += 1
    const socket = connectSocket('govt', token)

    const onSOSReceived = (data: SOSReceivedPayload) => {
      setLatestSOS(data)
      setActiveSosCount(n => n + 1)
      toast.error(`New SOS: ${data.touristName ?? 'Unknown tourist'} — ${data.category}`, {
        duration: 0,
        action: { label: 'View', onClick: () => { window.location.href = '/sos' } },
      })
      queryClient.invalidateQueries({ queryKey: ['govt', 'sos'] })
      queryClient.invalidateQueries({ queryKey: ['govt', 'dashboard'] })
    }

    const onSOSResolved = () => {
      setActiveSosCount(n => Math.max(0, n - 1))
      toast.success('SOS resolved')
      queryClient.invalidateQueries({ queryKey: ['govt', 'sos'] })
      queryClient.invalidateQueries({ queryKey: ['govt', 'dashboard'] })
      // A resolved SOS's assignment drops out of the Live Map's rescuer list.
      queryClient.invalidateQueries({ queryKey: ['govt', 'active-rescuers'] })
    }

    const onDMSTriggered = (data: DMSTriggeredPayload) => {
      toast.warning(`Dead Man's Switch triggered: ${data.touristName ?? 'Unknown tourist'} stopped checking in`, { duration: 0 })
      queryClient.invalidateQueries({ queryKey: ['govt', 'sos'] })
      queryClient.invalidateQueries({ queryKey: ['govt', 'dashboard'] })
    }

    const onLiveMapUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['govt', 'tourists', 'live'] })
    }

    // Another operator assigned a rescue team or volunteer — reflect it
    // immediately instead of waiting for the next poll tick. A fresh
    // assignment is a new marker on the Live Map too.
    const onRescueAssigned = () => {
      queryClient.invalidateQueries({ queryKey: ['govt', 'sos'] })
      queryClient.invalidateQueries({ queryKey: ['govt', 'dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['govt', 'active-rescuers'] })
    }

    // A rescuer (team or volunteer) pushed a live position or self-reported
    // EN_ROUTE/ARRIVED — refresh the SOS list and the Live Map's rescuer
    // markers so operators see progress without waiting on the next poll
    // (see ActiveJobPage.tsx on the Rescuer app side, which sends these).
    const onRescuerUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['govt', 'sos'] })
      queryClient.invalidateQueries({ queryKey: ['govt', 'active-rescuers'] })
    }

    socket.on(SOCKET_EVENTS.SOS_RECEIVED, onSOSReceived)
    socket.on(SOCKET_EVENTS.SOS_RESOLVED, onSOSResolved)
    socket.on(SOCKET_EVENTS.DMS_TRIGGERED, onDMSTriggered)
    socket.on(SOCKET_EVENTS.LIVE_MAP_UPDATE, onLiveMapUpdate)
    socket.on(SOCKET_EVENTS.RESCUE_ASSIGNED, onRescueAssigned)
    socket.on(SOCKET_EVENTS.RESCUER_LOCATION_UPDATE, onRescuerUpdate)
    socket.on(SOCKET_EVENTS.RESCUER_STATUS_UPDATE, onRescuerUpdate)

    return () => {
      socket.off(SOCKET_EVENTS.SOS_RECEIVED, onSOSReceived)
      socket.off(SOCKET_EVENTS.SOS_RESOLVED, onSOSResolved)
      socket.off(SOCKET_EVENTS.DMS_TRIGGERED, onDMSTriggered)
      socket.off(SOCKET_EVENTS.LIVE_MAP_UPDATE, onLiveMapUpdate)
      socket.off(SOCKET_EVENTS.RESCUE_ASSIGNED, onRescueAssigned)
      socket.off(SOCKET_EVENTS.RESCUER_LOCATION_UPDATE, onRescuerUpdate)
      socket.off(SOCKET_EVENTS.RESCUER_STATUS_UPDATE, onRescuerUpdate)
      mountCount.current -= 1
      if (mountCount.current <= 0) disconnectSocket()
    }
  }, [token])

  return { activeSosCount, latestSOS }
}
