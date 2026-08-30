// src/pages/ActiveJobPage.tsx — the Rapido "on a ride" screen. Shown whenever
// the volunteer has a live rescue_assignments row (govt manually assigned them,
// official or not — see rescue.repository.js#findActiveAssignmentByVolunteerId).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Siren, Navigation2, LocateFixed, User, Clock, CheckCircle2, MapPinned, UserCheck, Flag, Check, KeyRound, Phone, Loader2, XCircle, ChevronDown } from 'lucide-react'
// MapLibre GL over free vector tiles (OpenFreeMap, no API key) instead of
// Leaflet + raster OSM — same swap as the tourist app's RescueTrackingCard,
// so both sides of the live rescue view now share one rendering engine and
// one premium look, not just the same status-stepper language.
import { Map as MapLibreMap, Marker as MapLibreMarker, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, LineString, Polygon } from 'geojson'
import volunteerApi from '../api/volunteer.api'
import { getRoute, type Route } from '../lib/osrm'
import { cn } from '../lib/utils'

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
  const [rescuerPos, setRescuerPos] = useState<[number, number] | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
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
        const lineCoords = (route?.coordinates ?? [rescuerPos, sosPos]).map(([lat, lng]) => [lng, lat])
        const geojson: Feature<LineString> = {
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: lineCoords },
        }
        const existingRoute = map.getSource('job-route') as GeoJSONSource | undefined
        if (existingRoute) {
          existingRoute.setData(geojson)
        } else {
          map.addSource('job-route', { type: 'geojson', data: geojson })
          map.addLayer({
            id: 'job-route', type: 'line', source: 'job-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#0f766e', 'line-width': route ? 5 : 4, 'line-opacity': route ? 0.9 : 0.7, 'line-dasharray': route ? [1, 0] : [2, 2] },
          })
        }
        if (map.getLayer('job-route')) {
          map.setPaintProperty('job-route', 'line-width', route ? 5 : 4)
          map.setPaintProperty('job-route', 'line-opacity', route ? 0.9 : 0.7)
          map.setPaintProperty('job-route', 'line-dasharray', route ? [1, 0] : [2, 2])
        }
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [sosPos?.[0], sosPos?.[1], rescuerPos?.[0], rescuerPos?.[1], route])

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
            <div className="w-9 h-9 rounded-full bg-sos flex items-center justify-center flex-shrink-0">
              <Siren className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-on-surface truncate">{category}{assignment.tourist_name ? ` · ${assignment.tourist_name}` : ''}</p>
              <p className="text-xs text-on-surface-variant flex items-center gap-1">
                <User className="w-3 h-3" /> Assigned to you
              </p>
            </div>
          </div>

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

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="bg-surface-container rounded-2xl p-3 flex items-center gap-2.5">
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
          <div className="bg-surface-container rounded-2xl p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-on-surface leading-tight">
                {route ? formatEta(route.durationMin) : 'Calculating…'}
              </p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">ETA</p>
            </div>
          </div>
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

        {assignment.handoff_verified_at ? (
          <div className="w-full rounded-2xl bg-safe/10 text-safe font-bold px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0" /> Rescue Verification Code confirmed — awaiting govt close-out
          </div>
        ) : assignment.status === 'ARRIVED' ? (
          <div className="bg-white rounded-2xl p-3.5 shadow-lg">
            <p className="flex items-center gap-1.5 text-xs font-bold text-on-surface mb-2">
              <KeyRound className="w-3.5 h-3.5 text-primary" /> Ask {assignment.tourist_name ?? 'them'} for their Rescue Verification Code
            </p>
            <div className="flex items-center gap-2">
              <input
                inputMode="numeric" maxLength={6} placeholder="6-digit code"
                value={handoffCode}
                onChange={(e) => setHandoffCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="flex-1 h-11 rounded-xl border border-outline-variant px-3 text-center text-lg font-black tracking-[0.3em] tabular-nums focus:outline-none focus:border-primary"
              />
              {assignment.tourist_phone && (
                <a href={`tel:${assignment.tourist_phone}`} title="Call them"
                  className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4.5 h-4.5 text-on-surface-variant" />
                </a>
              )}
            </div>
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
    </div>
  )
}
