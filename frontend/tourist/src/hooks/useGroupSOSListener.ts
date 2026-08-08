// src/hooks/useGroupSOSListener.ts
// Listens for GROUP_SOS_ALERT — a co-traveler on the same group trip sent
// an SOS. Distinct from useSOSStatusListener (that's about the tourist's
// OWN SOS being assigned/resolved) — this is about someone else in their
// travel group needing help, who may be close enough to physically assist.
import { useEffect } from 'react'
import { toast } from 'sonner'
import { connectSocket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'
import { SOCKET_EVENTS } from '../constants/enums'

interface GroupSOSAlertPayload {
  sosId: string
  tripId: string | null
  touristName?: string
  category: string
}

export function useGroupSOSListener() {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) return
    const socket = connectSocket('tourist', token)

    const onGroupSOSAlert = (data: GroupSOSAlertPayload) => {
      toast.error(`${data.touristName ?? 'A group member'} sent an SOS (${data.category})`, {
        description: 'Check the trip for their location if you can help.',
        duration: 15000,
      })
    }

    socket.on(SOCKET_EVENTS.GROUP_SOS_ALERT, onGroupSOSAlert)
    return () => { socket.off(SOCKET_EVENTS.GROUP_SOS_ALERT, onGroupSOSAlert) }
  }, [token])
}
