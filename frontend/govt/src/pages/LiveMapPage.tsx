// src/pages/LiveMapPage.tsx — real-time ops map with tourist status markers
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, Battery } from 'lucide-react'
import govtApi from '../api/govt.api'
import { cn, formatTimeAgo } from '../lib/utils'
import type { LiveTourist } from '../types/api.types'

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

export default function LiveMapPage() {
  const [selectedTourist, setSelectedTourist] = useState<LiveTourist | null>(null)

  const { data: tourists, isLoading } = useQuery({
    queryKey: ['govt', 'tourists', 'live'],
    queryFn: () => govtApi.getLiveTourists().then(r => r.data.data),
    refetchInterval: 15_000,
  })

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
    <div className="h-screen flex flex-col">
      <div className="bg-surface-container-lowest border-b border-outline-variant px-6 py-4 flex items-center gap-4 shadow-sm">
        <h1 className="text-xl font-black text-on-surface">Live Tourist Map</h1>
        <div className="flex items-center gap-4 ml-auto text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-sos" />
            <span className="text-on-surface-variant font-medium">{activeSOS} SOS active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-on-surface-variant font-medium">{liveTourists.length} tracked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-on-surface-variant">Live · updates every 15s</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <MapContainer center={mapCenter} zoom={7} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
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
          </MapContainer>

          {isLoading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface-container-lowest rounded-full px-4 py-2 shadow-md text-sm font-medium text-on-surface-variant">
              Loading live data...
            </div>
          )}
        </div>

        <div className="w-72 bg-surface-container-lowest border-l border-outline-variant overflow-y-auto">
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
