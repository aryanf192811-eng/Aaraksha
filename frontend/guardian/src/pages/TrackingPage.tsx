// src/pages/TrackingPage.tsx — Guardian Portal's only screen.
// Shows: status banner (safe/warning/SOS) -> map -> last checkin time -> TSI -> medical info
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Shield, MapPin, Battery, Clock, RefreshCw, CheckCircle2, Siren, WifiOff, Stethoscope, Link2Off, LocateFixed, Truck } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import touristApi from '../api/tourist.api'
import { connectSocket, disconnectSocket } from '../lib/socket'
import { getErrorMessage } from '../api/client'
import type { GuardianView } from '../types/api.types'

// Fix Leaflet's default marker icon — its bundled asset paths break under
// Vite's bundling, so point at the CDN copies instead (standard workaround).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

type StatusType = 'SAFE' | 'SOS' | 'ASSIGNED' | 'WARNING' | 'NO_SIGNAL'

const STATUS_CONFIG: Record<StatusType, {
  banner: string; Icon: typeof CheckCircle2; headline: (name: string) => string; sub: string; dotColor: string
}> = {
  SAFE: {
    banner:   'bg-green-50 border-b-4 border-green-500',
    Icon:     CheckCircle2,
    headline: (n) => `${n} is safe`,
    sub:      'Last check-in received',
    dotColor: 'bg-green-500',
  },
  SOS: {
    banner:   'bg-red-500 text-white',
    Icon:     Siren,
    headline: (n) => `${n} needs help!`,
    sub:      'Emergency services have been notified',
    dotColor: 'bg-surface-container-lowest animate-pulse',
  },
  // Distinct from SOS on purpose — once a rescue team is actually dispatched
  // this is no longer "we don't know what's happening," it's "help is
  // confirmed and on the way," and the color should say that at a glance.
  ASSIGNED: {
    banner:   'bg-amber-500 text-white',
    Icon:     Truck,
    headline: (n) => `Help is on the way to ${n}`,
    sub:      'A rescue team has been dispatched',
    dotColor: 'bg-surface-container-lowest animate-pulse',
  },
  WARNING: {
    banner:   'bg-amber-50 border-b-4 border-amber-500',
    Icon:     Clock,
    headline: (n) => `${n}'s check-in is due`,
    sub:      'Waiting for next check-in',
    dotColor: 'bg-primary',
  },
  NO_SIGNAL: {
    banner:   'bg-surface-container-high border-b-4 border-outline-variant',
    Icon:     WifiOff,
    headline: (n) => `No signal from ${n}`,
    sub:      'Last location shown below',
    dotColor: 'bg-outline',
  },
}

// Recenter control — the map has no default zoom controls (zoomControl is
// off for this single-purpose view), so this is the only way to return to
// the tourist's location after panning around to look at the area.
function RecenterControl({ center }: { center: [number, number] }) {
  const map = useMap()
  return (
    <button onClick={() => map.flyTo(center, 14)} title="Recenter on traveler" aria-label="Recenter on traveler"
      className="absolute bottom-14 right-3 z-[1000] w-10 h-10 rounded-full bg-surface-container-lowest shadow-md flex items-center justify-center hover:bg-surface-container active:scale-95 transition-all">
      <LocateFixed className="w-5 h-5 text-on-surface" />
    </button>
  )
}

function getStatus(view: GuardianView | null): StatusType {
  if (!view) return 'NO_SIGNAL'
  if (view.activeSOS) return view.activeSOS.status === 'ASSIGNED' ? 'ASSIGNED' : 'SOS'
  if (!view.location) return 'NO_SIGNAL'
  const lastSeen = new Date(view.location.updatedAt).getTime()
  const ageMin = (Date.now() - lastSeen) / 60000
  if (ageMin > 240) return 'NO_SIGNAL'  // 4 hours no signal
  if (ageMin > 120) return 'WARNING'    // 2 hours warning
  return 'SAFE'
}

