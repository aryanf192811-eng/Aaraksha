// src/hooks/useSOSStatusListener.ts
// Listens for SOS_STATUS_UPDATED on the tourist's own socket room. Without
// this, a tourist who sends an SOS has no way to find out a rescue team was
// dispatched or that their SOS was resolved — those govt-side actions only
// used to notify the govt dashboard room.
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { connectSocket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'
import { useSafetyStore } from '../store/safety.store'
import { queryClient } from '../lib/queryClient'
import { SOCKET_EVENTS } from '../constants/enums'
import sosApi from '../api/sos.api'
import { wasSelfAction } from '../lib/selfActionSuppress'

interface SOSStatusPayload {
  sosId: string
  status: 'ASSIGNED' | 'RESOLVED' | 'FALSE_ALARM'
  teamName?: string
  teamType?: string
}

export function useSOSStatusListener() {
  const token = useAuthStore((s) => s.token)
  const setActiveSOSId = useSafetyStore((s) => s.setActiveSOSId)

  // Rehydrate activeSOSId from the server on mount/login — it's pure
  // client-side state (see safety.store.ts) with no persistence, so a
  // fresh login or hard reload while a real SOS is genuinely still open
  // server-side would otherwise leave the SOS button showing its normal
  // (not "active") state until the next status-changing socket event.
  const { data: activeRescue } = useQuery({
    queryKey: ['sos', 'active-rescue'],
    queryFn: () => sosApi.getActiveRescue().then(r => r.data.data),
    enabled: !!token,
    staleTime: 0,
  })
  useEffect(() => {
    if (activeRescue) setActiveSOSId(activeRescue.sosId)
  }, [activeRescue, setActiveSOSId])

  useEffect(() => {
    if (!token) return
    const socket = connectSocket('tourist', token)

    const onStatusUpdate = (data: SOSStatusPayload) => {
      // A status change this same tourist just caused locally (e.g. their
      // own "mark as false alarm") already got its own accurate toast from
      // that mutation's onSuccess — this broadcast still needs to update
      // state/cache for every listener, but showing a second, more generic
      // toast to the person who just did it themselves is a duplicate, not
      // new information.
      const selfCaused = wasSelfAction(data.sosId)
      if (!selfCaused) {
        if (data.status === 'ASSIGNED') {
          toast.success(`Rescue team dispatched${data.teamName ? `: ${data.teamName}` : ''}`, { duration: 10000 })
        } else {
          toast.success('Your SOS has been marked resolved', { duration: 8000 })
        }
      }
      if (data.status !== 'ASSIGNED') setActiveSOSId(null)
      queryClient.invalidateQueries({ queryKey: ['sos', 'mine'] })
    }

    socket.on(SOCKET_EVENTS.SOS_STATUS_UPDATED, onStatusUpdate)
    return () => { socket.off(SOCKET_EVENTS.SOS_STATUS_UPDATED, onStatusUpdate) }
  }, [token, setActiveSOSId])
}
