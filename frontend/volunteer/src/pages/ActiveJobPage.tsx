// src/pages/ActiveJobPage.tsx — the Rapido "on a ride" screen. Shown whenever
// the volunteer has a live rescue_assignments row (govt manually assigned them,
// official or not — see rescue.repository.js#findActiveAssignmentByVolunteerId).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Siren, Navigation2, LocateFixed, User, Clock, CheckCircle2, MapPinned, UserCheck, Flag, Check, KeyRound, Phone, Loader2, XCircle, ChevronDown, MessageCircle, X } from 'lucide-react'
import { getSocket } from '../lib/socket'
import { MessageThread } from '../components/MessageThread'
import { useDragSheet } from '../hooks/useDragSheet'
// MapLibre GL over free vector tiles (OpenFreeMap, no API key) instead of
// Leaflet + raster OSM — same swap as the tourist app's RescueTrackingCard,
// so both sides of the live rescue view now share one rendering engine and
// one premium look, not just the same status-stepper language.
import { Map as MapLibreMap, Marker as MapLibreMarker, NavigationControl, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, LineString, Polygon } from 'geojson'
import volunteerApi from '../api/volunteer.api'
import { getRoute, haversineMeters, ROUTE_REFETCH_MIN_INTERVAL_MS, ROUTE_REFETCH_MIN_DISTANCE_M, type Route } from '../lib/osrm'
import { cn, formatTimeAgo } from '../lib/utils'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

const CATEGORY_LABELS: Record<string, string> = {
  MEDICAL: 'Medical', LOST: 'Lost', TRAPPED: 'Trapped',
  DISASTER: 'Disaster', MISSING: 'Missing', CRIME: 'Crime', OTHER: 'Emergency',
}

// Same 3-stage assignment lifecycle the tourist side's RescueTrackingCard
// shows, rendered the same node+connecting-line way (Uber/Rapido-style trip
// status, not flat color bars) — kept in sync so both ends of the same
// real-time event visually agree.
const STATUS_STEPS = [
  { key: 'ASSIGNED', label: 'Assigned', Icon: UserCheck },
  { key: 'EN_ROUTE', label: 'En Route', Icon: Navigation2 },
  { key: 'ARRIVED', label: 'Arrived', Icon: Flag },
] as const

// Colored circular marker badge — same visual language as before, now a
// plain DOM element handed to a MapLibre Marker instead of a Leaflet divIcon.
function markerEl(color: string, iconSvg: string) {
  const el = document.createElement('div')
  el.style.cssText = `background:${color};width:36px;height:36px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid white`
  el.innerHTML = iconSvg
  return el
}

const RESCUER_MARKER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>'
const SOS_MARKER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'

