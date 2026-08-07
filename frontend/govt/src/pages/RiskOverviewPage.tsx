// src/pages/RiskOverviewPage.tsx
// Redesign: HD destination photography, a per-zone risk gauge, live weather,
// and an expandable detail panel (hospital distance, altitude, govt
// advisory) pulled from the destinations catalog — all data the backend
// already had but never surfaced (see govt.service.js getRiskOverview fix).
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, ChevronDown, MapPin, HeartPulse, Mountain, Users, AlertTriangle, FileText } from 'lucide-react'
import { Sun, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning } from 'lucide-react'
import govtApi, { type RiskOverviewEntry } from '../api/govt.api'
import { getDestinationImage } from '../lib/destinationImages'
import { cn } from '../lib/utils'

const ZONE_META: Record<string, { label: string; badge: string; ring: string }> = {
  SAFE:         { label: 'Safe',          badge: 'bg-emerald-100 text-emerald-700', ring: '#10b981' },
  CAUTION:      { label: 'Caution',       badge: 'bg-amber-100 text-amber-700',     ring: '#f59e0b' },
  HIGH_RISK:    { label: 'High Risk',     badge: 'bg-orange-100 text-orange-700',   ring: '#ea580c' },
  RESTRICTED:   { label: 'Restricted',    badge: 'bg-red-100 text-red-700',         ring: '#dc2626' },
  ILP_REQUIRED: { label: 'ILP Required',  badge: 'bg-purple-100 text-purple-700',   ring: '#7c3aed' },
}

const WEATHER_ICONS: Record<string, typeof Sun> = {
  CLEAR: Sun, CLOUDY: Cloud, RAIN: CloudRain, HEAVY_RAIN: CloudRain,
  STORM: CloudLightning, SNOW: CloudSnow, FOG: CloudFog,
}

const FILTERS = ['ALL', 'SAFE', 'CAUTION', 'HIGH_RISK', 'RESTRICTED', 'ILP_REQUIRED'] as const

// Composite 0-100 zone risk score from zone classification, live tourist
// mix, and current weather risk — the backend only returns each factor
// independently, so this rolls them into one number for the gauge.
function computeRiskScore(zone: RiskOverviewEntry): number {
  let score = 100
  if (zone.zoneType === 'CAUTION') score -= 15
  if (zone.zoneType === 'HIGH_RISK') score -= 35
  if (zone.zoneType === 'RESTRICTED') score -= 45
  if (zone.ilpRequired) score -= 8
  if (zone.weather?.weather_risk === 'MODERATE') score -= 10
  if (zone.weather?.weather_risk === 'HIGH') score -= 20
  if (zone.weather?.weather_risk === 'EXTREME') score -= 30
  score -= zone.highRisk * 6
  return Math.max(4, Math.min(100, score))
}

function RiskGauge({ score, color }: { score: number; color: string }) {
  const r = 26
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - score / 100)
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-black text-white drop-shadow">{score}</span>
      </div>
    </div>
  )
}

export default function RiskOverviewPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: riskData, isLoading } = useQuery({
    queryKey: ['govt', 'risk-overview'],
    queryFn: () => govtApi.getRiskOverview().then(r => r.data.data),
    refetchInterval: 60_000,
  })

  const risks = useMemo(() => {
    const all = riskData || []
    const filtered = filter === 'ALL' ? all : all.filter(z => z.zoneType === filter)
    return [...filtered].sort((a, b) => computeRiskScore(a) - computeRiskScore(b))
  }, [riskData, filter])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-on-surface">Risk Overview</h1>
          <p className="text-on-surface-variant text-sm">Destination-level tourist risk assessment, live weather, and local emergency infrastructure</p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-colors border',
              filter === f
                ? 'bg-primary-dark text-white border-primary-dark'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary-dark/40'
            )}>
            {f === 'ALL' ? 'All Zones' : (ZONE_META[f]?.label ?? f)}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid md:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-surface-container-lowest rounded-2xl animate-pulse" />)}</div>
      )}

      {risks.length === 0 && !isLoading && (
        <div className="bg-surface-container-lowest rounded-xl p-10 text-center">
          <Shield className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-bold text-on-surface">No active risk zones</p>
          <p className="text-sm text-on-surface-variant">
            {filter === 'ALL' ? 'All tracked tourists are in safe zones' : 'No destinations currently match this filter'}
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {risks.map((zone) => {
          const meta = ZONE_META[zone.zoneType] || ZONE_META.SAFE
          const score = computeRiskScore(zone)
          const WeatherIcon = WEATHER_ICONS[zone.weather?.weather_condition || 'CLEAR'] || Sun
          const key = zone.destinationId || zone.city
          const isOpen = expanded === key

          return (
            <div key={key} className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant">
              {/* HD photo header */}
              <div className="relative h-40">
                <img src={getDestinationImage(zone.city, { w: 800 })} alt={zone.city}
                  className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-slate-950/10" />
                <div className="relative h-full flex flex-col justify-between p-4">
                  <div className="flex items-start justify-between">
                    <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', meta.badge)}>{meta.label}</span>
                    <RiskGauge score={score} color={meta.ring} />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-xl leading-tight">{zone.city}</h3>
                    <p className="text-xs text-white/75 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {zone.state}
                      {zone.weather && (
                        <span className="ml-2 flex items-center gap-1">
                          <WeatherIcon className="w-3.5 h-3.5" /> {zone.weather.temp_celsius}°C · {zone.weather.weather_condition}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2 p-4 pb-3">
                <div className="text-center">
                  <p className="text-lg font-black text-on-surface flex items-center justify-center gap-1"><Users className="w-3.5 h-3.5 text-on-surface-variant" />{zone.total}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Tourists</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-blue-600">{zone.solo}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Solo</p>
                </div>
                <div className="text-center">
                  <p className={cn('text-lg font-black', zone.highRisk > 0 ? 'text-orange-600' : 'text-on-surface')}>{zone.highRisk}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">High TSI</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-on-surface">{zone.altitudeM != null ? `${zone.altitudeM}m` : '—'}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Altitude</p>
                </div>
              </div>

              {/* Expandable detail */}
              <button onClick={() => setExpanded(isOpen ? null : key)}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs font-semibold text-primary-dark border-t border-outline-variant hover:bg-surface-container transition-colors">
                {isOpen ? 'Hide details' : 'View emergency infrastructure & advisory'}
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-outline-variant bg-surface-container/40">
                  {zone.description && (
                    <p className="text-xs text-on-surface-variant italic pt-3">{zone.description}</p>
                  )}
                  <div className="flex items-start gap-2 text-xs">
                    <HeartPulse className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-on-surface">
                      {zone.nearestHospitalName || 'No hospital on record'}
                      {zone.nearestHospitalKm && <span className="text-on-surface-variant"> · {zone.nearestHospitalKm} km away</span>}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Mountain className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                    <span className="text-on-surface">
                      {zone.difficulty ? `${zone.difficulty} difficulty` : 'Difficulty not rated'} · {zone.connectivity} connectivity
                    </span>
                  </div>
                  {zone.govtAdvisory && (
                    <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span className="text-amber-800">{zone.govtAdvisory}</span>
                    </div>
                  )}
                  {!zone.govtAdvisory && (
                    <div className="flex items-start gap-2 text-xs text-on-surface-variant">
                      <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> No standing advisory for this destination.
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
