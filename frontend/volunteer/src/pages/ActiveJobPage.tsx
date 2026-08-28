// src/pages/ActiveJobPage.tsx — the Rapido "on a ride" screen. Shown whenever
// the volunteer has a live rescue_assignments row (govt manually assigned them,
// official or not — see rescue.repository.js#findActiveAssignmentByVolunteerId).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Siren, Navigation2, LocateFixed, User, Clock, CheckCircle2, MapPinned, UserCheck, Flag, Check } from 'lucide-react'
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

  // Map instance: created once the page mounts (assignment already loaded —
  // see the `if (!assignment) return null` guard below, which keeps this
  // component, and its container div, unmounted until then).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          onClick={() => {
            const map = mapRef.current
            if (!map) return
            if (bounds.length > 1) {
              const lngs = bounds.map((b) => b[1]), lats = bounds.map((b) => b[0])
              map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, duration: 600 })
            } else {
              map.flyTo({ center: [bounds[0][1], bounds[0][0]], zoom: 14 })
            }
          }}
          title="Recenter" aria-label="Recenter"
          className="absolute bottom-40 right-3 z-[1000] w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
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
