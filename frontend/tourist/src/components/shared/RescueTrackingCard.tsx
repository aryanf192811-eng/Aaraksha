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
import { Map as MapLibreMap, Marker as MapLibreMarker, NavigationControl, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, LineString } from 'geojson'
import { ShieldCheck, Phone, Navigation, LocateFixed, UserCheck, Navigation2, Flag, Check, KeyRound, ShieldAlert, RotateCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import sosApi from '../../api/sos.api'
import { getSocket } from '../../lib/socket'
import { SOCKET_EVENTS } from '../../constants/enums'
import { getRoute, type Route } from '../../lib/osrm'
import { getErrorMessage } from '../../api/client'
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

// Real teardrop map-pin SVGs, anchored at the tip (Marker's `anchor:
// 'bottom'`) so the point — not the shape's center — sits exactly on the
// coordinate, matching how native map apps pin a location. Replaces the
// old flat colored dot, which read as a placeholder rather than a
// rescue-grade live map.
function pinMarkerEl(color: string, iconInner: string, pulse = false) {
  const el = document.createElement('div')
  el.style.cssText = 'position:relative;width:34px;height:42px'
  el.innerHTML = `
    ${pulse ? `<span class="rescue-pin-pulse" style="position:absolute;left:50%;bottom:1px;width:16px;height:16px;margin-left:-8px;border-radius:9999px;background:${color}"></span>` : ''}
    <svg width="34" height="42" viewBox="0 0 34 42" style="position:relative;display:block;filter:drop-shadow(0 3px 5px rgba(0,0,0,.35))">
      <path d="M17 0C7.61 0 0 7.61 0 17c0 12.75 17 25 17 25s17-12.25 17-25C34 7.61 26.39 0 17 0z" fill="${color}"/>
      <circle cx="17" cy="17" r="11" fill="white"/>
      ${iconInner}
    </svg>`
  return el
}

const RESCUER_PIN_ICON = '<path d="M11.5 17.5l3.5 3.5 7.5-8" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
const SOS_PIN_ICON = '<circle cx="17" cy="17" r="5" fill="#ef4444"/>'

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

const handoffCodeStorageKey = (sosId: string) => `sos:${sosId}:handoffCode`

// The anti-fraud handoff step: a rescuer can't just claim they reached the
// tourist over the phone — they have to actually be there, in person, to
// get this code. The server only ever stores a one-way hash of it (see
// handoff.service.js), so the plaintext this component gets back on first
// fetch is the only chance to show it — cached in sessionStorage (scoped to
// this one SOS, cleared once verified/resolved) so a reload doesn't lose it.
function HandoffCodeCard({ sosId, verifiedAt, rescuerName }: {
  sosId: string; verifiedAt: string | null; rescuerName?: string
}) {
  const [code, setCode] = useState<string | null>(() => sessionStorage.getItem(handoffCodeStorageKey(sosId)))
  const [alreadyIssuedNoCode, setAlreadyIssuedNoCode] = useState(false)
  const [loading, setLoading] = useState(false)

  const reveal = async (regenerate: boolean) => {
    setLoading(true)
    try {
      const res = regenerate ? await sosApi.regenerateHandoffCode(sosId) : await sosApi.getHandoffCode(sosId)
      const data = res.data.data
      if (data.code) {
        sessionStorage.setItem(handoffCodeStorageKey(sosId), data.code)
        setCode(data.code)
        setAlreadyIssuedNoCode(false)
      } else {
        setAlreadyIssuedNoCode(true)
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (verifiedAt) {
    sessionStorage.removeItem(handoffCodeStorageKey(sosId))
    return (
      <div className="mx-4 mb-3 bg-tsi-low/10 border border-tsi-low/30 rounded-xl p-3 flex items-center gap-2.5">
        <ShieldCheck className="w-5 h-5 text-tsi-low flex-shrink-0" />
        <p className="text-xs font-semibold text-on-surface">
          Rescue Verification Code confirmed — {rescuerName ?? 'your rescuer'} reached you in person.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-4 mb-3 bg-surface-container rounded-xl p-3.5 border border-outline-variant">
      <div className="flex items-center gap-2 mb-1.5">
        <KeyRound className="w-4 h-4 text-primary flex-shrink-0" />
        <p className="text-xs font-bold text-on-surface">Your Rescue Verification Code</p>
      </div>
      {code ? (
        <>
          <p className="text-2xl font-black tabular-nums tracking-[0.2em] text-on-surface text-center py-1.5">{code}</p>
          <p className="text-[11px] text-on-surface-variant leading-snug">
            Only say this out loud once your rescuer has physically reached you — it's how we confirm you're actually safe.
          </p>
          <button onClick={() => reveal(true)} disabled={loading}
            className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant hover:text-primary disabled:opacity-60">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
            Lost it? Generate a new one
          </button>
        </>
      ) : alreadyIssuedNoCode ? (
        <>
          <p className="text-xs text-on-surface-variant flex items-start gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            A code was already generated on another device or an earlier visit — if you don't remember it, generate a new one.
          </p>
          <button onClick={() => reveal(true)} disabled={loading}
            className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary disabled:opacity-60">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            Generate a new code
          </button>
        </>
      ) : (
        <button onClick={() => reveal(false)} disabled={loading}
          className="w-full h-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
          Show my Rescue Verification Code
        </button>
      )}
    </div>
  )
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
    socket.on(SOCKET_EVENTS.HANDOFF_VERIFIED, onUpdate)
    return () => {
      socket.off(SOCKET_EVENTS.SOS_STATUS_UPDATED, onUpdate)
      socket.off(SOCKET_EVENTS.RESCUER_STATUS_UPDATE, onUpdate)
      socket.off(SOCKET_EVENTS.RESCUER_LOCATION_UPDATE, onLocation)
      socket.off(SOCKET_EVENTS.HANDOFF_VERIFIED, onUpdate)
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

  // Map instance: created once the box mounts (hasValidCoords flips true).
  // Pannable and pinch-zoomable — a genuinely dynamic map, not a locked
  // preview — but scrollZoom stays off so scrolling the page past the card
  // doesn't get trapped by the map underneath it; a NavigationControl
  // supplies the desktop +/- zoom scrollZoom would otherwise have given.
  useEffect(() => {
    if (!hasValidCoords || !rescuerPos || !mapContainerRef.current || mapRef.current) return
    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [rescuerPos[1], rescuerPos[0]],
      zoom: 14,
      dragPan: true,
      dragRotate: false,
      scrollZoom: false,
      touchZoomRotate: true,
      doubleClickZoom: true,
      keyboard: false,
      attributionControl: false,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-left')
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
        rescuerMarkerRef.current = new MapLibreMarker({ element: pinMarkerEl('#10b981', RESCUER_PIN_ICON), anchor: 'bottom' })
          .setLngLat(rescuerLngLat).addTo(map)
      } else {
        rescuerMarkerRef.current.setLngLat(rescuerLngLat)
      }
      if (!sosMarkerRef.current) {
        sosMarkerRef.current = new MapLibreMarker({ element: pinMarkerEl('#ef4444', SOS_PIN_ICON, true), anchor: 'bottom' })
          .setLngLat(sosLngLat).addTo(map)
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
      // maxZoom guards against fitBounds zooming in past the point where
      // tiles render anything recognizable — with the rescuer essentially
      // on top of the tourist (near-zero-distance bounding box), it would
      // otherwise drive the camera to an extreme zoom that renders blank.
      map.fitBounds(
        [[Math.min(rescuerPos[1], sosPos[1]), Math.min(rescuerPos[0], sosPos[0])],
         [Math.max(rescuerPos[1], sosPos[1]), Math.max(rescuerPos[0], sosPos[0])]],
        { padding: 48, duration: 600, maxZoom: 16 }
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

      <HandoffCodeCard sosId={data.sosId} verifiedAt={data.handoffVerifiedAt} rescuerName={rescuer.name} />

      {hasValidCoords && rescuerPos && (
        <div className="h-64 relative">
          <style>{`
            @keyframes rescue-pin-pulse {
              0% { transform: scale(.6); opacity: .7; }
              70%, 100% { transform: scale(2.4); opacity: 0; }
            }
            .rescue-pin-pulse { animation: rescue-pin-pulse 1.8s ease-out infinite; }
          `}</style>
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
