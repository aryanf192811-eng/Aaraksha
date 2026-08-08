// src/components/shared/RescueTrackingCard.tsx
// Shows up once a tourist's SOS has a rescue team assigned — team identity,
// contact number, distance, and an ETA estimated from the team's registered
// base location (no live GPS tracking exists for rescue teams — there's no
// rescue-team-side app/login to report one — so this is honest
// distance-and-speed math, not a simulated live blip on a map).
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ShieldCheck, Phone, Navigation } from 'lucide-react'
import sosApi from '../../api/sos.api'
import { getSocket } from '../../lib/socket'
import { SOCKET_EVENTS } from '../../constants/enums'

const TEAM_TYPE_LABELS: Record<string, string> = {
  MOUNTAIN: 'Mountain Rescue', SDRF: 'State Disaster Response', POLICE: 'Police',
  MEDICAL: 'Medical Emergency', NDRF: 'National Disaster Response',
}

const markerIcon = (color: string, glyph: string) => L.divIcon({
  className: '',
  html: `<div style="background:${color};border:2px solid white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;color:white;font-weight:900;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${glyph}</div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
})
const TEAM_ICON = markerIcon('#10b981', '&#9679;')
const YOU_ICON  = markerIcon('#ef4444', '!')

function formatEta(minutes: number | null): string {
  if (minutes == null) return '—'
  if (minutes < 60) return `~${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `~${h}h ${m}m`
}

export function RescueTrackingCard() {
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['sos', 'active-rescue'],
    queryFn: () => sosApi.getActiveRescue().then(r => r.data.data),
    refetchInterval: 20_000,
  })

  // Refresh immediately on any status push instead of waiting up to 20s —
  // the moment a team gets assigned is exactly when a tourist is watching.
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onUpdate = () => queryClient.invalidateQueries({ queryKey: ['sos', 'active-rescue'] })
    socket.on(SOCKET_EVENTS.SOS_STATUS_UPDATED, onUpdate)
    return () => { socket.off(SOCKET_EVENTS.SOS_STATUS_UPDATED, onUpdate) }
  }, [queryClient])

  if (!data?.team) return null

  const { team } = data
  const teamPos: [number, number] = [parseFloat(team.latitude), parseFloat(team.longitude)]
  const sosPos: [number, number] = [parseFloat(data.latitude), parseFloat(data.longitude)]
  const bounds: [number, number][] = [teamPos, sosPos]
  // Leaflet throws (and takes the whole page down with it) on a NaN
  // coordinate rather than degrading gracefully — guard explicitly so a
  // malformed record shows a text-only card instead of a crash.
  const hasValidCoords = bounds.every(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))

  return (
    <div className="bg-tsi-low/10 border-2 border-tsi-low/30 rounded-2xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-tsi-low flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-on-surface">{team.name}</p>
            <p className="text-xs text-on-surface-variant">{TEAM_TYPE_LABELS[team.type] || team.type} · {team.status}</p>
          </div>
          <a href={`tel:${team.phone}`}
            className="w-9 h-9 rounded-full bg-tsi-low/20 flex items-center justify-center flex-shrink-0">
            <Phone className="w-4 h-4 text-tsi-low" />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-surface-container-lowest rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-on-surface">{formatEta(team.etaMinutes)}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Estimated arrival</p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-on-surface">{team.distanceKm != null ? `${team.distanceKm} km` : '—'}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Distance</p>
          </div>
        </div>
      </div>

      {hasValidCoords && (
        <div className="h-40 relative">
          <MapContainer bounds={bounds} boundsOptions={{ padding: [24, 24] }} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
            <Polyline positions={bounds} color="#10b981" weight={3} dashArray="6,8" />
            <Marker position={teamPos} icon={TEAM_ICON}>
              <Popup>{team.name} — dispatch base</Popup>
            </Marker>
            <Marker position={sosPos} icon={YOU_ICON}>
              <Popup>Your reported location</Popup>
            </Marker>
          </MapContainer>
          <div className="absolute bottom-2 right-2 bg-surface-container-lowest/95 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow-sm pointer-events-none">
            <Navigation className="w-3 h-3 text-tsi-low" />
            <span className="text-[10px] font-semibold text-on-surface-variant">Dispatched from base</span>
          </div>
        </div>
      )}
    </div>
  )
}
