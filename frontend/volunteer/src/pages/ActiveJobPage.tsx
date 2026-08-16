// src/pages/ActiveJobPage.tsx — the Rapido "on a ride" screen. Shown whenever
// the volunteer has a live rescue_assignments row (govt manually assigned them,
// official or not — see rescue.repository.js#findActiveAssignmentByVolunteerId).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Siren, Navigation2, LocateFixed, User, Clock, CheckCircle2, MapPinned } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import volunteerApi from '../api/volunteer.api'
import { getRoute, type Route } from '../lib/osrm'
import { cn } from '../lib/utils'

// Fix Leaflet's default marker icon — its bundled asset paths break under
// Vite's bundling, so point at the CDN copies instead (standard workaround,
// same as guardian/src/pages/TrackingPage.tsx).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const CATEGORY_LABELS: Record<string, string> = {
  MEDICAL: 'Medical', LOST: 'Lost', TRAPPED: 'Trapped',
  DISASTER: 'Disaster', MISSING: 'Missing', CRIME: 'Crime', OTHER: 'Emergency',
}

// divIcon marker-badge factory — same pattern as the checkpoint scanner /
// guardian portal, a colored circular badge instead of the default pin.
function badgeIcon(color: string, IconSvg: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:36px;height:36px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid white">${IconSvg}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

const RESCUER_ICON = badgeIcon('#0f766e', '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>')
const SOS_ICON = badgeIcon('#ef4444', '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>')

// Recenter control — direct copy of guardian/src/pages/TrackingPage.tsx's
// RecenterControl, floating button since the map has no default zoom UI.
function RecenterControl({ bounds }: { bounds: [number, number][] }) {
  const map = useMap()
  return (
    <button
      onClick={() => (bounds.length > 1 ? map.fitBounds(bounds, { padding: [48, 48] }) : map.flyTo(bounds[0], 14))}
      title="Recenter" aria-label="Recenter"
      className="absolute bottom-40 right-3 z-[1000] w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
    >
      <LocateFixed className="w-5 h-5 text-on-surface" />
    </button>
  )
}

function formatEta(minutes: number): string {
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const LOCATION_PUSH_INTERVAL_MS = 9000

export default function ActiveJobPage() {
  const navigate = useNavigate()
  const [rescuerPos, setRescuerPos] = useState<[number, number] | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const lastPushRef = useRef(0)
  const watchIdRef = useRef<number | null>(null)

  const { data: assignment, refetch } = useQuery({
    queryKey: ['volunteer', 'active-assignment'],
    queryFn: () => volunteerApi.getActiveAssignment().then((r) => r.data.data),
    refetchInterval: 20_000,
  })

  const sosPos = useMemo<[number, number] | null>(() => {
    if (!assignment) return null
    // pg returns NUMERIC/DECIMAL columns as strings, not numbers — coerce
    // before the finiteness check or Number.isFinite("26.14") is false.
    const lat = Number(assignment.sos_latitude)
    const lng = Number(assignment.sos_longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return [lat, lng]
  }, [assignment])

  // No active assignment (resolved, or none yet) — bounce back to the alert list.
  useEffect(() => {
    if (assignment === null) navigate('/', { replace: true })
  }, [assignment, navigate])

  const { mutate: pushLocation } = useMutation({
    mutationFn: (coords: { lat: number; lng: number }) => volunteerApi.updateLocation(coords.lat, coords.lng),
  })

  // Live position: watchPosition drives the map immediately (every browser
  // tick), but the backend PATCH is throttled to ~9s so we don't spam the
  // 3-room socket fan-out (tourist/guardian/govt) on every GPS jitter.
  useEffect(() => {
    if (!navigator.geolocation) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setRescuerPos(next)
        const now = Date.now()
        if (now - lastPushRef.current >= LOCATION_PUSH_INTERVAL_MS) {
          lastPushRef.current = now
          pushLocation({ lat: next[0], lng: next[1] })
        }
      },
      (err) => console.error('[ActiveJob] geolocation error:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current) }
  }, [pushLocation])

  // Real road route — refetched whenever the rescuer's position moves
  // meaningfully. Falls back to the straight dashed line (route stays null)
  // if OSRM is unreachable, matching every other portal's fallback pattern.
  useEffect(() => {
    if (!rescuerPos || !sosPos) return
    getRoute(rescuerPos[0], rescuerPos[1], sosPos[0], sosPos[1]).then(setRoute)
  }, [rescuerPos?.[0], rescuerPos?.[1], sosPos?.[0], sosPos?.[1]])

  const { mutate: updateStatus, isPending: updatingStatus } = useMutation({
    mutationFn: (status: 'EN_ROUTE' | 'ARRIVED') => volunteerApi.updateAssignmentStatus(status),
    onSuccess: (res) => {
      toast.success(res.data.data.status === 'ARRIVED' ? "Marked as arrived — govt will close this out" : 'On your way — status updated')
      refetch()
    },
  })

  if (!assignment) return null

  const category = CATEGORY_LABELS[assignment.category] || assignment.category
  const bounds: [number, number][] = [sosPos, rescuerPos].filter(Boolean) as [number, number][]
  const center = rescuerPos ?? sosPos ?? [26.15, 91.77]
  const polylinePositions = route?.coordinates ?? (sosPos && rescuerPos ? [rescuerPos, sosPos] : [])

  return (
    <div className="h-[100dvh] w-full relative bg-surface-container-high overflow-hidden">
      {/* ── Live map, full screen ─────────────────────────────── */}
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />

        {sosPos && (
          <>
            <Circle center={sosPos} radius={300} color="#ef4444" fillColor="#ef4444" fillOpacity={0.15} />
            <Marker position={sosPos} icon={SOS_ICON} />
          </>
        )}
        {rescuerPos && <Marker position={rescuerPos} icon={RESCUER_ICON} />}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={route ? { color: '#0f766e', weight: 5, opacity: 0.9 } : { color: '#0f766e', weight: 4, opacity: 0.7, dashArray: '8 8' }}
          />
        )}
        {bounds.length > 0 && <RecenterControl bounds={bounds} />}
      </MapContainer>

      {/* ── Top overlay: job summary ──────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-[1000] px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur rounded-2xl px-4 py-3 shadow-lg">
          <div className="w-9 h-9 rounded-full bg-sos flex items-center justify-center flex-shrink-0">
            <Siren className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-on-surface truncate">{category}{assignment.tourist_name ? ` · ${assignment.tourist_name}` : ''}</p>
            <p className="text-xs text-on-surface-variant flex items-center gap-1">
              <User className="w-3 h-3" /> Assigned to you
              <span className={cn('ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
                assignment.status === 'ARRIVED' ? 'bg-safe/15 text-safe' : 'bg-primary/10 text-primary')}>
                {assignment.status.replace('_', ' ')}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Bottom sheet: distance/ETA + actions ──────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPinned className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-on-surface">
              {route ? `${route.distanceKm.toFixed(1)} km` : 'Calculating route…'}
            </span>
          </div>
          {route && (
            <span className="flex items-center gap-1 text-sm font-bold text-on-surface-variant">
              <Clock className="w-4 h-4" /> ETA {formatEta(route.durationMin)}
            </span>
          )}
        </div>

        {sosPos && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${sosPos[0]},${sosPos[1]}`}
            target="_blank" rel="noreferrer"
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 mb-3 active:scale-[0.98] transition-transform"
          >
            <Navigation2 className="w-4.5 h-4.5" /> Start navigation
          </a>
        )}

        {assignment.status === 'ARRIVED' ? (
          <div className="w-full h-12 rounded-2xl bg-safe/10 text-safe font-bold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5" /> Arrived — awaiting govt close-out
          </div>
        ) : (
          <button
            onClick={() => updateStatus(assignment.status === 'ASSIGNED' ? 'EN_ROUTE' : 'ARRIVED')}
            disabled={updatingStatus}
            className="w-full h-12 rounded-2xl bg-on-surface text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {assignment.status === 'ASSIGNED' ? "I'm on my way" : 'Mark arrived'}
          </button>
        )}
      </div>
    </div>
  )
}
