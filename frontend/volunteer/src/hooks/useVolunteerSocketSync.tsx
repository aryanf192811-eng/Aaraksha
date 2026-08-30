// src/hooks/useVolunteerSocketSync.ts
// Connects once at the app root and stays connected for the whole
// authenticated session, independent of which route is mounted. Previously
// this lived inside HomePage's own effect, whose cleanup unconditionally
// called disconnectSocket() -- so the moment onAssigned navigated the
// volunteer to /active-job, HomePage unmounted and tore the connection
// down right as the job started, with nothing on ActiveJobPage to
// reconnect it. A live push mid-job (e.g. HANDOFF_VERIFIED, or any future
// govt-initiated update) had no path to reach the volunteer app from then
// on. The only real teardown point is logout (see auth.store.ts / the
// explicit disconnectSocket() calls at each app's log-out action) -- this
// mirrors the same root-level pattern already used by the tourist app's
// AppWithSync.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Truck } from 'lucide-react'
import { connectSocket } from '../lib/socket'
import { queryClient } from '../lib/queryClient'
import { useAuthStore } from '../store/auth.store'
import type { VolunteerSOSAlertPayload, VolunteerAssignedPayload } from '../types/api.types'

const CATEGORY_LABELS: Record<string, string> = {
  MEDICAL: 'Medical', LOST: 'Lost', TRAPPED: 'Trapped',
  DISASTER: 'Disaster', MISSING: 'Missing', CRIME: 'Crime', OTHER: 'Emergency',
}

export function useVolunteerSocketSync() {
  const token = useAuthStore((s) => s.token)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) return
    const socket = connectSocket(token)

    const onAlert = (payload: VolunteerSOSAlertPayload) => {
      toast.warning(`Nearby SOS — ${CATEGORY_LABELS[payload.category] || payload.category} (${payload.distanceKm.toFixed(1)} km)`, {
        description: payload.touristFirstName ? `${payload.touristFirstName} needs help` : undefined,
        duration: 12000,
      })
      queryClient.invalidateQueries({ queryKey: ['volunteer', 'dispatches'] })
    }
    const onAssigned = (payload: VolunteerAssignedPayload) => {
      toast.success(`You've been assigned — ${CATEGORY_LABELS[payload.category] || payload.category}`, {
        description: payload.touristFirstName ? `${payload.touristFirstName} needs help` : undefined,
        icon: <Truck className="w-4 h-4" />,
      })
      queryClient.invalidateQueries({ queryKey: ['volunteer', 'active-assignment'] })
      navigate('/active-job')
    }
    socket.on('VOLUNTEER_SOS_ALERT', onAlert)
    socket.on('VOLUNTEER_ASSIGNED', onAssigned)
    return () => {
      socket.off('VOLUNTEER_SOS_ALERT', onAlert)
      socket.off('VOLUNTEER_ASSIGNED', onAssigned)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
}
