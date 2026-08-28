// src/components/shared/RescueTrackingCard.tsx
// Shows up once a tourist's SOS has a rescuer assigned — official team or
// govt-assigned volunteer, contact number, distance, and an ETA. Official
// teams have no live GPS feed (no rescue-team-side login to report one), so
// their marker sits at their registered base; a volunteer's marker follows
// their real position once they've sent at least one location update, via
// the RESCUER_LOCATION_UPDATE push (see ActiveJobPage.tsx on the Rescuer
// app side) — the road route is real OSRM routing, not a straight line.
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
// MapLibre GL over free vector tiles (OpenFreeMap, no API key) instead of
// Leaflet + raster OSM — real road labels/rendering at a premium level
// Leaflet's raster tiles can't match, same rendering engine already proven
// in the govt app's TerrainMap.tsx, no billed key required.
import { Map as MapLibreMap, Marker as MapLibreMarker, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, LineString } from 'geojson'
import { ShieldCheck, Phone, Navigation, LocateFixed, UserCheck, Navigation2, Flag, Check } from 'lucide-react'
import sosApi from '../../api/sos.api'
import { getSocket } from '../../lib/socket'
import { SOCKET_EVENTS } from '../../constants/enums'
import { getRoute, type Route } from '../../lib/osrm'
import { cn } from '../../lib/utils'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

const TEAM_TYPE_LABELS: Record<string, string> = {
  MOUNTAIN: 'Mountain Rescue', SDRF: 'State Disaster Response', POLICE: 'Police',
  MEDICAL: 'Medical Emergency', NDRF: 'National Disaster Response',
}

// The real assignment lifecycle (rescue_assignments.status, see
// sos.service.js#getActiveRescueInfo) — three stages, not a decorative
// step count borrowed from a reference screenshot. Rendered as a proper
// node-and-connecting-line progress indicator (Uber/Rapido-style trip
// status), not flat color bars — each node carries a real icon.
const STATUS_STEPS = [
  { key: 'ASSIGNED', label: 'Assigned', Icon: UserCheck },
  { key: 'EN_ROUTE', label: 'En Route', Icon: Navigation2 },
  { key: 'ARRIVED', label: 'Arrived', Icon: Flag },
] as const

