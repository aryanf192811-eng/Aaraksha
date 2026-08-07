// src/hooks/useSOSStatusListener.ts
// Listens for SOS_STATUS_UPDATED on the tourist's own socket room. Without
// this, a tourist who sends an SOS has no way to find out a rescue team was
// dispatched or that their SOS was resolved — those govt-side actions only
// used to notify the govt dashboard room.
import { useEffect } from 'react'
import { toast } from 'sonner'
import { connectSocket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'
import { useSafetyStore } from '../store/safety.store'
import { queryClient } from '../lib/queryClient'
import { SOCKET_EVENTS } from '../constants/enums'

interface SOSStatusPayload {
  sosId: string
  status: 'ASSIGNED' | 'RESOLVED' | 'FALSE_ALARM'
  teamName?: string
  teamType?: string
}

export function useSOSStatusListener() {
  const token = useAuthStore((s) => s.token)
  const setActiveSOSId = useSafetyStore((s) => s.setActiveSOSId)

  useEffect(() => {
    if (!token) return
    const socket = connectSocket('tourist', token)

    const onStatusUpdate = (data: SOSStatusPayload) => {
      if (data.status === 'ASSIGNED') {
        toast.success(`Rescue team dispatched${data.teamName ? `: ${data.teamName}` : ''}`, { duration: 10000 })
      } else {
        toast.success('Your SOS has been marked resolved', { duration: 8000 })
        setActiveSOSId(null)
      }
      queryClient.invalidateQueries({ queryKey: ['sos', 'mine'] })
    }

    socket.on(SOCKET_EVENTS.SOS_STATUS_UPDATED, onStatusUpdate)
    return () => { socket.off(SOCKET_EVENTS.SOS_STATUS_UPDATED, onStatusUpdate) }
  }, [token, setActiveSOSId])
}