export default function TrackingPage() {
  const { token } = useParams<{ token: string }>()
  const [view, setView] = useState<GuardianView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchTracking = async () => {
    if (!token) return
    try {
      const res = await touristApi.getGuardianView(token)
      setView(res.data.data)
      setLastRefresh(new Date())
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchTracking()
    const interval = setInterval(fetchTracking, 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Socket.IO: real-time updates via the shared singleton (guardian-scoped
  // auth). GUARDIAN_SOS_ALERT and GUARDIAN_ETA_UPDATE are both wired
  // server-side (see sos.service.js / dms.service.js and govt.service.js's
  // assignRescue), so this is a live push, not just the 30s poll fallback.
  useEffect(() => {
    if (!token) return
    const socket = connectSocket('guardian', token)
    socket.on('GUARDIAN_LOCATION_UPDATE', (data) => {
      setView(prev => prev ? { ...prev, location: { latitude: data.latitude, longitude: data.longitude, batteryPct: data.batteryPct, updatedAt: data.updatedAt } } : prev)
      setLastRefresh(new Date())
    })
    socket.on('GUARDIAN_SOS_ALERT', (data) => {
      setView(prev => prev ? { ...prev, activeSOS: { id: data.sosId, category: data.category, status: 'ACTIVE', createdAt: data.createdAt, rescueTeam: null } } : prev)
    })
    socket.on('GUARDIAN_ETA_UPDATE', (data) => {
      setView(prev => (prev && prev.activeSOS) ? {
        ...prev,
        activeSOS: {
          ...prev.activeSOS,
          status: data.status,
          rescueTeam: { name: data.teamName, type: data.teamType, etaMinutes: data.etaMinutes },
        },
      } : prev)
    })
    return () => { disconnectSocket() }
  }, [token])

  const status = getStatus(view)
  const statusConfig = STATUS_CONFIG[status]
  const StatusIcon = statusConfig.Icon
  const name = view?.firstName || 'Traveler'
  // SOS and ASSIGNED share the "urgent, white-on-color" banner treatment —
  // the color itself (red vs amber) is what tells them apart.
  const isUrgent = status === 'SOS' || status === 'ASSIGNED'
  const isSOSActive = status === 'SOS'
  const isAssigned = status === 'ASSIGNED'

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-container-lowest">
        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mb-4 animate-pulse">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <p className="text-on-surface-variant font-medium">Loading tracking data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-container-lowest px-6 text-center">
        <Link2Off className="w-12 h-12 text-slate-300 mb-4" />
        <h1 className="text-xl font-black text-on-surface mb-2">{error}</h1>
        <p className="text-sm text-on-surface-variant">Ask the traveler to share a new tracking link.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      {/* ── Brand header ──────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border-b border-outline-variant px-5 py-4 flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <span className="font-black text-on-surface">Aaraksha</span>
        <span className="text-xs text-on-surface-variant ml-auto">Guardian Portal</span>
      </div>

      {/* ── Status Banner ─────────────────────────────────────── */}
      <div className={`${statusConfig.banner} ${isUrgent ? 'min-h-[180px]' : 'min-h-[100px]'} px-6 py-6 flex flex-col justify-center`}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${statusConfig.dotColor}`} />
          <span className={`text-xs font-bold uppercase tracking-widest ${isUrgent ? 'text-white/80' : 'text-on-surface-variant'}`}>
            {status.replace('_', ' ')}
          </span>
        </div>
        <h1 className={`flex items-center gap-2.5 text-3xl font-black leading-tight ${isUrgent ? 'text-white' : 'text-on-surface'}`}>
          <StatusIcon className="w-7 h-7 flex-shrink-0" />
          {statusConfig.headline(name)}
        </h1>
        <p className={`text-sm mt-1 ${isUrgent ? 'text-white/80' : 'text-on-surface-variant'}`}>
          {statusConfig.sub}
        </p>
        {isSOSActive && view?.activeSOS && (
          <div className="mt-3 bg-red-600 rounded-xl px-4 py-2">
            <p className="text-white text-sm font-bold">Category: {view.activeSOS.category}</p>
            <p className="text-red-100 text-xs">Triggered at {new Date(view.activeSOS.createdAt).toLocaleTimeString('en-IN')}</p>
          </div>
        )}
        {isAssigned && view?.activeSOS && (
          <div className="mt-3 bg-amber-600 rounded-xl px-4 py-2">
            <p className="text-white text-sm font-bold flex items-center gap-1.5">
              <Truck className="w-4 h-4 flex-shrink-0" />
              {view.activeSOS.rescueTeam?.name ?? 'Rescue team'} dispatched
            </p>
            <p className="text-amber-100 text-xs">
              {view.activeSOS.rescueTeam?.type ? `${view.activeSOS.rescueTeam.type} · ` : ''}
              {view.activeSOS.rescueTeam?.etaMinutes != null ? `ETA ~${view.activeSOS.rescueTeam.etaMinutes} min` : 'On the way'}
            </p>
          </div>
        )}
      </div>

      {/* ── Live Map ──────────────────────────────────────────── */}
      {view?.location ? (
        <div className="h-[40vh] relative">
          <MapContainer
            center={[view.location.latitude, view.location.longitude]}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
            />
            {/* Urgent pulse ring — red while unassigned, amber once a team is dispatched */}
            {isUrgent && (
              <Circle
                center={[view.location.latitude, view.location.longitude]}
                radius={500}
                color={isAssigned ? '#f59e0b' : '#ef4444'} fillColor={isAssigned ? '#f59e0b' : '#ef4444'} fillOpacity={0.15}
              />
            )}
            <Marker position={[view.location.latitude, view.location.longitude]}>
              <Popup>
                <div className="text-center">
                  <p className="font-bold">{name}</p>
                  <p className="text-xs text-on-surface-variant">
                    Last seen {new Date(view.location.updatedAt).toLocaleTimeString('en-IN')}
                  </p>
                </div>
              </Popup>
            </Marker>
            <RecenterControl center={[view.location.latitude, view.location.longitude]} />
          </MapContainer>
          {/* Map overlay: Google Maps link */}
          <a
            href={`https://maps.google.com/?q=${view.location.latitude},${view.location.longitude}`}
            target="_blank" rel="noopener noreferrer"
            className="absolute bottom-3 right-3 bg-surface-container-lowest rounded-lg shadow-md px-3 py-1.5 text-xs font-semibold text-on-surface flex items-center gap-1"
          >
            <MapPin className="w-3 h-3 text-red-500" /> Open in Maps
          </a>
        </div>
      ) : (
        <div className="h-[200px] bg-surface-container-high flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-8 h-8 text-on-surface-variant mx-auto mb-2" />
            <p className="text-sm text-on-surface-variant">Location not available</p>
          </div>
        </div>
      )}

      {/* ── Info Cards ────────────────────────────────────────── */}
      <div className="px-5 py-5 space-y-4">
        {/* Status info grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: <Clock className="w-5 h-5 text-amber-500" />,
              label: 'Last Seen',
              value: view?.location?.updatedAt
                ? new Date(view.location.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                : 'Unknown',
            },
            {
              icon: <Battery className={`w-5 h-5 ${(view?.location?.batteryPct ?? 100) < 20 ? 'text-red-500' : 'text-green-500'}`} />,
              label: 'Battery',
              value: view?.location?.batteryPct !== null && view?.location?.batteryPct !== undefined
                ? `${view.location.batteryPct}%` : '—',
            },
            {
              icon: <MapPin className="w-5 h-5 text-blue-500" />,
              label: 'Destination',
              value: view?.activeTripCity || '—',
            },
          ].map(({ icon, label, value }) => (
            <div key={label} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm text-center border border-outline-variant">
              <div className="flex justify-center mb-1">{icon}</div>
              <p className="text-xs text-on-surface-variant font-medium">{label}</p>
              <p className="font-bold text-on-surface text-sm mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* TSI score if available */}
        {view?.tsiScore !== null && view?.tsiScore !== undefined && (
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant flex items-center gap-4">
            <div>
              <p className="text-xs text-on-surface-variant font-medium mb-1">Travel Safety Index</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-on-surface">{view.tsiScore}/100</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  view.tsiScore >= 80 ? 'bg-green-100 text-green-700' :
                  view.tsiScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  view.tsiScore >= 40 ? 'bg-orange-100 text-orange-700' :
                                         'bg-red-100 text-red-700'
                }`}>{view.tsiLabel}</span>
              </div>
            </div>
          </div>
        )}

        {/* Medical info (if blood group available) */}
        {(view?.bloodGroup || view?.medicalInfo) && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
            <p className="flex items-center gap-1.5 text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
              <Stethoscope className="w-3.5 h-3.5" /> Medical Info
            </p>
            {view?.bloodGroup && <p className="text-sm text-on-surface">Blood Group: <strong>{view.bloodGroup}</strong></p>}
            {view?.medicalInfo && <p className="text-sm text-on-surface-variant mt-1">{view.medicalInfo}</p>}
          </div>
        )}

        {/* Refresh indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          <RefreshCw className="w-3.5 h-3.5 text-on-surface-variant" />
          <p className="text-xs text-on-surface-variant">
            Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Auto-refreshes every 30s
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-10 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm text-on-surface-variant">Aaraksha · Smart Tourism · Safe Journey</span>
        </div>
      </div>
    </div>
  )
}
