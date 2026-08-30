// src/hooks/useSOSSocket.ts
// Govt dashboard real-time feed. Reuses the shared connectSocket/disconnectSocket
// singleton from lib/socket.ts (role: 'govt') instead of a second ad-hoc socket
// instance, keeping one connection per tab consistent with the other portals.
import { useEffect, useState } from 'react'
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

interface AnomalyDetectedPayload {
  anomalyId: string
  touristId: string
  touristName?: string
  type: 'INACTIVITY' | 'ROUTE_DEVIATION'
}

interface IncidentFiledPayload {
  incidentId: string
  caseNumber: string
  touristName?: string
  category: string
  priority: string
}

// GovtLayout (always mounted) and up to 4 individual pages all call this
// hook at once -- every one of them used to run its own `socket.on(...)`,
// so a single SOS_RESOLVED event fired one toast per currently-mounted
// caller (2, sometimes more) instead of one. And because each instance's
// own mount/unmount ref could never see the others, disconnectSocket() ran
// on every single page navigation, killing the connection GovtLayout was
// still relying on. Fixed by moving both the listener registration and the
// activeSosCount/latestSOS state to module scope, shared by every caller,
// with a plain subscriber list instead of React state so every instance
// re-renders when it changes -- the socket listeners themselves are
// registered exactly once no matter how many components call this hook.
let refCount = 0
let activeSosCount = 0
let latestSOS: SOSReceivedPayload | null = null
let unregisterListeners: (() => void) | undefined
const subscribers = new Set<() => void>()

function notify() {
  for (const fn of subscribers) fn()
}

// A govt operator resolving an SOS from this same tab gets an immediate
// toast from that mutation's own onSuccess -- the server's SOS_RESOLVED
// broadcast (which every OTHER operator's tab needs, to learn about a
// resolution someone else just made) echoes back to the acting operator's
// own tab too. Marked in onMutate (before the request goes out), not
// onSuccess, since the socket broadcast can beat the HTTP round-trip.
const recentSelfResolves = new Map<string, number>()
const SELF_RESOLVE_SUPPRESS_MS = 5000

export function markSelfResolved(sosId: string) {
  recentSelfResolves.set(sosId, Date.now())
}

function wasSelfResolved(sosId: string): boolean {
  const at = recentSelfResolves.get(sosId)
  if (at == null) return false
  const fresh = Date.now() - at < SELF_RESOLVE_SUPPRESS_MS
  if (!fresh) recentSelfResolves.delete(sosId)
  return fresh
}

