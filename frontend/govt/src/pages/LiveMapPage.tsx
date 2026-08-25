// src/pages/LiveMapPage.tsx — real-time ops map with tourist status markers
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, Battery, LocateFixed, Navigation2, Flame } from 'lucide-react'
import govtApi from '../api/govt.api'
import { getRoute, type Route } from '../lib/osrm'
import { cn, formatTimeAgo } from '../lib/utils'
import type { LiveTourist } from '../types/api.types'
import { useSOSSocket } from '../hooks/useSOSSocket'

// Same semantic bands as lib/utils.ts#getZoneColor, in hex — Leaflet's
// color/fillColor props take CSS color values, not Tailwind classes, so
// that util can't be reused directly here.
const ZONE_COLOR_HEX: Record<string, string> = {
  SAFE: '#16a34a', CAUTION: '#d97706', HIGH_RISK: '#ea580c',
  RESTRICTED: '#dc2626', ILP_REQUIRED: '#9333ea',
}

// Radius by tourist count, not a fixed size — sqrt rather than linear so
// one destination with 20 tourists doesn't visually swallow the ones with
// 2, while still reading as clearly "more" at a glance.
const densityRadiusM = (total: number) => 9000 + Math.sqrt(total) * 6000

// Plain geometric marks (not pictorial emoji) keep the divIcon HTML string
// legible at 24px and consistent with the rest of the UI's icon language.
const createMarkerIcon = (color: string, glyph: string) =>
  L.divIcon({
    className: '',
    html: `<div style="background:${color};border:2px solid white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${glyph}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

const SAFE_ICON    = createMarkerIcon('#10b981', '&#9679;')
const SOS_ICON     = createMarkerIcon('#ef4444', '!')
const WARNING_ICON = createMarkerIcon('#f59e0b', '&#9650;')

// Same navigation-arrow badge as the Rescuer app's own map and Guardian's
// rescuer marker — one visual language for "this is a rescuer" everywhere
// it shows up.
const RESCUER_ICON = L.divIcon({
  className: '',
  html: `<div style="background:#0f766e;width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

// Recenter control — after panning around the ops map to inspect an
// incident, one click returns to the full Northeast India overview.
function RecenterControl({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  return (
    <button onClick={() => map.flyTo(center, zoom)} title="Recenter map" aria-label="Recenter map"
      className="absolute bottom-4 right-4 z-[1000] w-10 h-10 rounded-full bg-white shadow-lg border border-outline-variant flex items-center justify-center hover:bg-surface-container active:scale-95 transition-all">
      <LocateFixed className="w-5 h-5 text-on-surface" />
    </button>
  )
}

export default function LiveMapPage() {
  const [selectedTourist, setSelectedTourist] = useState<LiveTourist | null>(null)
  const [routes, setRoutes] = useState<Record<string, Route | null>>({})
  const [showDensity, setShowDensity] = useState(true)
  // Pushes an instant refetch on SOS/DMS/location events instead of waiting
  // for the next poll tick; the interval below stays as a safety net.
  useSOSSocket()

  const { data: tourists, isLoading } = useQuery({
    queryKey: ['govt', 'tourists', 'live'],
    queryFn: () => govtApi.getLiveTourists().then(r => r.data.data),
    refetchInterval: 15_000,
  })

  // Every rescuer (team or volunteer) currently working an SOS — moves live
  // on RESCUER_LOCATION_UPDATE via useSOSSocket's invalidation, same event
  // the Rescuer app, Guardian, and tourist maps already consume.
  const { data: activeRescuers } = useQuery({
    queryKey: ['govt', 'active-rescuers'],
    queryFn: () => govtApi.getActiveRescuers().then(r => r.data.data),
    refetchInterval: 15_000,
  })
  const rescuers = activeRescuers || []

  // Risk-density layer: where active trips are concentrated, by destination
  // (the finest grouping the data actually supports — see RiskOverviewEntry;
  // there's no district field on destinations or tourist locations). Slower
  // moving than tourist positions, so a minute-long staleTime is plenty.
  const { data: riskOverview } = useQuery({
    queryKey: ['govt', 'risk-overview'],
    queryFn: () => govtApi.getRiskOverview().then(r => r.data.data),
    staleTime: 60_000,
  })
  const densityZones = (riskOverview || []).filter(
    (z): z is typeof z & { latitude: number; longitude: number } => Number.isFinite(z.latitude) && Number.isFinite(z.longitude)
  )

  // Real OSRM road route per rescuer, refetched whenever a position moves —
  // keyed by assignment so multiple concurrent rescuers don't clobber each
  // other's route. Falls back to a straight line (route stays undefined)
  // if OSRM is unreachable, same degrade-not-break pattern as every other
  // portal's live-route map.
  const routeKey = rescuers.map(r => `${r.assignment_id}:${r.latitude}:${r.longitude}`).join('|')
  useEffect(() => {
    let cancelled = false
    Promise.all(rescuers.map(async (r) => {
      const lat = Number(r.latitude), lng = Number(r.longitude)
      const sosLat = Number(r.sos_latitude), sosLng = Number(r.sos_longitude)
      if (![lat, lng, sosLat, sosLng].every(Number.isFinite)) return [r.assignment_id, null] as const
      return [r.assignment_id, await getRoute(lat, lng, sosLat, sosLng)] as const
    })).then((entries) => {
      if (!cancelled) setRoutes(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey])

  const getMarkerIcon = (t: LiveTourist) => {
    if (t.active_sos_count > 0) return SOS_ICON
    if (t.active_dms_count > 0) return WARNING_ICON
    if (t.tsi_score !== null && t.tsi_score < 50) return WARNING_ICON
    return SAFE_ICON
  }

  const liveTourists = tourists || []
  const activeSOS = liveTourists.filter(t => t.active_sos_count > 0).length

  // Default center: Northeast India
  const mapCenter: [number, number] = [26.0, 93.0]

  return (
    <div className="h-full flex flex-col">
      <div className="bg-surface-container-lowest border-b border-outline-variant px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center gap-x-4 gap-y-2 shadow-sm">
        <h1 className="text-lg sm:text-xl font-black text-on-surface">Live Tourist Map</h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 sm:ml-auto text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-sos flex-shrink-0" />
            <span className="text-on-surface-variant font-medium whitespace-nowrap">{activeSOS} SOS active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-on-surface-variant font-medium whitespace-nowrap">{liveTourists.length} tracked</span>
          </div>
          {rescuers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Navigation2 className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="text-on-surface-variant font-medium whitespace-nowrap">{rescuers.length} rescuer{rescuers.length === 1 ? '' : 's'} en route</span>
            </div>
          )}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span className="text-xs text-on-surface-variant whitespace-nowrap">Live · updates every 15s</span>
          </div>
          <button onClick={() => setShowDensity(v => !v)}
            className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors',
              showDensity ? 'bg-orange-50 border-orange-200 text-orange-700' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
            )}>
            <Flame className="w-3.5 h-3.5" /> Risk Density
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
        <div className="h-[45vh] lg:h-auto lg:flex-1 relative flex-shrink-0">
          <MapContainer center={mapCenter} zoom={7} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
            {showDensity && densityZones.map((z) => {
              const color = ZONE_COLOR_HEX[z.zoneType] || '#64748b'
              return (
                <Circle key={z.destinationId || z.city}
                  center={[z.latitude, z.longitude]}
                  radius={densityRadiusM(z.total)}
                  pathOptions={{ color, weight: 1.5, fillColor: color, fillOpacity: 0.22 }}
                >
                  <Popup>
                    <div className="p-1 min-w-[160px]">
                      <p className="font-bold text-on-surface">{z.city}, {z.state}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{z.zoneType.replace('_', ' ')}</p>
                      <p className="text-xs mt-1">{z.total} tourist{z.total === 1 ? '' : 's'} · {z.solo} solo · {z.highRisk} high-risk</p>
                    </div>
                  </Popup>
                </Circle>
              )
            })}
            {liveTourists.map((tourist) => (
              <div key={tourist.id}>
                <Marker
                  position={[tourist.latitude, tourist.longitude]}
                  icon={getMarkerIcon(tourist)}
                  eventHandlers={{ click: () => setSelectedTourist(tourist) }}
                >
                  <Popup>
                    <div className="p-1 min-w-[160px]">
                      <p className="font-bold text-on-surface">{tourist.full_name}</p>
                      <p className="text-xs text-on-surface-variant">{tourist.phone}</p>
                      {tourist.tsi_score !== null && (
                        <p className="text-xs mt-1">TSI: <strong>{tourist.tsi_score}</strong> — {tourist.tsi_label}</p>
                      )}
                      {tourist.active_sos_count > 0 && (
                        <p className="text-xs text-red-600 font-bold mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> SOS ACTIVE
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
                {tourist.active_sos_count > 0 && (
                  <Circle
                    center={[tourist.latitude, tourist.longitude]}
                    radius={800}
                    color="#ef4444" fillColor="#ef4444" fillOpacity={0.1}
                  />
                )}
              </div>
            ))}
            {rescuers.map((r) => {
              const lat = Number(r.latitude), lng = Number(r.longitude)
              const sosLat = Number(r.sos_latitude), sosLng = Number(r.sos_longitude)
              if (![lat, lng, sosLat, sosLng].every(Number.isFinite)) return null
              const route = routes[r.assignment_id]
              return (
                <div key={r.assignment_id}>
                  <Polyline
                    positions={route?.coordinates ?? [[lat, lng], [sosLat, sosLng]]}
                    pathOptions={route ? { color: '#0f766e', weight: 4, opacity: 0.85 } : { color: '#0f766e', weight: 3, opacity: 0.6, dashArray: '6 8' }}
                  />
                  <Marker position={[lat, lng]} icon={RESCUER_ICON}>
                    <Popup>
                      <div className="p-1 min-w-[170px]">
                        <p className="font-bold text-on-surface">{r.rescuer_name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {r.rescuer_kind === 'TEAM' ? 'Official team' : 'Volunteer'} · {r.status.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-1">→ {r.tourist_name} ({r.category})</p>
                        {!r.is_live && <p className="text-[10px] text-on-surface-variant mt-1 italic">Registered base — no live GPS yet</p>}
                      </div>
                    </Popup>
                  </Marker>
                </div>
              )
            })}
            <RecenterControl center={mapCenter} zoom={7} />
          </MapContainer>

          {isLoading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface-container-lowest rounded-full px-4 py-2 shadow-md text-sm font-medium text-on-surface-variant">
              Loading live data...
            </div>
          )}

          {showDensity && densityZones.length > 0 && (
            <div className="absolute bottom-4 left-4 z-[1000] bg-surface-container-lowest rounded-xl px-3 py-2.5 shadow-md text-xs">
              <p className="font-bold text-on-surface mb-1.5">Risk Density — by destination</p>
              {Object.entries(ZONE_COLOR_HEX).map(([zone, color]) => (
                <div key={zone} className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  {zone.replace('_', ' ')}
                </div>
              ))}
              <p className="text-[10px] text-on-surface-variant/70 mt-1.5 max-w-[160px]">Circle size = active tourists at that destination</p>
            </div>
          )}
        </div>

        <div className="w-full lg:w-72 flex-1 lg:flex-initial min-h-0 bg-surface-container-lowest border-t lg:border-t-0 lg:border-l border-outline-variant overflow-y-auto">
          <div className="p-4 border-b border-outline-variant">
            <p className="text-sm font-bold text-on-surface">{liveTourists.length} tourists tracked in last 2h</p>
          </div>
          <div className="divide-y divide-slate-100">
            {liveTourists.map((t) => (
              <button key={t.id} onClick={() => setSelectedTourist(t === selectedTourist ? null : t)}
                className={cn('w-full p-4 text-left hover:bg-surface-container transition-colors',
                  selectedTourist?.id === t.id && 'bg-emerald-50'
                )}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                    t.active_sos_count > 0 ? 'bg-sos animate-pulse' :
                    t.active_dms_count > 0 ? 'bg-amber-500' : 'bg-green-500'
                  )} />
                  <span className="text-sm font-semibold text-on-surface truncate">{t.full_name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  {t.battery_pct !== null && (
                    <span className="flex items-center gap-0.5"><Battery className="w-3 h-3" />{t.battery_pct}%</span>
                  )}
                  {t.tsi_score !== null && (
                    <span className={cn('font-semibold',
                      t.tsi_score >= 70 ? 'text-green-600' : t.tsi_score >= 50 ? 'text-amber-600' : 'text-red-600'
                    )}>TSI:{t.tsi_score}</span>
                  )}
                  <span className="ml-auto">{formatTimeAgo(t.updated_at)}</span>
                </div>
                {t.active_sos_count > 0 && (
                  <p className="text-xs text-red-600 font-bold mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> SOS ACTIVE
                  </p>
                )}
              </button>
            ))}
            {liveTourists.length === 0 && !isLoading && (
              <div className="p-6 text-center text-sm text-on-surface-variant">
                No tourists with active tracking
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
