// src/components/shared/JourneyRiskGraph.tsx
// The trip-level TSI was always "worst stop wins" — one number for the
// whole itinerary, no visibility into which stop or why. stopRisks (see
// tsi.service.js#calculateStopRisk) computes the identical per-stop math
// the trip score already relies on; this just keeps it instead of
// discarding it, so a tourist can see exactly where a multi-stop trip
// turns dangerous instead of being told only the worst-case number.
import { useState } from 'react'
import { ChevronDown, MapPin, Wifi, HeartPulse, Mountain, ShieldAlert, Compass, CloudRain } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { StopRisk } from '../../types/api.types'

function riskBarColor(score: number) {
  if (score >= 80) return 'bg-tsi-low'
  if (score >= 60) return 'bg-amber-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-sos'
}
function riskTextColor(score: number) {
  if (score >= 80) return 'text-tsi-low'
  if (score >= 60) return 'text-amber-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-sos'
}

const DETAIL_ROWS: { key: keyof StopRisk; icon: typeof Wifi; label: string; format: (r: StopRisk) => string | null }[] = [
  { key: 'connectivity', icon: Wifi, label: 'Connectivity', format: (r) => r.connectivity },
  { key: 'altitudeM', icon: Mountain, label: 'Altitude', format: (r) => r.altitudeM ? `${r.altitudeM}m` : null },
  { key: 'hospitalKm', icon: HeartPulse, label: 'Medical access', format: (r) => r.hospitalKm != null ? `${r.hospitalKm} km to hospital` : null },
  { key: 'zoneType', icon: ShieldAlert, label: 'Zone', format: (r) => r.zoneType ? r.zoneType.replace(/_/g, ' ') : null },
  { key: 'difficulty', icon: Compass, label: 'Difficulty', format: (r) => r.difficulty },
  { key: 'weatherCondition', icon: CloudRain, label: 'Weather', format: (r) => r.weatherCondition },
]

function StopRow({ stop, isLast }: { stop: StopRisk; isLast: boolean }) {
  const [open, setOpen] = useState(false)
  const riskFactorCount = Object.values(stop.factors).filter(f => f < 0).length

  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 py-2.5 text-left">
        <MapPin className={cn('w-4 h-4 flex-shrink-0', riskTextColor(stop.score))} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-on-surface truncate">{stop.city}</span>
            <span className={cn('text-xs font-bold flex-shrink-0', riskTextColor(stop.score))}>{stop.label}</span>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-1.5">
            <div className={cn('h-1.5 rounded-full transition-all', riskBarColor(stop.score))} style={{ width: `${stop.score}%` }} />
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-on-surface-variant flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="pl-7 pb-3 space-y-1.5">
          {DETAIL_ROWS.map(({ key, icon: Icon, label, format }) => {
            const value = format(stop)
            if (!value) return null
            return (
              <div key={key} className="flex items-center gap-2 text-xs">
                <Icon className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
                <span className="text-on-surface-variant">{label}:</span>
                <span className="font-semibold text-on-surface capitalize">{value.toLowerCase()}</span>
              </div>
            )
          })}
          {riskFactorCount > 0 && (
            <p className="text-xs text-amber-700 font-semibold pt-1">⚠ {riskFactorCount} risk factor{riskFactorCount === 1 ? '' : 's'} detected here</p>
          )}
        </div>
      )}

      {!isLast && <div className="ml-2 border-l-2 border-dashed border-outline-variant h-2" />}
    </div>
  )
}

export function JourneyRiskGraph({ stopRisks }: { stopRisks: StopRisk[] }) {
  if (stopRisks.length < 2) return null // a graph needs more than one point to be meaningful

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant p-5">
      <h3 className="font-bold text-on-surface mb-1">Journey Risk Profile</h3>
      <p className="text-xs text-on-surface-variant mb-3">How risk changes stop by stop — tap a stop for details</p>
      <div>
        {stopRisks.map((stop, i) => (
          <StopRow key={`${stop.city}-${i}`} stop={stop} isLast={i === stopRisks.length - 1} />
        ))}
      </div>
    </div>
  )
}