function markerEl(color: string, glyph: string) {
  const el = document.createElement('div')
  el.style.cssText = `background:${color};border:2px solid white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;color:white;font-weight:900;box-shadow:0 2px 6px rgba(0,0,0,0.3)`
  el.textContent = glyph
  return el
}

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
  const [follow, setFollow] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const rescuerMarkerRef = useRef<MapLibreMarker | null>(null)
  const sosMarkerRef = useRef<MapLibreMarker | null>(null)

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
  // MapLibre throws (and takes the whole page down with it) on a NaN
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

  // Map instance: created once the preview box mounts (hasValidCoords flips
  // true), non-interactive (drag/scroll/zoom off) — this is a static "here's
  // where things stand" preview, not a pannable map, matching the old
  // Leaflet MapContainer's dragging={false} scrollWheelZoom={false}.
  useEffect(() => {
    if (!hasValidCoords || !rescuerPos || !mapContainerRef.current || mapRef.current) return
    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [rescuerPos[1], rescuerPos[0]],
      zoom: 14,
      interactive: false,
      attributionControl: false,
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      rescuerMarkerRef.current = null
      sosMarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasValidCoords])

  // Markers + route line: updated in place on every position/route change
  // rather than recreated, so the marker doesn't flicker on each GPS tick.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !hasValidCoords || !rescuerPos || !sosPos) return

    const apply = () => {
      const rescuerLngLat: [number, number] = [rescuerPos[1], rescuerPos[0]]
      const sosLngLat: [number, number] = [sosPos[1], sosPos[0]]

      if (!rescuerMarkerRef.current) {
        rescuerMarkerRef.current = new MapLibreMarker({ element: markerEl('#10b981', '●') }).setLngLat(rescuerLngLat).addTo(map)
      } else {
        rescuerMarkerRef.current.setLngLat(rescuerLngLat)
      }
      if (!sosMarkerRef.current) {
        sosMarkerRef.current = new MapLibreMarker({ element: markerEl('#ef4444', '!') }).setLngLat(sosLngLat).addTo(map)
      }

      const lineCoords = (route?.coordinates ?? [rescuerPos, sosPos]).map(([lat, lng]) => [lng, lat])
      const geojson: Feature<LineString> = {
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: lineCoords },
      }
      const existingSource = map.getSource('rescue-route') as GeoJSONSource | undefined
      if (existingSource) {
        existingSource.setData(geojson)
      } else {
        map.addSource('rescue-route', { type: 'geojson', data: geojson })
        map.addLayer({
          id: 'rescue-route', type: 'line', source: 'rescue-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#10b981', 'line-width': 3, 'line-dasharray': route ? [1, 0] : [1, 1.5] },
        })
      }
      if (map.getLayer('rescue-route')) {
        map.setPaintProperty('rescue-route', 'line-dasharray', route ? [1, 0] : [1, 1.5])
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [rescuerPos?.[0], rescuerPos?.[1], sosPos?.[0], sosPos?.[1], route, hasValidCoords])

  // Follow toggle: center-lock on the rescuer, or fit both points in frame.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !rescuerPos) return
    if (follow) {
      map.easeTo({ center: [rescuerPos[1], rescuerPos[0]], zoom: Math.max(map.getZoom(), 15), duration: 600 })
    } else if (sosPos) {
      map.fitBounds(
        [[Math.min(rescuerPos[1], sosPos[1]), Math.min(rescuerPos[0], sosPos[0])],
         [Math.max(rescuerPos[1], sosPos[1]), Math.max(rescuerPos[0], sosPos[0])]],
        { padding: 40, duration: 600 }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, rescuerPos?.[0], rescuerPos?.[1], sosPos?.[0], sosPos?.[1]])

  if (!rescuer || !sosPos) return null

  const routeDistanceKm = route?.distanceKm ?? rescuer.distanceKm
  const routeEtaMinutes = route ? Math.round(route.durationMin) : rescuer.etaMinutes
  const currentStepIndex = Math.max(0, STATUS_STEPS.findIndex((s) => s.key === rescuer.status))

  return (
    <div className="bg-tsi-low/10 border-2 border-tsi-low/30 rounded-2xl overflow-hidden">
      <div className="p-4">
        {/* Assignment progress — real 3-stage lifecycle, not a decorative
            step count. Node + connecting-line indicator, same layout
            algorithm as SafetyTimeline so the two read as one design
            language, with a real icon per stage. */}
        <div className="flex items-center mb-3">
          {STATUS_STEPS.map((step, i) => {
            const isDone = i < currentStepIndex
            const isCurrent = i === currentStepIndex
            const StepIcon = step.Icon
            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className={cn('relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    isDone ? 'bg-tsi-low text-white'
                      : isCurrent ? 'bg-tsi-low/15 text-tsi-low ring-2 ring-tsi-low'
                        : 'bg-surface-container-high text-on-surface-variant/50')}>
                    {isCurrent && <span className="absolute inset-0 rounded-full bg-tsi-low/30 animate-ping" />}
                    {isDone ? <Check className="w-4 h-4 relative" strokeWidth={3} /> : <StepIcon className="w-3.5 h-3.5 relative" />}
                  </div>
                  <span className={cn('text-[9px] font-bold uppercase tracking-wide text-center leading-tight w-14',
                    i <= currentStepIndex ? 'text-tsi-low' : 'text-on-surface-variant/50')}>
                    {step.label}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={cn('h-0.5 flex-1 mx-1 -mt-4', i < currentStepIndex ? 'bg-tsi-low' : 'bg-outline-variant')} />
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-tsi-low flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-on-surface">{rescuer.name}</p>
            <p className="text-xs text-on-surface-variant">
              {rescuer.kind === 'TEAM' ? (TEAM_TYPE_LABELS[rescuer.type] || rescuer.type) : 'Local Volunteer'}
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
        <div className="h-44 relative">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Live status pill — top-left, same "glass pill over photo/map"
              language used across the app (Landing's route card, trip hero). */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-surface-container-lowest/95 backdrop-blur-sm rounded-full pl-2 pr-2.5 py-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-tsi-low animate-pulse" />
            <span className="text-[10px] font-bold text-on-surface-variant">
              {rescuer.isLive ? 'Live road route' : 'Dispatched from base'}
            </span>
          </div>

          {/* Follow toggle — center-locks the view on the rescuer's live
              position instead of the default "keep both points in frame". */}
          <button onClick={() => setFollow(v => !v)}
            className={cn('absolute top-2 right-2 flex items-center gap-1 rounded-full pl-1.5 pr-2.5 py-1 shadow-sm transition-colors',
              follow ? 'bg-tsi-low text-white' : 'bg-surface-container-lowest/95 backdrop-blur-sm text-on-surface-variant')}>
            <LocateFixed className="w-3 h-3" />
            <span className="text-[10px] font-bold">{follow ? 'Following' : 'Follow'}</span>
          </button>

          <div className="absolute bottom-2 right-2 bg-surface-container-lowest/95 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow-sm pointer-events-none">
            <Navigation className="w-3 h-3 text-tsi-low" />
            <span className="text-[10px] font-semibold text-on-surface-variant">{rescuer.isLive ? 'Live location' : 'Base location'}</span>
          </div>
        </div>
      )}
    </div>
  )
}
