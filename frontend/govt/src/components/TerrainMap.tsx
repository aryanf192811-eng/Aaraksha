// src/components/TerrainMap.tsx
// Real 3D elevation terrain for the govt Live Map — answers the "flat 2D
// mapping" gap from the SIH competitive research without CesiumJS's
// weight or a paid Mapbox/MapTiler API key. Two free, keyless raster
// sources do the whole thing: the same OpenStreetMap tile server the 2D
// Leaflet map already uses for imagery, and AWS's public "Terrarium"
// elevation tiles (Mapzen's original open elevation dataset, now hosted
// as an AWS Open Data set, no signup) for the raster-dem terrain source
// MapLibre GL JS extrudes into real 3D relief — genuinely useful for a
// dispatcher checking whether a mountain ridge separates a rescuer from
// an active SOS, not a decorative flourish.
import { useEffect, useRef, useState } from 'react'
// MapLibre GL JS v5 has no default export — every symbol (including the
// `Map` class itself) is a named export, aliased here to avoid colliding
// with the built-in global Map.
import {
  Map as MapLibreMap, Marker, NavigationControl, Popup,
  type StyleSpecification, type GeoJSONSource,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Loader2 } from 'lucide-react'
import type { LiveTourist } from '../types/api.types'
import type { ActiveRescuer } from '../api/govt.api'

const TERRAIN_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
    terrain: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 15,
    },
  },
  layers: [
    { id: 'osm-layer', type: 'raster', source: 'osm' },
    { id: 'hillshade-layer', type: 'hillshade', source: 'terrain', paint: { 'hillshade-exaggeration': 0.5 } },
  ],
  terrain: { source: 'terrain', exaggeration: 1.6 },
}

interface TerrainMapProps {
  tourists: LiveTourist[]
  rescuers: ActiveRescuer[]
  center: [number, number] // [lng, lat] — MapLibre's own axis order, opposite of Leaflet's [lat, lng] used elsewhere in this app
  zoom: number
}

function markerEl(color: string, pulse: boolean) {
  const el = document.createElement('div')
  el.style.cssText = `width:20px;height:20px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);${pulse ? 'animation:terrain-pulse 1.5s infinite;' : ''}`
  return el
}

export function TerrainMap({ tourists, rescuers, center, zoom }: TerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const [loading, setLoading] = useState(true)

  // Map instance itself: created once, torn down on unmount. Marker/route
  // data updates (below) mutate the existing instance instead of
  // recreating it, so panning/pitch/zoom the operator set isn't reset
  // every time a tourist's position ticks.
  useEffect(() => {
    if (!containerRef.current) return
    const map = new MapLibreMap({
      container: containerRef.current,
      style: TERRAIN_STYLE,
      center,
      zoom,
      pitch: 60,
      bearing: -20,
      maxPitch: 85,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
    map.on('load', () => setLoading(false))
    // MapLibre's 'load' event only fires once every style resource has
    // resolved — a single flaky request to either free tile source (OSM
    // imagery or the AWS Terrarium elevation tiles) leaves it never firing
    // at all, even though the map is otherwise rendering fine underneath.
    // That left the loading overlay stuck indefinitely with no visible
    // error. A tile error clears the spinner too (the map already
    // gracefully renders around a missing tile) and a hard timeout covers
    // any other reason 'load' might not fire, so the operator is never
    // blocked from a usable map by a single bad request.
    map.on('error', () => setLoading(false))
    const timeout = setTimeout(() => setLoading(false), 8000)
    mapRef.current = map

    return () => { map.remove(); mapRef.current = null; clearTimeout(timeout) }
    // Intentionally init once — center/zoom below only apply on first
    // mount, matching Leaflet's own MapContainer behavior elsewhere in
    // this app (re-centering happens via the explicit Recenter control,
    // not by fighting the operator's own pan/zoom on every data refresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Markers + rescuer routes: rebuilt on every tourists/rescuers update,
  // cheap enough at this data volume and simpler than diffing.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const applyMarkers = () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      tourists.forEach((t) => {
        if (!Number.isFinite(t.latitude) || !Number.isFinite(t.longitude)) return
        const color = t.active_sos_count > 0 ? '#ef4444' : t.active_dms_count > 0 ? '#f59e0b' : '#10b981'
        const marker = new Marker({ element: markerEl(color, t.active_sos_count > 0) })
          .setLngLat([t.longitude, t.latitude])
          .setPopup(new Popup({ offset: 14 }).setHTML(
            `<strong>${t.full_name}</strong><br/><span style="font-size:11px;color:#64748b">${t.active_sos_count > 0 ? 'SOS ACTIVE' : t.tsi_label || ''}</span>`
          ))
          .addTo(map)
        markersRef.current.push(marker)
      })

      rescuers.forEach((r) => {
        const lat = Number(r.latitude), lng = Number(r.longitude)
        const sosLat = Number(r.sos_latitude), sosLng = Number(r.sos_longitude)
        if (![lat, lng, sosLat, sosLng].every(Number.isFinite)) return
        const marker = new Marker({ element: markerEl('#0f766e', false) })
          .setLngLat([lng, lat])
          .setPopup(new Popup({ offset: 14 }).setHTML(
            `<strong>${r.rescuer_name}</strong><br/><span style="font-size:11px;color:#64748b">→ ${r.tourist_name} (${r.status})</span>`
          ))
          .addTo(map)
        markersRef.current.push(marker)

        const routeId = `route-${r.assignment_id}`
        const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: [[lng, lat], [sosLng, sosLat]] },
        }
        const existing = map.getSource(routeId) as GeoJSONSource | undefined
        if (existing) {
          existing.setData(geojson)
        } else {
          map.addSource(routeId, { type: 'geojson', data: geojson })
          map.addLayer({ id: routeId, type: 'line', source: routeId,
            paint: { 'line-color': '#0f766e', 'line-width': 3, 'line-dasharray': [1, 1.5] } })
        }
      })
    }

    if (map.isStyleLoaded()) applyMarkers()
    else map.once('load', applyMarkers)
  }, [tourists, rescuers])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 bg-surface-container-lowest/80 flex items-center justify-center gap-2 text-sm font-semibold text-on-surface-variant">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading terrain…
        </div>
      )}
      <style>{`@keyframes terrain-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.5); } 50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); } }`}</style>
    </div>
  )
}