// MapLibre has no "circle in real meters" primitive like Leaflet's Circle —
// approximate the SOS 300m radius as a 64-point polygon (equirectangular
// approximation, accurate enough at this scale) and draw it as a fill+line
// GeoJSON layer instead.
function circlePolygonLngLat(center: [number, number], radiusMeters: number, points = 64): [number, number][] {
  const [lat, lng] = center
  const latRad = (lat * Math.PI) / 180
  const coords: [number, number][] = []
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI
    const dLat = (radiusMeters * Math.cos(angle)) / 111320
    const dLng = (radiusMeters * Math.sin(angle)) / (111320 * Math.cos(latRad))
    coords.push([lng + dLng, lat + dLat])
  }
  return coords
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
  const queryClient = useQueryClient()
  const [showChat, setShowChat] = useState(false)
  const { handleProps: dragHandleProps, sheetStyle: dragSheetStyle } = useDragSheet({ onClose: () => setShowChat(false) })
  const [rescuerPos, setRescuerPos] = useState<[number, number] | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  // "Navigate" is a deliberate tap, not just the route line that's always
  // passively drawn once both positions are known -- emphasizes it on the
  // map and recenters, same "start" moment a delivery-partner app gives you.
  const [navigating, setNavigating] = useState(false)
  // Delay-aware nudge: captures the FIRST resolved ETA once per assignment
  // as the honest baseline, then compares it against actual elapsed time.
  // OSRM's public instance has no live-traffic layer, so this is the
  // system's disclosed answer to "what if the real path is slower than the
  // computed one" -- a measured signal, not a guess.
  const [delayed, setDelayed] = useState(false)
  const originalEtaMinRef = useRef<number | null>(null)
  const lastPushRef = useRef(0)
  const watchIdRef = useRef<number | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const rescuerMarkerRef = useRef<MapLibreMarker | null>(null)
  const sosMarkerRef = useRef<MapLibreMarker | null>(null)

  const { data: assignment, isLoading, isError, refetch } = useQuery({
    queryKey: ['volunteer', 'active-assignment'],
    queryFn: () => volunteerApi.getActiveAssignment().then((r) => r.data.data),
    refetchInterval: 20_000,
  })

  // Tourist <-> Rescuer messaging, scoped to this one active assignment —
  // extends the tel: call button already on this page.
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['volunteer', 'assignment-messages'],
    queryFn: () => volunteerApi.getAssignmentMessages().then((r) => r.data.data),
    enabled: showChat,
    staleTime: 5_000,
  })
  const { mutate: sendMessage, isPending: sendingMessage } = useMutation({
    mutationFn: (body: string) => volunteerApi.sendAssignmentMessage(body),
    onSuccess: (res) => {
      // The MESSAGE_RECEIVED socket push for this same message can arrive
      // before this mutation's own response does and trigger a refetch that
      // already includes it — dedupe by id so this append doesn't double it.
      queryClient.setQueryData(['volunteer', 'assignment-messages'], (prev: typeof messages) =>
        prev?.some((m) => m.id === res.data.data.id) ? prev : [...(prev ?? []), res.data.data])
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send'),
  })
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onMessage = (payload: { conversation_type: string }) => {
      if (payload.conversation_type === 'TOURIST_RESCUER') {
        queryClient.invalidateQueries({ queryKey: ['volunteer', 'assignment-messages'] })
      }
    }
    socket.on('MESSAGE_RECEIVED', onMessage)
    // The tourist added a category to this SOS -- refetch so the person
    // physically responding sees it right away instead of waiting on the
    // next 20s poll or having to check chat.
    const onCategoryAmended = () => queryClient.invalidateQueries({ queryKey: ['volunteer', 'active-assignment'] })
    socket.on('SOS_CATEGORY_AMENDED', onCategoryAmended)
    // The SOS this job is for just closed out from under the volunteer --
    // a tourist's own false-alarm, or govt resolving it directly. Without
    // this, a volunteer mid-response found out only when the silent 20s
    // getActiveAssignment poll eventually dropped the job, with nothing
    // explaining why it vanished. Refetching (rather than assuming) still
    // matters here: a stale/out-of-order event for a DIFFERENT past
    // assignment must not bounce someone off a job that's still real.
    const onStatusUpdated = (payload: { sosId: string; status: string }) => {
      if (payload.status === 'FALSE_ALARM' || payload.status === 'RESOLVED') {
        toast.info(payload.status === 'FALSE_ALARM'
          ? 'The tourist marked this a false alarm — case closed.'
          : 'This case has been resolved by the command center.')
        queryClient.invalidateQueries({ queryKey: ['volunteer', 'active-assignment'] })
      }
    }
    socket.on('SOS_STATUS_UPDATED', onStatusUpdated)
    return () => {
      socket.off('MESSAGE_RECEIVED', onMessage)
      socket.off('SOS_CATEGORY_AMENDED', onCategoryAmended)
      socket.off('SOS_STATUS_UPDATED', onStatusUpdated)
    }
  }, [queryClient])

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

  // "Navigating" stops making sense once you've arrived -- clear it (and
  // let the tourist/guardian pill clear too) rather than leaving a stale
  // "actively navigating" signal up after the trip is already over.
  useEffect(() => {
    if (assignment?.status === 'ARRIVED') {
      setNavigating((v) => {
        if (v) volunteerApi.updateNavigatingState(false).catch(() => {})
        return false
      })
    }
  }, [assignment?.status])

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
  // Throttled independently of the GPS tick rate: watchPosition can fire far
  // more often than the route meaningfully changes, and hammering the free
  // public OSRM server on every jitter isn't "more live," just wasteful —
  // skip refetching unless enough time AND distance have passed since the
  // last successful fetch.
  const lastRouteFetchRef = useRef<{ time: number; lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (!rescuerPos || !sosPos) return
    const now = Date.now()
    const last = lastRouteFetchRef.current
    if (last
      && now - last.time < ROUTE_REFETCH_MIN_INTERVAL_MS
      && haversineMeters(last.lat, last.lng, rescuerPos[0], rescuerPos[1]) < ROUTE_REFETCH_MIN_DISTANCE_M) {
      return
    }
    lastRouteFetchRef.current = { time: now, lat: rescuerPos[0], lng: rescuerPos[1] }
    getRoute(rescuerPos[0], rescuerPos[1], sosPos[0], sosPos[1]).then(setRoute)
  }, [rescuerPos?.[0], rescuerPos?.[1], sosPos?.[0], sosPos?.[1]])

  // Capture the first real ETA as this assignment's baseline, once.
  useEffect(() => {
    if (route && originalEtaMinRef.current === null) originalEtaMinRef.current = route.durationMin
  }, [route])

  // Re-check every 30s whether actual elapsed time has blown well past that
  // baseline -- 1.6x is a deliberately generous margin (real terrain here
  // is mountainous/single-lane, not highway) so this only fires for a
  // genuine, meaningful delay, not routine GPS/ETA noise.
  useEffect(() => {
    if (!assignment || assignment.status === 'ARRIVED') { setDelayed(false); return }
    const check = () => {
      const originalEta = originalEtaMinRef.current
      if (!originalEta) return
      const elapsedMin = (Date.now() - new Date(assignment.assigned_at).getTime()) / 60000
      setDelayed(elapsedMin > originalEta * 1.6)
    }
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [assignment?.assigned_at, assignment?.status])

  // Map instance: intended to be created once, right after `assignment`
  // loads (the `if (!assignment) return null` guard below keeps this
  // component's JSX -- and its map container div -- from existing in the
  // DOM before then). This used to depend on `[]`, which only gives React
  // ONE chance ever to find a real `mapContainerRef.current`. That's fine
  // when this page is reached by navigating from HomePage (which queries
  // this same ['volunteer','active-assignment'] key first, so the cache is
  // already warm and `assignment` is truthy on this component's very first
  // render) -- but on a cold load straight into /active-job (a PWA re-open,
  // a hard refresh, or the loading/error states added above), the first
  // render has no assignment yet, the container div doesn't exist, the
  // effect's guard correctly bails out finding a null ref -- and then,
  // with `[]` deps, never runs again even once the container actually
  // appears a moment later. Depending on `assignment` instead lets the
  // effect retry the instant it becomes available; the `mapRef.current`
  // check still guarantees the map is only actually created once.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const initialCenter = rescuerPos ?? sosPos ?? [26.15, 91.77]
    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [initialCenter[1], initialCenter[0]],
      zoom: 13,
    })
    // Zoom + compass/pitch reset — this map had zero controls before,
    // matching govt's TerrainMap.tsx (the fuller of the two existing
    // MapLibre usages in this codebase) rather than tourist's zoom-only
    // variant, which deliberately drops the compass for its embedded-card
    // layout — this is a full-screen map with no such constraint.
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      rescuerMarkerRef.current = null
      sosMarkerRef.current = null
    }
    // Depends on !!assignment (truthy/falsy), not the object itself --
    // this should retry once on the falsy-to-truthy transition, not tear
    // down and rebuild the whole map (losing markers/camera state) on
    // every 20s refetch just because the assignment object's reference
    // changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!assignment])

  // Shared by the manual Recenter button and the auto-fit effect below —
  // frames both markers if we have two, or flies to whichever one we have.
  const recenter = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const pts: [number, number][] = [sosPos, rescuerPos].filter(Boolean) as [number, number][]
    if (pts.length > 1) {
      const lngs = pts.map((p) => p[1]), lats = pts.map((p) => p[0])
      // maxZoom guards against fitBounds zooming in past the point where
      // tiles render anything recognizable when the rescuer is essentially
      // on top of the tourist (near-zero-distance bounding box) -- same
      // fix as RescueTrackingCard.tsx on the tourist side.
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, duration: 600, maxZoom: 16 })
    } else if (pts.length === 1) {
      map.flyTo({ center: [pts[0][1], pts[0][0]], zoom: 14 })
    }
  }, [sosPos, rescuerPos])

  // Auto-fit, staged: the map is created (above) before either real
  // position is usually known -- sosPos arrives from the assignment fetch,
  // rescuerPos only once geolocation resolves, which can lag well behind.
  // Previously the camera only ever moved on a manual "Recenter" tap, so a
  // slow/failed geolocation fix left the view stuck at the hardcoded
  // Assam fallback for the entire job. This auto-fits once when the first
  // position becomes available, and again once both are known -- then
  // stays out of the way, so it doesn't fight the volunteer panning around
  // on every subsequent GPS tick.
  const autoFitStageRef = useRef(0)
  useEffect(() => {
    if (!mapRef.current) return
    const pts = [sosPos, rescuerPos].filter(Boolean)
    if (pts.length >= 2 && autoFitStageRef.current < 2) {
      autoFitStageRef.current = 2
      recenter()
    } else if (pts.length === 1 && autoFitStageRef.current < 1) {
      autoFitStageRef.current = 1
      recenter()
    }
  }, [sosPos?.[0], sosPos?.[1], rescuerPos?.[0], rescuerPos?.[1], recenter])

  // Markers, SOS radius, and route line — updated in place on every
  // position/route change so nothing flickers on each GPS tick.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      if (sosPos) {
        const sosLngLat: [number, number] = [sosPos[1], sosPos[0]]
        if (!sosMarkerRef.current) {
          sosMarkerRef.current = new MapLibreMarker({ element: markerEl('#ef4444', SOS_MARKER_SVG) }).setLngLat(sosLngLat).addTo(map)
        } else {
          sosMarkerRef.current.setLngLat(sosLngLat)
        }
        const circleGeojson: Feature<Polygon> = {
          type: 'Feature', properties: {},
          geometry: { type: 'Polygon', coordinates: [circlePolygonLngLat(sosPos, 300)] },
        }
        const existingCircle = map.getSource('sos-radius') as GeoJSONSource | undefined
        if (existingCircle) {
          existingCircle.setData(circleGeojson)
        } else {
          map.addSource('sos-radius', { type: 'geojson', data: circleGeojson })
          map.addLayer({ id: 'sos-radius-fill', type: 'fill', source: 'sos-radius', paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.15 } })
          map.addLayer({ id: 'sos-radius-outline', type: 'line', source: 'sos-radius', paint: { 'line-color': '#ef4444', 'line-width': 1.5 } })
        }
      }

      if (rescuerPos) {
        const rescuerLngLat: [number, number] = [rescuerPos[1], rescuerPos[0]]
        if (!rescuerMarkerRef.current) {
          rescuerMarkerRef.current = new MapLibreMarker({ element: markerEl('#0f766e', RESCUER_MARKER_SVG) }).setLngLat(rescuerLngLat).addTo(map)
        } else {
          rescuerMarkerRef.current.setLngLat(rescuerLngLat)
        }
      }

      if (sosPos && rescuerPos) {
        // Before OSRM resolves, the only thing we actually know is straight-
        // line displacement between the two points -- not a route. Drawing
        // that in the same teal as the real route (just thinner/dashed) read
        // as "the route, still loading" rather than what it actually is, so
        // distance/ETA looked like they were reporting road distance the
        // moment a straight line appeared. Pending state now gets its own
        // unmistakable style -- neutral grey, fine dots, no width bump from
        // "Navigate" -- so it can never be mistaken for a resolved route.
        const lineCoords = (route?.coordinates ?? [rescuerPos, sosPos]).map(([lat, lng]) => [lng, lat])
        const geojson: Feature<LineString> = {
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: lineCoords },
        }
        const routeWidth = route ? (navigating ? 7 : 5) : 3
        const routeOpacity = route ? (navigating ? 1 : 0.9) : 0.5
        const routeColor = route ? '#0f766e' : '#94a3b8'
        const routeDash: [number, number] = route ? [1, 0] : [0.5, 2]
        const existingRoute = map.getSource('job-route') as GeoJSONSource | undefined
        if (existingRoute) {
          existingRoute.setData(geojson)
        } else {
          map.addSource('job-route', { type: 'geojson', data: geojson })
          map.addLayer({
            id: 'job-route', type: 'line', source: 'job-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': routeColor, 'line-width': routeWidth, 'line-opacity': routeOpacity, 'line-dasharray': routeDash },
          })
        }
        if (map.getLayer('job-route')) {
          map.setPaintProperty('job-route', 'line-color', routeColor)
          map.setPaintProperty('job-route', 'line-width', routeWidth)
          map.setPaintProperty('job-route', 'line-opacity', routeOpacity)
          map.setPaintProperty('job-route', 'line-dasharray', routeDash)
        }
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [sosPos?.[0], sosPos?.[1], rescuerPos?.[0], rescuerPos?.[1], route, navigating])

  const { mutate: updateStatus, isPending: updatingStatus } = useMutation({
    mutationFn: (status: 'EN_ROUTE' | 'ARRIVED') => volunteerApi.updateAssignmentStatus(status),
    onSuccess: (res) => {
      toast.success(res.data.data.status === 'ARRIVED' ? "Marked as arrived — govt will close this out" : 'On your way — status updated')
      refetch()
    },
  })

  const [handoffCode, setHandoffCode] = useState('')
  const { mutate: verifyHandoff, isPending: verifying } = useMutation({
    mutationFn: (code: string) => volunteerApi.verifyHandoff(code),
    onSuccess: () => {
      toast.success('Rescue Verification Code confirmed — thank you, awaiting govt close-out')
      setHandoffCode('')
      refetch()
    },
    // Error toast comes from the app-wide MutationCache.onError in
    // lib/queryClient.ts (wrong code, too far, or locked-out all surface
    // there with the exact message the backend gives) -- no local onError
    // needed, same pattern as this file's other mutations.
  })

  const [showExitForm, setShowExitForm] = useState(false)
  const [exitReason, setExitReason] = useState('')
  const { mutate: exitAssignment, isPending: exiting } = useMutation({
    mutationFn: (reason: string) => volunteerApi.exitAssignment(reason),
    onSuccess: (res) => {
      toast.success(res.data.data.status === 'DECLINED' ? 'Assignment declined' : 'Response cancelled — govt has been notified')
      setShowExitForm(false)
      setExitReason('')
      navigate('/', { replace: true })
    },
  })

  // Previously this fell straight through to `if (!assignment) return null`
  // for a loading OR a failed fetch, same as a genuine "no active job" --
  // rendering nothing at all with zero explanation. Given the backend this
  // demo runs against has real, recurring outage windows, a volunteer
  // opening their one active job during a real rescue deserves to see
  // "still loading" or "couldn't reach the server, retry" instead of a
  // blank screen that looks identical to the app being broken.
  if (isLoading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-surface-container-high">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-4 bg-surface-container-high px-8 text-center">
        <XCircle className="w-10 h-10 text-sos" />
        <div>
          <p className="font-bold text-on-surface">Couldn't load your job</p>
          <p className="text-sm text-on-surface-variant mt-1">Check your connection and try again.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="h-11 px-6 rounded-full bg-primary text-primary-foreground font-bold active:scale-95 transition-transform"
        >
          Retry
        </button>
      </div>
    )
  }
  if (!assignment) return null

  const category = CATEGORY_LABELS[assignment.category] || assignment.category
  const bounds: [number, number][] = [sosPos, rescuerPos].filter(Boolean) as [number, number][]
  const currentStepIndex = Math.max(0, STATUS_STEPS.findIndex((s) => s.key === assignment.status))

  return (
    <div className="h-[100dvh] w-full relative bg-surface-container-high overflow-hidden">
      {/* MapLibre's default top-right anchor sits directly under the job-
          summary card (z-[1000], full-width, starts at the very top) --
          nudge the native zoom/compass control down below it instead of
          fighting for the same corner, and lift its z-index so the card
          doesn't just paint over it. */}
      <style>{`
        .maplibregl-ctrl-top-right { top: 168px; z-index: 1002; }
      `}</style>
      {/* ── Live map, full screen ─────────────────────────────── */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {bounds.length > 0 && (
        <button
          onClick={recenter}
          title="Recenter" aria-label="Recenter"
          // z-[1001], one above the bottom sheet's z-[1000] -- the sheet's
          // height grows with its content (handoff-code field, exit-reason
          // textarea), and at equal z-index it painted over this button
          // whenever that happened, making the manual recenter fallback
          // physically unreachable on a real phone screen.
          className="absolute bottom-40 right-3 z-[1001] w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <LocateFixed className="w-5 h-5 text-on-surface" />
        </button>
      )}

      {/* ── Top overlay: job summary + assignment progress ────── */}
      <div className="absolute top-0 left-0 right-0 z-[1000] px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="bg-white/95 backdrop-blur rounded-2xl px-4 py-3.5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative w-9 h-9 rounded-full bg-sos flex items-center justify-center flex-shrink-0">
              {/* Same pulse language as the ARRIVED status node below and
                  the tourist app's own SOS pin -- ties this whole screen's
                  urgency cues to one visual vocabulary instead of a static
                  badge. */}
              <span className="absolute inset-0 rounded-full bg-sos/40 animate-ping" />
              <Siren className="w-4.5 h-4.5 text-white relative" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-on-surface truncate">{category}{assignment.tourist_name ? ` · ${assignment.tourist_name}` : ''}</p>
              <p className="text-xs text-on-surface-variant flex items-center gap-1">
                <User className="w-3 h-3" /> Assigned to you · {formatTimeAgo(assignment.assigned_at)}
              </p>
              {/* The tourist can add a category after the fact -- this is
                  the structured signal, surfaced right where the person
                  physically responding will actually see it, not buried in
                  chat. */}
              {assignment.additional_categories?.length > 0 && (
                <p className="text-xs font-bold text-amber-700 mt-0.5">
                  + {assignment.additional_categories.join(', ')} added
                </p>
              )}
            </div>
            {/* Contact actions -- always reachable for the whole job, not
                just once ARRIVED (that used to hide these entirely for the
                ASSIGNED/EN_ROUTE stages, which is most of a rescue's
                duration). Same persistent placement the tourist app's own
                RescueTrackingCard already gives its rescuer. */}
            <button onClick={() => setShowChat(true)} title="Message tourist" aria-label="Message tourist"
              className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4.5 h-4.5 text-primary" />
            </button>
            {assignment.tourist_phone && (
              <a href={`tel:${assignment.tourist_phone}`} title="Call tourist" aria-label="Call tourist"
                className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-4.5 h-4.5 text-primary" />
              </a>
            )}
          </div>

          {!rescuerPos && (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary mb-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Getting your live location…
            </p>
          )}

          {/* Same node+connecting-line progress language as the tourist
              app's RescueTrackingCard — both sides of one real-time event
              agree, right down to the icons. */}
          <div className="flex items-center">
            {STATUS_STEPS.map((step, i) => {
              const isDone = i < currentStepIndex
              const isCurrent = i === currentStepIndex
              const StepIcon = step.Icon
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={cn('relative w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                      isDone ? 'bg-primary text-white'
                        : isCurrent ? 'bg-primary/15 text-primary ring-2 ring-primary'
                          : 'bg-surface-container-high text-on-surface-variant/50')}>
                      {isCurrent && <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />}
                      {isDone ? <Check className="w-3.5 h-3.5 relative" strokeWidth={3} /> : <StepIcon className="w-3 h-3 relative" />}
                    </div>
                    <span className={cn('text-[9px] font-bold uppercase tracking-wide text-center leading-tight w-14',
                      i <= currentStepIndex ? 'text-primary' : 'text-on-surface-variant/50')}>
                      {step.label}
                    </span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={cn('h-0.5 flex-1 mx-1 -mt-4', i < currentStepIndex ? 'bg-primary' : 'bg-outline-variant')} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom sheet: distance/ETA + actions ──────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-4" />

        {/* One connected trip-stats strip, not two separate cards -- the
            same "single glanceable summary" language Rapido/Swiggy give a
            live delivery, with a center divider instead of a gap so it
            reads as one fact (this trip) rather than two unrelated ones. */}
        <div className="bg-surface-container rounded-2xl p-3 mb-4 flex items-center">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MapPinned className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-on-surface leading-tight">
                {route ? `${route.distanceKm.toFixed(1)} km` : '—'}
              </p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Distance</p>
            </div>
          </div>
          <div className="w-px h-8 bg-outline-variant flex-shrink-0" />
          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end text-right">
            <div className="min-w-0">
              <p className="text-sm font-black text-on-surface leading-tight">
                {route ? formatEta(route.durationMin) : 'Calculating…'}
              </p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">ETA</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-primary" />
            </div>
          </div>
        </div>

        {sosPos && (
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {/* In-app: emphasizes the real OSRM route already drawn on this
                same screen and fits the camera to it -- a deliberate "start"
                moment, not just the passive line that was always there. A
                real toggle, not a one-way switch: tapping again while
                navigating turns it back off (undo), and it can be tapped on
                again after that (redo) -- previously this only ever set
                true, so once tapped it stayed "Navigating" for the rest of
                the job with no way back. Only fit the camera to the route on
                the way IN; turning navigation off shouldn't yank the map. */}
            <button
              onClick={() => setNavigating((v) => {
                const next = !v
                if (next) recenter()
                // Fire-and-forget -- the tourist/guardian pill reflecting
                // this is a nice-to-have reassurance signal, not something
                // this button's own responsiveness should ever wait on.
                volunteerApi.updateNavigatingState(next).catch(() => {})
                return next
              })}
              className={cn('h-12 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform',
                navigating ? 'bg-primary/15 text-primary border-2 border-primary' : 'bg-primary text-primary-foreground')}
            >
              <Navigation2 className="w-4.5 h-4.5" /> {navigating ? 'Navigating' : 'Navigate'}
            </button>
            {/* External handoff -- same rescuer/tourist coordinates the map
                already has, with an explicit origin so Google Maps routes
                from this app's own GPS fix, not whatever the device's last
                cached location happened to be. */}
            <a
              href={`https://www.google.com/maps/dir/?api=1${rescuerPos ? `&origin=${rescuerPos[0]},${rescuerPos[1]}` : ''}&destination=${sosPos[0]},${sosPos[1]}`}
              target="_blank" rel="noreferrer"
              className="h-12 rounded-2xl bg-surface-container border border-outline-variant text-on-surface font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <MapPinned className="w-4.5 h-4.5" /> Google Maps
            </a>
          </div>
        )}

        {/* OSRM's public instance has no live-traffic layer -- this is the
            honest, measured fallback when actual elapsed time has blown
            well past the originally-computed ETA: a real detour or traffic
            jam is more likely than the route being simply wrong. */}
        {delayed && sosPos && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-2.5 flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-snug">
              Taking longer than expected — check for a detour, or{' '}
              <a
                href={`https://www.google.com/maps/dir/?api=1${rescuerPos ? `&origin=${rescuerPos[0]},${rescuerPos[1]}` : ''}&destination=${sosPos[0]},${sosPos[1]}`}
                target="_blank" rel="noreferrer" className="font-bold underline"
              >
                open Google Maps for live traffic conditions
              </a>.
            </p>
          </div>
        )}

        {assignment.handoff_verified_at ? (
          <div className="w-full rounded-2xl bg-safe/10 text-safe font-bold px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0" /> Rescue Verification Code confirmed — awaiting govt close-out
          </div>
        ) : assignment.status === 'ARRIVED' ? (
          <div className="bg-white rounded-2xl p-3.5 shadow-lg">
            <p className="flex items-center gap-1.5 text-xs font-bold text-on-surface mb-2">
              <KeyRound className="w-3.5 h-3.5 text-primary" /> Ask {assignment.tourist_name ?? 'them'} for their Rescue Verification Code
            </p>
            {/* Message/call live in the persistent contact row up top now --
                no need to duplicate them here. */}
            <input
              inputMode="numeric" maxLength={6} placeholder="6-digit code"
              value={handoffCode}
              onChange={(e) => setHandoffCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full h-11 rounded-xl border border-outline-variant px-3 text-center text-lg font-black tracking-[0.3em] tabular-nums focus:outline-none focus:border-primary"
            />
            <p className="text-[11px] text-on-surface-variant mt-1.5 mb-2.5">
              This confirms you actually reached them — govt can't close the case without it.
            </p>
            <button
              onClick={() => verifyHandoff(handoffCode)}
              disabled={verifying || handoffCode.length !== 6}
              className="w-full h-11 rounded-xl bg-on-surface text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Verify handoff
            </button>
          </div>
        ) : (
          <button
            onClick={() => updateStatus(assignment.status === 'ASSIGNED' ? 'EN_ROUTE' : 'ARRIVED')}
            disabled={updatingStatus}
            className="w-full h-12 rounded-2xl bg-on-surface text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {updatingStatus ? <Loader2 className="w-4.5 h-4.5 animate-spin" />
              : assignment.status === 'ASSIGNED' ? <Navigation2 className="w-4.5 h-4.5" /> : <Flag className="w-4.5 h-4.5" />}
            {assignment.status === 'ASSIGNED' ? "I'm on my way" : 'Mark arrived'}
          </button>
        )}

        {/* Backing out — vehicle trouble, a higher-priority call, or on
            arrival realizing this needs an official team instead. Never
            shown once the handoff is verified: at that point the case is
            concluding, "cancelling" it doesn't mean anything. Deliberately
            a secondary, harder-to-reach link (not a button next to the
            primary action) — same "audited escape hatch, not a casual
            tap-away option" posture as govt's force-resolve override. */}
        {!assignment.handoff_verified_at && (
          <div className="mt-3">
            <button onClick={() => setShowExitForm(v => !v)}
              className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant hover:text-sos mx-auto">
              <ChevronDown className={`w-3 h-3 transition-transform ${showExitForm ? 'rotate-180' : ''}`} />
              {assignment.status === 'ASSIGNED' ? "Can't take this one?" : "Can't continue?"}
            </button>
            {showExitForm && (
              <div className="mt-2 bg-sos/5 border border-sos/20 rounded-2xl p-3 space-y-2">
                <p className="text-[11px] text-sos-dark flex items-start gap-1.5">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  {assignment.status === 'ASSIGNED'
                    ? "This returns the case to government for reassignment — say briefly why."
                    : "This tells government you can't complete the response — they'll reassign immediately. Say briefly why."}
                </p>
                <textarea rows={2} placeholder="e.g. Vehicle broke down, can't reach the location"
                  value={exitReason} onChange={(e) => setExitReason(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-xs resize-none focus:outline-none focus:border-sos" />
                <button
                  onClick={() => exitAssignment(exitReason.trim())}
                  disabled={exiting || exitReason.trim().length < 5}
                  className="w-full h-10 rounded-xl bg-sos text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
                >
                  {exiting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  {assignment.status === 'ASSIGNED' ? 'Decline this assignment' : "Cancel — I can't continue"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Message thread — custom overlay, this app has no Dialog
          primitive (everything here is hand-rolled Tailwind, see the
          bottom sheet above), so this matches that same fixed-overlay
          pattern rather than pulling in a new component library. Pullable:
          drag the handle down (or flick it) to dismiss, same as a native
          sheet -- the handle bar below used to be purely decorative. */}
      {showChat && (
        <div className="fixed inset-0 z-[1100] flex items-end sm:items-center sm:justify-center bg-black/40" onClick={() => setShowChat(false)}>
          <div onClick={(e) => e.stopPropagation()} style={dragSheetStyle}
            className="w-full sm:w-[420px] sm:rounded-3xl bg-white rounded-t-3xl shadow-2xl h-[70vh] max-h-[560px] flex flex-col overflow-hidden">
            <div {...dragHandleProps} className="flex-shrink-0 pt-2.5 pb-1 flex justify-center">
              <div className="w-10 h-1 bg-outline-variant rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 border-b border-outline-variant flex-shrink-0">
              <p className="flex items-center gap-2 font-bold text-on-surface">
                <span className="w-2 h-2 rounded-full bg-safe flex-shrink-0" />
                {assignment.tourist_name ?? 'Tourist'}
              </p>
              <button onClick={() => setShowChat(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container">
                <X className="w-4 h-4 text-on-surface-variant" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <MessageThread messages={messages} isLoading={loadingMessages} onSend={sendMessage} sending={sendingMessage} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
