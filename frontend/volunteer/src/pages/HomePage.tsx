// src/pages/HomePage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ShieldCheck, LogOut, Award, MapPin, Clock, CheckCircle2, XCircle, Siren, ShieldAlert, Truck, Radio } from 'lucide-react'
import volunteerApi from '../api/volunteer.api'
import { getErrorMessage } from '../api/client'
import { connectSocket, disconnectSocket } from '../lib/socket'
import { queryClient } from '../lib/queryClient'
import { useAuthStore } from '../store/auth.store'
import { cn, formatTimeAgo } from '../lib/utils'
import type { Dispatch, VolunteerSOSAlertPayload, VolunteerAssignedPayload } from '../types/api.types'

const CATEGORY_LABELS: Record<string, string> = {
  MEDICAL: 'Medical', LOST: 'Lost', TRAPPED: 'Trapped',
  DISASTER: 'Disaster', MISSING: 'Missing', CRIME: 'Crime', OTHER: 'Emergency',
}

export default function HomePage() {
  const navigate = useNavigate()
  const { volunteer, token, logout, updateVolunteer } = useAuthStore()
  const [togglingStatus, setTogglingStatus] = useState(false)

  const { data: dispatches = [] } = useQuery({
    queryKey: ['volunteer', 'dispatches'],
    queryFn: () => volunteerApi.getMyDispatches().then((r) => r.data.data),
    // Safety-net poll — the live socket alert is the primary path, this
    // just covers the rare case a socket event is missed (reconnect gap,
    // tab backgrounded) or arrives a beat before the dispatch row commits.
    refetchInterval: 15_000,
  })

  // A govt operator may have manually assigned this volunteer before the
  // app was even open (e.g. it was closed) — check on mount, not just via
  // the live socket push below, so reopening the app lands on the job too.
  const { data: activeAssignment } = useQuery({
    queryKey: ['volunteer', 'active-assignment'],
    queryFn: () => volunteerApi.getActiveAssignment().then((r) => r.data.data),
  })

  useEffect(() => {
    if (activeAssignment) navigate('/active-job')
  }, [activeAssignment, navigate])

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
      disconnectSocket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const { mutate: updateDispatchStatus, isPending: updatingDispatch } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'RESPONDED' | 'COMPLETED' | 'DECLINED' }) =>
      volunteerApi.updateDispatchStatus(id, status),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ['volunteer', 'dispatches'] })
      if (res.data.data.status === 'RESPONDED' || res.data.data.status === 'COMPLETED') {
        // Re-fetch the authoritative total from the server rather than
        // reconstructing a delta client-side — the points math (which
        // status transitions award what) belongs entirely to
        // volunteer.service.js, not duplicated here.
        const profile = await volunteerApi.getProfile()
        updateVolunteer(profile.data.data)
        toast.success(res.data.data.status === 'RESPONDED' ? "Marked as responding" : 'Marked complete — thank you!')
      }
    },
  })

  const toggleStatus = async () => {
    if (!volunteer) return
    setTogglingStatus(true)
    const nextStatus = volunteer.status === 'AVAILABLE' ? 'OFF_DUTY' : 'AVAILABLE'
    // Both geolocation branches used to call the API with no try/catch —
    // a rejected updateStatus() (network error, 4xx/5xx) was an unhandled
    // promise rejection: no toast, and setTogglingStatus(false) never ran,
    // so the button stayed permanently disabled until a full page reload.
    const applyStatus = async (lat?: number, lng?: number) => {
      try {
        const res = await volunteerApi.updateStatus(nextStatus, lat, lng)
        updateVolunteer(res.data.data)
      } catch (err) {
        toast.error(getErrorMessage(err))
      } finally {
        setTogglingStatus(false)
      }
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => applyStatus(pos.coords.latitude, pos.coords.longitude),
        () => applyStatus(),
        { timeout: 5000 }
      )
    } else {
      applyStatus()
    }
  }

  const handleLogout = () => {
    disconnectSocket()
    logout()
    navigate('/auth')
  }

  if (!volunteer) return null

  const active = dispatches.filter((d) => d.status === 'ALERTED' || d.status === 'RESPONDED')
  const history = dispatches.filter((d) => d.status === 'COMPLETED' || d.status === 'DECLINED')

  return (
    <div className="min-h-screen bg-surface pb-10 font-sans">
      <header className="bg-primary text-primary-foreground px-5 pt-12 pb-6 rounded-b-3xl shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <p className="font-display font-black">Aaraksha Rescuer</p>
          </div>
          <button onClick={handleLogout} aria-label="Log out" className="p-1.5 opacity-90 hover:opacity-100">
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
        <p className="text-sm opacity-80 mb-4">
          {volunteer.full_name.split(' ')[0]} · {volunteer.district}
          {volunteer.rescuer_type === 'OFFICIAL' && volunteer.team_name && (
            <span className="ml-1.5 opacity-90">· {volunteer.team_name}</span>
          )}
        </p>

        <div className="flex items-center justify-between bg-white/10 rounded-2xl px-4 py-3">
          {volunteer.rescuer_type === 'OFFICIAL' ? (
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              <div>
                <p className="text-xs opacity-80 leading-tight">Official rescue team</p>
                <p className="font-display font-black text-sm leading-tight">{volunteer.team_name ?? 'Verified responder'}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              <div>
                <p className="text-xs opacity-80 leading-tight">Reputation points</p>
                <p className="font-display font-black text-lg leading-tight tabular-nums">{volunteer.points}</p>
              </div>
            </div>
          )}
          <button
            onClick={toggleStatus}
            disabled={togglingStatus || !volunteer.is_verified}
            className={cn('h-9 px-4 rounded-full text-xs font-bold transition-colors disabled:opacity-50',
              volunteer.status === 'AVAILABLE' ? 'bg-white text-primary-dark' : 'bg-white/20 text-white')}
          >
            {volunteer.status === 'AVAILABLE' ? 'Available' : 'Off duty'}
          </button>
        </div>
      </header>

      <div className="px-5 mt-5 space-y-5">
        {!volunteer.is_verified && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">Pending verification</p>
              <p className="text-xs text-amber-700 mt-0.5">A district officer needs to verify your government ID before you can be alerted to nearby emergencies.</p>
            </div>
          </div>
        )}

        <section>
          <h2 className="font-display font-black text-on-surface mb-3">Active alerts</h2>
          {active.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant p-6 text-center">
              <Siren className="w-7 h-7 text-on-surface-variant mx-auto mb-2" />
              <p className="text-sm text-on-surface-variant">No nearby SOS right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map((d) => (
                <DispatchCard key={d.id} dispatch={d} busy={updatingDispatch}
                  onRespond={() => updateDispatchStatus({ id: d.id, status: 'RESPONDED' })}
                  onDecline={() => updateDispatchStatus({ id: d.id, status: 'DECLINED' })}
                  onComplete={() => updateDispatchStatus({ id: d.id, status: 'COMPLETED' })} />
              ))}
            </div>
          )}
        </section>

        {history.length > 0 ? (
          <section>
            <h2 className="font-display font-black text-on-surface mb-3">History</h2>
            <div className="space-y-2">
              {history.map((d) => (
                <div key={d.id} className="flex items-center gap-3 bg-surface-container-lowest rounded-xl px-4 py-3 opacity-70">
                  {d.status === 'COMPLETED'
                    ? <CheckCircle2 className="w-4 h-4 text-safe flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-on-surface-variant flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-on-surface truncate">{CATEGORY_LABELS[d.category] || d.category}</p>
                    <p className="text-xs text-on-surface-variant">{formatTimeAgo(d.assigned_at)}</p>
                  </div>
                  {volunteer.rescuer_type !== 'OFFICIAL' && d.points_awarded > 0 && (
                    <span className="text-xs font-bold text-primary">+{d.points_awarded}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section>
            <h2 className="font-display font-black text-on-surface mb-3">How dispatch works</h2>
            <div className="space-y-3">
              {[
                { icon: Radio, text: `Stay "Available" and you'll get an alert the instant an SOS fires nearby` },
                { icon: Siren, text: 'Respond, and a live road route to them opens automatically' },
                volunteer.rescuer_type === 'OFFICIAL'
                  ? { icon: ShieldCheck, text: 'Confirm the Rescue Verification Code with the tourist once you reach them' }
                  : { icon: Award, text: 'Complete the response to earn reputation points' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 bg-surface-container-lowest rounded-2xl px-4 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <p className="text-sm text-on-surface-variant leading-snug">{text}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function DispatchCard({ dispatch, busy, onRespond, onDecline, onComplete }: {
  dispatch: Dispatch; busy: boolean
  onRespond: () => void; onDecline: () => void; onComplete: () => void
}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/60 animate-slide-up">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-sos">
          <Siren className="w-4 h-4" /> {CATEGORY_LABELS[dispatch.category] || dispatch.category}
        </span>
        <span className="flex items-center gap-1 text-xs text-on-surface-variant">
          <Clock className="w-3.5 h-3.5" /> {formatTimeAgo(dispatch.assigned_at)}
        </span>
      </div>
      <a
        href={`https://maps.google.com/?q=${dispatch.sos_latitude},${dispatch.sos_longitude}`}
        target="_blank" rel="noreferrer"
        className="flex items-center gap-1.5 text-xs text-primary font-semibold mb-3"
      >
        <MapPin className="w-3.5 h-3.5" /> Open location in Maps
      </a>

      {dispatch.status === 'ALERTED' ? (
        <div className="flex gap-2">
          <button onClick={onDecline} disabled={busy}
            className="flex-1 h-10 rounded-full border-2 border-outline-variant text-on-surface-variant text-sm font-bold disabled:opacity-50">
            Decline
          </button>
          <button onClick={onRespond} disabled={busy}
            className="flex-1 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">
            I'm responding
          </button>
        </div>
      ) : (
        <button onClick={onComplete} disabled={busy}
          className="w-full h-10 rounded-full bg-safe text-white text-sm font-bold disabled:opacity-50">
          Mark complete
        </button>
      )}
    </div>
  )
}
