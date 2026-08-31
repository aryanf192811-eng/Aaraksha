// src/components/shared/RescueTrackingCard.tsx
// Shows up once a tourist's SOS has a rescuer assigned — official team or
// govt-assigned volunteer, contact number, distance, and an ETA. Official
// teams have no live GPS feed (no rescue-team-side login to report one), so
// their marker sits at their registered base; a volunteer's marker follows
// their real position once they've sent at least one location update, via
// the RESCUER_LOCATION_UPDATE push (see ActiveJobPage.tsx on the Rescuer
// app side) — the road route is real OSRM routing, not a straight line.
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
// MapLibre GL over free vector tiles (OpenFreeMap, no API key) instead of
// Leaflet + raster OSM — real road labels/rendering at a premium level
// Leaflet's raster tiles can't match, same rendering engine already proven
// in the govt app's TerrainMap.tsx, no billed key required.
import { Map as MapLibreMap, Marker as MapLibreMarker, NavigationControl, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, LineString } from 'geojson'
import { ShieldCheck, Phone, Navigation, LocateFixed, UserCheck, Navigation2, Flag, Check, KeyRound, ShieldAlert, RotateCw, Loader2, MessageCircle, Clock, X } from 'lucide-react'
import { toast } from 'sonner'
import sosApi from '../../api/sos.api'
import { getSocket } from '../../lib/socket'
import { SOCKET_EVENTS } from '../../constants/enums'
import { getRoute, haversineMeters, ROUTE_REFETCH_MIN_INTERVAL_MS, ROUTE_REFETCH_MIN_DISTANCE_M, type Route } from '../../lib/osrm'
import { getErrorMessage } from '../../api/client'
import { cn } from '../../lib/utils'
import { useDragSheet } from '../../hooks/useDragSheet'
import { MessageThread } from './MessageThread'

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
  const [showChat, setShowChat] = useState(false)
  const { handleProps: dragHandleProps, sheetStyle: dragSheetStyle } = useDragSheet({ onClose: () => setShowChat(false) })
  const [rescuerNavigating, setRescuerNavigating] = useState(false)
  const [delayed, setDelayed] = useState(false)
  const originalEtaMinRef = useRef<number | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const rescuerMarkerRef = useRef<MapLibreMarker | null>(null)
  const sosMarkerRef = useRef<MapLibreMarker | null>(null)

  const { data, isError, refetch } = useQuery({
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
    // Ephemeral, not part of the polled/refetched SOS payload — a direct
    // reflection of the rescuer's own "Navigate" toggle, live.
    const onNavigatingState = (payload: { navigating: boolean }) => setRescuerNavigating(payload.navigating)
    socket.on(SOCKET_EVENTS.SOS_STATUS_UPDATED, onUpdate)
    socket.on(SOCKET_EVENTS.RESCUER_STATUS_UPDATE, onUpdate)
    socket.on(SOCKET_EVENTS.RESCUER_LOCATION_UPDATE, onLocation)
    socket.on(SOCKET_EVENTS.RESCUER_NAVIGATING_STATE, onNavigatingState)
    socket.on(SOCKET_EVENTS.HANDOFF_VERIFIED, onUpdate)
    return () => {
      socket.off(SOCKET_EVENTS.SOS_STATUS_UPDATED, onUpdate)
      socket.off(SOCKET_EVENTS.RESCUER_STATUS_UPDATE, onUpdate)
      socket.off(SOCKET_EVENTS.RESCUER_LOCATION_UPDATE, onLocation)
      socket.off(SOCKET_EVENTS.RESCUER_NAVIGATING_STATE, onNavigatingState)
      socket.off(SOCKET_EVENTS.HANDOFF_VERIFIED, onUpdate)
    }
  }, [queryClient])

  // Tourist <-> Rescuer messaging — scoped to this one active assignment,
  // extends the tel: link right next to it. sosId only exists once the
  // active-rescue query above has resolved, so this stays disabled until then.
  const sosId = data?.sosId
  const { data: rescueMessages, isLoading: loadingRescueMessages } = useQuery({
    queryKey: ['messages', 'rescue', sosId],
    queryFn: () => sosApi.getRescueMessages(sosId!).then(r => r.data.data),
    enabled: showChat && !!sosId,
    staleTime: 5_000,
  })
  const { mutate: sendRescueMessage, isPending: sendingRescueMessage } = useMutation({
    mutationFn: (body: string) => sosApi.sendRescueMessage(sosId!, body),
    onSuccess: (res) => {
      // The MESSAGE_RECEIVED socket push for this same message can arrive
      // before this mutation's own response does and trigger a refetch that
      // already includes it — dedupe by id so this append doesn't double it.
      queryClient.setQueryData(['messages', 'rescue', sosId], (prev: typeof rescueMessages) =>
        prev?.some((m) => m.id === res.data.data.id) ? prev : [...(prev ?? []), res.data.data])
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
  useEffect(() => {
    const socket = getSocket()
    if (!socket || !sosId) return
    const onMessage = (payload: { conversation_type: string; sos_event_id: string | null }) => {
      if (payload.conversation_type === 'TOURIST_RESCUER' && payload.sos_event_id === sosId) {
        queryClient.invalidateQueries({ queryKey: ['messages', 'rescue', sosId] })
      }
    }
    socket.on(SOCKET_EVENTS.MESSAGE_RECEIVED, onMessage)
    return () => { socket.off(SOCKET_EVENTS.MESSAGE_RECEIVED, onMessage) }
  }, [sosId, queryClient])

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
  // Split checks so the map can mount and show the tourist's own (always
  // known) location the instant a rescuer is assigned, instead of hiding
  // the whole card until the rescuer's position has ALSO resolved — a
  // volunteer's very first location push, or a team whose base coords are
  // still loading, used to mean "no map at all" rather than "map, with the
  // rescuer marker following shortly."
  const hasValidSosPos = !!sosPos && sosPos.every((n) => Number.isFinite(n))
  const hasValidRescuerPos = !!rescuerPos && rescuerPos.every((n) => Number.isFinite(n))

  // Real road route, refetched whenever the rescuer's position changes.
  // Falls back to the straight dashed line (route stays null) if OSRM is
  // unreachable — the map degrades instead of breaking. Throttled so a
  // burst of RESCUER_LOCATION_UPDATE pushes doesn't hammer the free public
  // OSRM server faster than the route could meaningfully change.
  const lastRouteFetchRef = useRef<{ time: number; lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (!hasValidCoords || !rescuerPos || !sosPos) return
    const now = Date.now()
    const last = lastRouteFetchRef.current
    if (last
      && now - last.time < ROUTE_REFETCH_MIN_INTERVAL_MS
      && haversineMeters(last.lat, last.lng, rescuerPos[0], rescuerPos[1]) < ROUTE_REFETCH_MIN_DISTANCE_M) {
      return
    }
    lastRouteFetchRef.current = { time: now, lat: rescuerPos[0], lng: rescuerPos[1] }
    getRoute(rescuerPos[0], rescuerPos[1], sosPos[0], sosPos[1]).then(setRoute)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescuerPos?.[0], rescuerPos?.[1], sosPos?.[0], sosPos?.[1], hasValidCoords])

  // Delay-aware reassurance: captures the first real ETA as a baseline once,
  // then re-checks every 30s whether actual elapsed time has blown well
  // past it. 1.6x is a deliberately generous margin for mountainous/
  // single-lane terrain, so this only fires for a genuine delay.
  useEffect(() => {
    if (route && originalEtaMinRef.current === null) originalEtaMinRef.current = route.durationMin
  }, [route])
  useEffect(() => {
    if (!rescuer || rescuer.status === 'ARRIVED') { setDelayed(false); return }
    const check = () => {
      const originalEta = originalEtaMinRef.current
      if (!originalEta) return
      const elapsedMin = (Date.now() - new Date(rescuer.assignedAt).getTime()) / 60000
      setDelayed(elapsedMin > originalEta * 1.6)
    }
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [rescuer?.assignedAt, rescuer?.status])

  // Map instance: created once the box mounts (hasValidCoords flips true).
  // Pannable and pinch-zoomable — a genuinely dynamic map, not a locked
  // preview — but scrollZoom stays off so scrolling the page past the card
  // doesn't get trapped by the map underneath it; a NavigationControl
  // supplies the desktop +/- zoom scrollZoom would otherwise have given.
  useEffect(() => {
    if (!hasValidSosPos || !sosPos || !mapContainerRef.current || mapRef.current) return
    // Center on the rescuer if we already have their position, otherwise on
    // the SOS location itself — always known the moment a rescuer's
    // assigned, so the map never waits on a live GPS fix just to appear.
    const initialCenter = hasValidRescuerPos && rescuerPos ? rescuerPos : sosPos
    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [initialCenter[1], initialCenter[0]],
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
  }, [hasValidSosPos])

  // Markers + route line: updated in place on every position/route change
  // rather than recreated, so the marker doesn't flicker on each GPS tick.
  // The SOS marker draws as soon as we have it (always, once a rescuer's
  // assigned); the rescuer marker and route line are added the moment
  // their position resolves, instead of both being withheld together.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !hasValidSosPos || !sosPos) return

    const apply = () => {
      const sosLngLat: [number, number] = [sosPos[1], sosPos[0]]
      if (!sosMarkerRef.current) {
        sosMarkerRef.current = new MapLibreMarker({ element: pinMarkerEl('#ef4444', SOS_PIN_ICON, true), anchor: 'bottom' })
          .setLngLat(sosLngLat).addTo(map)
      }

      if (hasValidRescuerPos && rescuerPos) {
        const rescuerLngLat: [number, number] = [rescuerPos[1], rescuerPos[0]]
        if (!rescuerMarkerRef.current) {
          rescuerMarkerRef.current = new MapLibreMarker({ element: pinMarkerEl('#10b981', RESCUER_PIN_ICON), anchor: 'bottom' })
            .setLngLat(rescuerLngLat).addTo(map)
        } else {
          rescuerMarkerRef.current.setLngLat(rescuerLngLat)
        }

        // Before OSRM resolves, this is straight-line displacement, not a
        // route — drawing it in the same green as the real route (just
        // dashed) read as "the route, still loading" rather than what it
        // actually is. Pending state gets its own unmistakable neutral-grey,
        // fine-dot style so it can never be mistaken for a resolved route.
        const lineCoords = (route?.coordinates ?? [rescuerPos, sosPos]).map(([lat, lng]) => [lng, lat])
        const geojson: Feature<LineString> = {
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: lineCoords },
        }
        const routeColor = route ? '#10b981' : '#94a3b8'
        const routeDash: [number, number] = route ? [1, 0] : [0.5, 2]
        const existingSource = map.getSource('rescue-route') as GeoJSONSource | undefined
        if (existingSource) {
          existingSource.setData(geojson)
        } else {
          map.addSource('rescue-route', { type: 'geojson', data: geojson })
          map.addLayer({
            id: 'rescue-route', type: 'line', source: 'rescue-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': routeColor, 'line-width': 3, 'line-dasharray': routeDash },
          })
        }
        if (map.getLayer('rescue-route')) {
          map.setPaintProperty('rescue-route', 'line-color', routeColor)
          map.setPaintProperty('rescue-route', 'line-dasharray', routeDash)
        }
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [rescuerPos?.[0], rescuerPos?.[1], sosPos?.[0], sosPos?.[1], route, hasValidSosPos, hasValidRescuerPos])

  // Follow toggle: center-lock on the rescuer, or fit both points in frame.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !hasValidRescuerPos || !rescuerPos) return
    if (follow) {
      map.easeTo({ center: [rescuerPos[1], rescuerPos[0]], zoom: Math.max(map.getZoom(), 15), duration: 600 })
    } else if (sosPos) {
      // fitBounds correctly frames both markers for a real nearby rescue,
      // but a rescuer/tourist pair that's implausibly far apart (real GPS
      // on a device that isn't near the demo destination's fixed
      // coordinates, or a stale cross-region demo assignment) drives the
      // camera out to a whole-country/world view -- MapLibre still
      // "renders" there, it's just the near-featureless low-zoom base
      // layer with no roads or landmarks, which reads as a blank map.
      // Past that distance, showing the rescuer's own position at a real,
      // legible zoom is more useful than technically-correct-but-useless
      // bounds-fitting.
      const distanceKm = rescuer?.distanceKm ?? routeDistanceKm
      if (distanceKm != null && distanceKm > 150) {
        map.easeTo({ center: [rescuerPos[1], rescuerPos[0]], zoom: 12, duration: 600 })
      } else {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, rescuerPos?.[0], rescuerPos?.[1], sosPos?.[0], sosPos?.[1]])

  // No rescuer assigned is the ordinary, common case (most visits to the
  // Safety Center have no active rescue) and correctly renders nothing.
  // A fetch failure is different -- if a rescue genuinely is in progress,
  // silently showing nothing here is indistinguishable from "no rescue
  // exists," which is the wrong thing to look like during an emergency.
  // The backend this demo runs against has real, recurring outage windows
  // (confirmed live, not hypothetical), so this is a real, not theoretical,
  // case worth a retry affordance rather than staying silent.
  if (isError) {
    return (
      <div className="bg-sos/5 border-2 border-sos/20 rounded-2xl p-4 flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-sos flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-on-surface">Couldn't check your rescue status</p>
          <p className="text-xs text-on-surface-variant">If a rescuer was assigned, this will catch up once reconnected.</p>
        </div>
        <button onClick={() => refetch()} className="flex-shrink-0 text-xs font-bold text-primary px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors">
          Retry
        </button>
      </div>
    )
  }

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
          <button onClick={() => setShowChat(true)}
            className="w-9 h-9 rounded-full bg-tsi-low/20 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-4 h-4 text-tsi-low" />
          </button>
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

      {/* Calm, never-alarming — response times genuinely vary in this
          terrain, and the point is reassurance plus a real next step
          (message them), not anxiety. */}
      {delayed && (
        <div className="mx-4 mb-3 bg-surface-container rounded-xl p-3 flex items-start gap-2">
          <Clock className="w-4 h-4 text-on-surface-variant flex-shrink-0 mt-0.5" />
          <p className="text-xs text-on-surface-variant leading-snug">
            Your rescuer is still on the way — response times can vary in this terrain.{' '}
            <button onClick={() => setShowChat(true)} className="font-bold text-tsi-low underline">
              Message them if you need an update.
            </button>
          </p>
        </div>
      )}

      <HandoffCodeCard sosId={data.sosId} verifiedAt={data.handoffVerifiedAt} rescuerName={rescuer.name} />

      {hasValidSosPos && (
        <div className="h-80 relative">
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
              {!hasValidRescuerPos ? 'Locating rescuer…'
                : rescuerNavigating ? '🧭 Actively navigating to you'
                : rescuer.isLive ? 'Live road route' : 'Dispatched from base'}
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

      {/* Pullable bottom sheet — matches the volunteer/guardian message
          threads' fixed-overlay pattern instead of the centered shadcn
          Dialog this used before, so all three portals' rescue-thread chat
          now shares one drag-to-dismiss feel. Deliberately not routed
          through dialog.tsx -- that primitive has no bottom-sheet/drag
          variant, and changing it would affect every other Dialog usage in
          this app, not just this one. */}
      {showChat && (
        <div className="fixed inset-0 z-[1100] flex items-end sm:items-center sm:justify-center bg-black/40" onClick={() => setShowChat(false)}>
          <div onClick={(e) => e.stopPropagation()} style={dragSheetStyle}
            className="w-full sm:w-[420px] sm:rounded-3xl bg-surface-container-lowest rounded-t-3xl shadow-2xl h-[70vh] max-h-[560px] flex flex-col overflow-hidden">
            <div {...dragHandleProps} className="flex-shrink-0 pt-2.5 pb-1 flex justify-center">
              <div className="w-10 h-1 bg-outline-variant rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 border-b border-outline-variant flex-shrink-0">
              <p className="flex items-center gap-2 font-bold text-on-surface">
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', rescuer.isLive ? 'bg-tsi-low' : 'bg-outline-variant')} />
                {rescuer.name}
              </p>
              <button onClick={() => setShowChat(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container">
                <X className="w-4 h-4 text-on-surface-variant" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <MessageThread
                messages={rescueMessages}
                isLoading={loadingRescueMessages}
                mine="TOURIST"
                onSend={sendRescueMessage}
                sending={sendingRescueMessage}
                disabledReason={rescuer.kind === 'TEAM' ? "Official rescue teams don't have in-app messaging yet — use the call button instead." : null}
                emptyHint="No messages yet — let your rescuer know anything they should see on arrival."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
