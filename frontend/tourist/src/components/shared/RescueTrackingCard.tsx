// src/components/shared/RescueTrackingCard.tsx
// Shows up once a tourist's SOS has a rescuer assigned — official team or
// govt-assigned volunteer, contact number, distance, and an ETA. Official
// teams have no live GPS feed (no rescue-team-side login to report one), so
// their marker sits at their registered base; a volunteer's marker follows
// their real position once they've sent at least one location update, via
// the RESCUER_LOCATION_UPDATE push (see ActiveJobPage.tsx on the Rescuer
// app side) — the road route is real OSRM routing, not a straight line.
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ShieldCheck, Phone, Navigation } from 'lucide-react'
import sosApi from '../../api/sos.api'
import { getSocket } from '../../lib/socket'
import { SOCKET_EVENTS } from '../../constants/enums'
import { getRoute, type Route } from '../../lib/osrm'

const TEAM_TYPE_LABELS: Record<string, string> = {
  MOUNTAIN: 'Mountain Rescue', SDRF: 'State Disaster Response', POLICE: 'Police',
  MEDICAL: 'Medical Emergency', NDRF: 'National Disaster Response',
}

const markerIcon = (color: string, glyph: string) => L.divIcon({
  className: '',
  html: `<div style="background:${color};border:2px solid white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;color:white;font-weight:900;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${glyph}</div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
})
const RESCUER_ICON = markerIcon('#10b981', '&#9679;')
const YOU_ICON      = markerIcon('#ef4444', '!')

function formatEta(minutes: number | null): string {
  if (minutes == null) return '—'
  if (minutes < 60) return `~${minutes} min`
  const totalHours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  if (totalHours < 24) return remMinutes > 0 ? `~${totalHours}h ${remMinutes}m` : `~${totalHours}h`
  const days = Math.floor(totalHours / 24)
  const remHours = totalHours % 24
  return remHours > 0 ? `~${days}d ${remHours}h` : `~${days}d`
}

export function RescueTrackingCard() {
  const queryClient = useQueryClient()
  const [livePos, setLivePos] = useState<[number, number] | null>(null)
  const [route, setRoute] = useState<Route | null>(null)

  const { data } = useQuery({
    queryKey: ['sos', 'active-rescue'],
    queryFn: () => sosApi.getActiveRescue().then(r => r.data.data),
    refetchInterval: 20_000,
  })

  // Refresh immediately on any status push instead of waiting up to 20s —
  // the moment a rescuer gets assigned is exactly when a tourist is
  // watching. RESCUER_LOCATION_UPDATE additionally drives the marker
  // between polls without waiting on a full refetch.
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onUpdate = () => queryClient.invalidateQueries({ queryKey: ['sos', 'active-rescue'] })
    const onLocation = (payload: { latitude: number; longitude: number }) => {
      setLivePos([payload.latitude, payload.longitude])
    }
    socket.on(SOCKET_EVENTS.SOS_STATUS_UPDATED, onUpdate)
    socket.on(SOCKET_EVENTS.RESCUER_STATUS_UPDATE, onUpdate)
    socket.on(SOCKET_EVENTS.RESCUER_LOCATION_UPDATE, onLocation)
    return () => {
      socket.off(SOCKET_EVENTS.SOS_STATUS_UPDATED, onUpdate)
      socket.off(SOCKET_EVENTS.RESCUER_STATUS_UPDATE, onUpdate)
      socket.off(SOCKET_EVENTS.RESCUER_LOCATION_UPDATE, onLocation)
    }
  }, [queryClient])

  const rescuer = data?.rescuer
  const rescuerPos: [number, number] | null = rescuer
    ? (livePos ?? [parseFloat(rescuer.latitude), parseFloat(rescuer.longitude)])
    : null
  const sosPos: [number, number] | null = data
    ? [parseFloat(data.latitude), parseFloat(data.longitude)]
    : null
  const bounds: [number, number][] = [rescuerPos, sosPos].filter(Boolean) as [number, number][]
  // Leaflet throws (and takes the whole page down with it) on a NaN
  // coordinate rather than degrading gracefully — guard explicitly so a
  // malformed record shows a text-only card instead of a crash.
  const hasValidCoords = rescuerPos && sosPos
    && [...rescuerPos, ...sosPos].every((n) => Number.isFinite(n))

  // Real road route, refetched whenever the rescuer's position changes.
  // Falls back to the straight dashed line (route stays null) if OSRM is
  // unreachable — the map degrades instead of breaking.
  useEffect(() => {
    if (!hasValidCoords || !rescuerPos || !sosPos) return
    getRoute(rescuerPos[0], rescuerPos[1], sosPos[0], sosPos[1]).then(setRoute)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescuerPos?.[0], rescuerPos?.[1], sosPos?.[0], sosPos?.[1], hasValidCoords])

  if (!rescuer || !sosPos) return null

  const routeDistanceKm = route?.distanceKm ?? rescuer.distanceKm
  const routeEtaMinutes = route ? Math.round(route.durationMin) : rescuer.etaMinutes

  return (
    <div className="bg-tsi-low/10 border-2 border-tsi-low/30 rounded-2xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-tsi-low flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-on-surface">{rescuer.name}</p>
            <p className="text-xs text-on-surface-variant">
              {rescuer.kind === 'TEAM' ? (TEAM_TYPE_LABELS[rescuer.type] || rescuer.type) : 'Local Volunteer'} · {rescuer.status}
              {rescuer.isLive && ' · Live'}
            </p>
          </div>
          <a href={`tel:${rescuer.phone}`}
            className="w-9 h-9 rounded-full bg-tsi-low/20 flex items-center justify-center flex-shrink-0">
            <Phone className="w-4 h-4 text-tsi-low" />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-surface-container-lowest rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-on-surface">{formatEta(routeEtaMinutes)}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Estimated arrival</p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-on-surface">{routeDistanceKm != null ? `${routeDistanceKm.toFixed(1)} km` : '—'}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Distance</p>
          </div>
        </div>
      </div>

      {hasValidCoords && rescuerPos && (
        <div className="h-40 relative">
          <MapContainer bounds={bounds} boundsOptions={{ padding: [24, 24] }} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
            <Polyline
              positions={route?.coordinates ?? bounds}
              pathOptions={route ? { color: '#10b981', weight: 3 } : { color: '#10b981', weight: 3, dashArray: '6,8' }}
            />
            <Marker position={rescuerPos} icon={RESCUER_ICON}>
              <Popup>{rescuer.name} — {rescuer.isLive ? 'live position' : 'dispatch base'}</Popup>
            </Marker>
            <Marker position={sosPos} icon={YOU_ICON}>
              <Popup>Your reported location</Popup>
            </Marker>
          </MapContainer>
          <div className="absolute bottom-2 right-2 bg-surface-container-lowest/95 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow-sm pointer-events-none">
            <Navigation className="w-3 h-3 text-tsi-low" />
            <span className="text-[10px] font-semibold text-on-surface-variant">{rescuer.isLive ? 'Live location' : 'Dispatched from base'}</span>
          </div>
        </div>
      )}
    </div>
  )
}
