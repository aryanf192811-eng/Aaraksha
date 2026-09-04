// src/components/shared/StopDetailSheet.tsx
// Tapping a stop card in TripDetailPage's Itinerary tab opens this instead
// of navigating away — full destination info (already fetched via the
// existing GET /destinations/:id, see destination.api.ts) plus every
// curated way to reach it from the previous stop (new routes-between
// endpoint, see travelPlanner.service.js#getRoutesBetween), rendered with
// the same leg-row visual language JourneyResultCard.tsx established for
// the Travel Assistant's own itinerary cards — one route vocabulary
// across the app, not two.
import { useQuery } from '@tanstack/react-query'
import {
  X, MapPin, Train, Plane, Bus, Car, Ship, Waypoints, Clock, IndianRupee, Star, CalendarDays,
} from 'lucide-react'
import { useDragSheet } from '../../hooks/useDragSheet'
import { formatINR } from '../../lib/utils'
import { useTranslation } from 'react-i18next'
import destinationApi from '../../api/destination.api'
import travelPlannerApi from '../../api/travelPlanner.api'
import { getDestinationImage } from '../../lib/destinationImages'
import { DestinationInfo } from './DestinationInfo'
import type { Stop } from '../../types/api.types'

const MODE_ICON: Record<string, typeof Train> = {
  TRAIN: Train, FLIGHT: Plane, BUS: Bus, SHARED_TAXI: Car, LOCAL_TRANSPORT: Car,
  FERRY: Ship, MIXED: Waypoints,
}
const MODE_LABEL: Record<string, string> = {
  TRAIN: 'Train', FLIGHT: 'Flight', BUS: 'Bus', SHARED_TAXI: 'Shared taxi',
  LOCAL_TRANSPORT: 'Local transport', FERRY: 'Ferry', MIXED: 'Mixed (road + ferry)',
}

function fmtDuration(min: number | null) {
  if (min == null) return 'time varies'
  const h = Math.round(min / 60)
  return h < 1 ? `${min}m` : `~${h}h`
}

export function StopDetailSheet({ open, stop, previousStop, onClose }: {
  open: boolean
  stop: Stop | null
  previousStop: Stop | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { handleProps, sheetStyle } = useDragSheet({ onClose })

  const { data: destination, isLoading: loadingDestination } = useQuery({
    queryKey: ['destination', stop?.destinationId],
    queryFn: () => destinationApi.getById(stop!.destinationId!).then((r) => r.data.data),
    enabled: open && !!stop?.destinationId,
  })

  const { data: routesData, isLoading: loadingRoutes } = useQuery({
    queryKey: ['routes-between', previousStop?.destinationId, stop?.destinationId],
    queryFn: () => travelPlannerApi.getRoutesBetween(previousStop!.destinationId!, stop!.destinationId!).then((r) => r.data.data),
    enabled: open && !!previousStop?.destinationId && !!stop?.destinationId,
  })

  if (!open || !stop) return null

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center sm:justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={sheetStyle}
        className="w-full sm:w-[440px] sm:rounded-3xl bg-surface rounded-t-3xl shadow-2xl h-[85vh] max-h-[720px] flex flex-col overflow-hidden">
        <div {...handleProps} className="flex-shrink-0 pt-2.5 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-outline-variant rounded-full" />
        </div>

        {/* Header — same hero-photo language as the trip page itself */}
        <div className="relative h-36 flex-shrink-0">
          <img src={getDestinationImage(stop.city, { w: 800, q: 78 })} alt={stop.city}
            className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
          <button onClick={onClose} aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="font-display text-xl font-black text-white drop-shadow-md">{stop.city}</h2>
            <p className="text-xs text-white/85 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> {stop.state}
              <span aria-hidden>·</span>
              <CalendarDays className="w-3 h-3" /> {t('tripDetail.dayCount', { count: stop.days })}
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
          {!stop.destinationId ? (
            // Manually-added stop, no curated destination record to look up —
            // degrade to what the stop object itself already carries rather
            // than showing a spinner that never resolves.
            <p className="text-sm text-on-surface-variant">
              This stop was added manually and isn't linked to Aaraksha's destination data yet, so extended details and route options aren't available for it.
            </p>
          ) : loadingDestination ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-surface-container-high rounded w-full" />
              <div className="h-3 bg-surface-container-high rounded w-5/6" />
              <div className="h-3 bg-surface-container-high rounded w-3/4" />
            </div>
          ) : destination ? (
            <DestinationInfo destination={destination} />
          ) : null}

          {/* How to reach — only when there's a previous stop to route from */}
          {previousStop?.destinationId && stop.destinationId && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                From {previousStop.city}
              </p>
              {loadingRoutes ? (
                <div className="h-14 bg-surface-container-high rounded-xl animate-pulse" />
              ) : routesData?.routes.length ? (
                <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest divide-y divide-outline-variant/60 overflow-hidden">
                  {routesData.routes.map((leg, i) => {
                    const Icon = MODE_ICON[leg.mode] || Car
                    return (
                      <div key={i} className="flex items-center gap-3 px-3.5 py-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-on-surface">{MODE_LABEL[leg.mode] || leg.mode}</p>
                          <p className="text-xs text-on-surface-variant flex items-center gap-1.5 flex-wrap">
                            <Clock className="w-3 h-3" /> {fmtDuration(leg.durationMinutes)}
                            <span aria-hidden>·</span>
                            <IndianRupee className="w-3 h-3" />
                            {leg.costMinInr != null ? `${formatINR(leg.costMinInr)}–${formatINR(leg.costMaxInr ?? leg.costMinInr).replace('₹', '')}` : '—'}
                            {leg.estimated && <span className="text-[10px] uppercase tracking-wide font-bold text-amber-600 ml-1">estimated</span>}
                          </p>
                          {leg.notes && <p className="text-[11px] text-on-surface-variant/80 mt-0.5 leading-snug">{leg.notes}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )}

          {/* Real traveller reviews, when any exist */}
          {routesData?.reviewSummary && (
            <div className="flex items-center gap-2 text-xs bg-surface-container px-3 py-2 rounded-xl">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
              <span className="text-on-surface-variant">
                {routesData.reviewSummary.avgRating}/5 from {routesData.reviewSummary.reviewCount} traveller{routesData.reviewSummary.reviewCount === 1 ? '' : 's'}
                {routesData.reviewSummary.avgCostInr != null && ` · avg. spend ${formatINR(routesData.reviewSummary.avgCostInr)}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