function registerListeners(socket: ReturnType<typeof connectSocket>) {
  const onSOSReceived = (data: SOSReceivedPayload) => {
    latestSOS = data
    activeSosCount += 1
    notify()
    toast.error(`New SOS: ${data.touristName ?? 'Unknown tourist'} — ${data.category}`, {
      duration: 0,
      action: { label: 'View', onClick: () => { window.location.href = '/sos' } },
    })
    queryClient.invalidateQueries({ queryKey: ['govt', 'sos'] })
    queryClient.invalidateQueries({ queryKey: ['govt', 'dashboard'] })
  }

  const onSOSResolved = (data: { sosId: string }) => {
    activeSosCount = Math.max(0, activeSosCount - 1)
    notify()
    if (!wasSelfResolved(data.sosId)) toast.success('SOS resolved')
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

  // A tourist went quiet or drifted off their planned route — see
  // backend anomaly.service.js. Not an emergency confirmation like SOS,
  // so a persistent (but non-blocking) toast rather than duration: 0.
  const onAnomalyDetected = (data: AnomalyDetectedPayload) => {
    const label = data.type === 'INACTIVITY' ? 'gone quiet' : 'off planned route'
    toast.warning(`Anomaly: ${data.touristName ?? 'A tourist'} — ${label}`, {
      action: { label: 'View', onClick: () => { window.location.href = '/map' } },
    })
    queryClient.invalidateQueries({ queryKey: ['govt', 'anomalies'] })
  }

  const onAnomalyResolved = () => {
    queryClient.invalidateQueries({ queryKey: ['govt', 'anomalies'] })
  }

  // A tourist filed a new E-FIR — lands in the officer triage queue.
  const onIncidentFiled = (data: IncidentFiledPayload) => {
    toast.warning(`New E-FIR ${data.caseNumber}: ${data.touristName ?? 'A tourist'} — ${data.category}`, {
      action: { label: 'View', onClick: () => { window.location.href = '/incidents' } },
    })
    queryClient.invalidateQueries({ queryKey: ['govt', 'incidents'] })
  }

  const onIncidentStatusUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['govt', 'incidents'] })
  }

  // A volunteer declined/cancelled — the SOS has already reverted to
  // ACTIVE server-side by the time this fires. Loud and non-dismissing-
  // by-default (duration: 0) since this needs an operator to actually act
  // (reassign), same urgency level as a fresh DMS trigger, not a routine
  // status tick.
  const onAssignmentCancelled = (data: { sosId: string; rescuerName?: string; reason?: string }) => {
    toast.warning(`${data.rescuerName ?? 'A volunteer'} can't continue — reassignment needed`, {
      description: data.reason,
      duration: 0,
      action: { label: 'View', onClick: () => { window.location.href = '/sos' } },
    })
    queryClient.invalidateQueries({ queryKey: ['govt', 'sos'] })
    queryClient.invalidateQueries({ queryKey: ['govt', 'dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['govt', 'active-rescuers'] })
  }

  // The rescuer's code check against the tourist passed -- gates "Mark as
  // Resolved" (see SOSManagementPage.tsx), so an operator watching the
  // queue needs to see this land live, not on the next 30s poll.
  const onHandoffVerified = () => {
    toast.success('Handoff verified — ready to resolve', {
      action: { label: 'View', onClick: () => { window.location.href = '/sos' } },
    })
    queryClient.invalidateQueries({ queryKey: ['govt', 'sos'] })
    queryClient.invalidateQueries({ queryKey: ['govt', 'dashboard'] })
  }

  // Hourly weather-driven TSI recalcs fire per-tourist and can arrive in a
  // burst -- no toast (would flood the operator), just keep the risk
  // overview current instead of waiting on its own poll interval.
  const onTsiBulkUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['govt', 'risk-overview'] })
    queryClient.invalidateQueries({ queryKey: ['govt', 'dashboard'] })
  }

  // A volunteer moved their own dispatch forward (RESPONDED/COMPLETED/
  // DECLINED) on an SOS a team may also be assigned to -- routine, so
  // silent like onRescuerUpdate rather than another toast.
  const onVolunteerAssignmentUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['govt', 'volunteers'] })
    queryClient.invalidateQueries({ queryKey: ['govt', 'sos'] })
  }

  socket.on(SOCKET_EVENTS.SOS_RECEIVED, onSOSReceived)
  socket.on(SOCKET_EVENTS.SOS_RESOLVED, onSOSResolved)
  socket.on(SOCKET_EVENTS.DMS_TRIGGERED, onDMSTriggered)
  socket.on(SOCKET_EVENTS.LIVE_MAP_UPDATE, onLiveMapUpdate)
  socket.on(SOCKET_EVENTS.RESCUE_ASSIGNED, onRescueAssigned)
  socket.on(SOCKET_EVENTS.RESCUER_LOCATION_UPDATE, onRescuerUpdate)
  socket.on(SOCKET_EVENTS.RESCUER_STATUS_UPDATE, onRescuerUpdate)
  socket.on(SOCKET_EVENTS.TOURIST_ANOMALY_DETECTED, onAnomalyDetected)
  socket.on(SOCKET_EVENTS.TOURIST_ANOMALY_RESOLVED, onAnomalyResolved)
  socket.on(SOCKET_EVENTS.INCIDENT_FILED, onIncidentFiled)
  socket.on(SOCKET_EVENTS.INCIDENT_STATUS_UPDATED, onIncidentStatusUpdated)
  socket.on(SOCKET_EVENTS.RESCUER_ASSIGNMENT_CANCELLED, onAssignmentCancelled)
  socket.on(SOCKET_EVENTS.HANDOFF_VERIFIED, onHandoffVerified)
  socket.on(SOCKET_EVENTS.TSI_BULK_UPDATE, onTsiBulkUpdate)
  socket.on(SOCKET_EVENTS.VOLUNTEER_ASSIGNMENT_UPDATED, onVolunteerAssignmentUpdated)

  return () => {
    socket.off(SOCKET_EVENTS.HANDOFF_VERIFIED, onHandoffVerified)
    socket.off(SOCKET_EVENTS.TSI_BULK_UPDATE, onTsiBulkUpdate)
    socket.off(SOCKET_EVENTS.VOLUNTEER_ASSIGNMENT_UPDATED, onVolunteerAssignmentUpdated)
    socket.off(SOCKET_EVENTS.RESCUER_ASSIGNMENT_CANCELLED, onAssignmentCancelled)
    socket.off(SOCKET_EVENTS.SOS_RECEIVED, onSOSReceived)
    socket.off(SOCKET_EVENTS.SOS_RESOLVED, onSOSResolved)
    socket.off(SOCKET_EVENTS.DMS_TRIGGERED, onDMSTriggered)
    socket.off(SOCKET_EVENTS.LIVE_MAP_UPDATE, onLiveMapUpdate)
    socket.off(SOCKET_EVENTS.RESCUE_ASSIGNED, onRescueAssigned)
    socket.off(SOCKET_EVENTS.RESCUER_LOCATION_UPDATE, onRescuerUpdate)
    socket.off(SOCKET_EVENTS.RESCUER_STATUS_UPDATE, onRescuerUpdate)
    socket.off(SOCKET_EVENTS.TOURIST_ANOMALY_DETECTED, onAnomalyDetected)
    socket.off(SOCKET_EVENTS.TOURIST_ANOMALY_RESOLVED, onAnomalyResolved)
    socket.off(SOCKET_EVENTS.INCIDENT_FILED, onIncidentFiled)
    socket.off(SOCKET_EVENTS.INCIDENT_STATUS_UPDATED, onIncidentStatusUpdated)
  }
}

export function useSOSSocket() {
  const token = useAuthStore(s => s.token)
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!token) return
    const rerender = () => forceRender(n => n + 1)
    subscribers.add(rerender)

    if (refCount === 0) {
      const socket = connectSocket('govt', token)
      unregisterListeners = registerListeners(socket)
    }
    refCount += 1

    return () => {
      subscribers.delete(rerender)
      refCount -= 1
      if (refCount <= 0) {
        refCount = 0
        unregisterListeners?.()
        unregisterListeners = undefined
        disconnectSocket()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return { activeSosCount, latestSOS }
}
