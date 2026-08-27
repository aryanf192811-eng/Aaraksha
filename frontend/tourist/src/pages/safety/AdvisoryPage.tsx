// src/pages/safety/AdvisoryPage.tsx
// Travel advisories by destination — TSI factors, weather risk, govt advisories
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ComponentType } from 'react'
import {
  ArrowLeft, Search, AlertTriangle, Shield, MapPin, Activity,
  CheckCircle2, ShieldAlert, Ban, ClipboardList, HeartPulse, Users,
} from 'lucide-react'
import { Input } from '../../components/ui/input'
import { WeatherBadge } from '../../components/shared'
import destinationApi from '../../api/destination.api'
import { getDestinationImage } from '../../lib/destinationImages'
import { tEnum } from '../../lib/i18nEnums'
import { cn } from '../../lib/utils'

const ZONE_CONFIG: Record<string, { icon: ComponentType<{ className?: string }>; color: string }> = {
  SAFE:         { icon: CheckCircle2, color: 'bg-tsi-low/10 border-tsi-low/30 text-tsi-low' },
  CAUTION:      { icon: AlertTriangle, color: 'bg-primary/10 border-primary/20 text-primary' },
  HIGH_RISK:    { icon: ShieldAlert,  color: 'bg-tsi-high/10 border-tsi-high/30 text-tsi-high' },
  RESTRICTED:   { icon: Ban,          color: 'bg-sos/10 border-sos/30 text-sos-dark' },
  ILP_REQUIRED: { icon: ClipboardList, color: 'bg-purple-50 border-purple-200 text-purple-700' },
}

export default function AdvisoryPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [selectedZone, setSelectedZone] = useState('')

  const { data: destinations, isLoading } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => destinationApi.getAll().then(r => r.data.data),
    staleTime: 5 * 60_000,
  })

  // Live "how many tourists are actually there right now" — the same
  // aggregation the govt Command Center's Risk Overview shows, surfaced
  // here too since it's genuinely useful trip-planning context, not just
  // an ops-dashboard number: knowing 8 other travelers are currently in a
  // HIGH_RISK zone (2 of them flagged low-safety-score) is a real signal.
  const { data: riskOverview } = useQuery({
    queryKey: ['destinations', 'risk-overview'],
    queryFn: () => destinationApi.getRiskOverview().then(r => r.data.data),
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
  })
  const activityByDest = new Map((riskOverview || []).map(r => [r.destinationId ?? r.city.toUpperCase(), r]))

  const filtered = (destinations || []).filter((d) => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.state.toLowerCase().includes(search.toLowerCase())
    const matchZone = !selectedZone || d.zone_type === selectedZone
    return matchSearch && matchZone
  })

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6 text-on-surface" /></button>
          <div>
            <h1 className="text-xl font-black text-on-surface">{t('advisory.title')}</h1>
            <p className="text-xs text-on-surface-variant">{t('advisory.subtitle')}</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <Input placeholder={t('advisory.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-surface-container border-outline-variant" />
        </div>
      </div>

      {/* Zone filter */}
      <div className="px-5 mt-4 flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setSelectedZone('')}
          className={cn('px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all',
            !selectedZone ? 'bg-on-surface text-surface border-on-surface' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant')}>
          {t('advisory.all')}
        </button>
        {Object.entries(ZONE_CONFIG).map(([zone, { icon: Icon, color }]) => (
          <button key={zone} onClick={() => setSelectedZone(zone === selectedZone ? '' : zone)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1',
              selectedZone === zone ? `${color} border` : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant')}>
            <Icon className="w-3.5 h-3.5" /> {tEnum(t, 'zoneType', zone)}
          </button>
        ))}
      </div>

      <div className="px-5 mt-4 space-y-3">
        {isLoading && [1, 2, 3].map(i => <div key={i} className="h-32 bg-surface-container-lowest rounded-2xl animate-pulse" />)}

        {filtered.map((dest) => {
          const zone = ZONE_CONFIG[dest.zone_type] || ZONE_CONFIG.SAFE
          const ZoneIcon = zone.icon
          const activity = activityByDest.get(dest.id) ?? activityByDest.get(dest.name.toUpperCase())
          return (
            <div key={dest.id} className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-start gap-3 p-5 pb-3">
                <img src={getDestinationImage(dest.name, { w: 200, q: 78 })} alt=""
                  className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-black text-on-surface text-base truncate">{dest.name}</h3>
                    <p className="text-xs text-on-surface-variant">{dest.state}</p>
                  </div>
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 flex-shrink-0', zone.color)}>
                    <ZoneIcon className="w-3.5 h-3.5" /> {tEnum(t, 'zoneType', dest.zone_type)}
                  </span>
                </div>
              </div>

              <div className="px-5 pb-5">
                {activity && activity.total > 0 && (
                  <div className="bg-surface-container rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0" />
                    <p className="text-xs text-on-surface-variant">
                      <span className="font-bold text-on-surface">{t('advisory.touristsHereNow', { count: activity.total })}</span> {t('advisory.hereRightNow')}
                      {activity.highRisk > 0 && (
                        <span className="text-tsi-high font-semibold"> {t('advisory.flaggedHighRisk', { count: activity.highRisk })}</span>
                      )}
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-outline-variant overflow-hidden mb-3">
                  <div className="grid grid-cols-3 divide-x divide-outline-variant">
                    <div className="p-2.5 text-center">
                      <Activity className="w-4 h-4 text-on-surface-variant mx-auto mb-1" />
                      <p className="text-xs font-bold text-on-surface">{tEnum(t, 'difficulty', dest.difficulty)}</p>
                      <p className="text-[10px] text-on-surface-variant">{t('advisory.difficulty')}</p>
                    </div>
                    <div className="p-2.5 text-center">
                      <MapPin className="w-4 h-4 text-on-surface-variant mx-auto mb-1" />
                      <p className="text-xs font-bold text-on-surface">{dest.altitude_m > 0 ? `${dest.altitude_m}m` : t('advisory.lowAltitude')}</p>
                      <p className="text-[10px] text-on-surface-variant">{t('advisory.altitude')}</p>
                    </div>
                    <div className="p-2.5 text-center">
                      <Shield className="w-4 h-4 text-on-surface-variant mx-auto mb-1" />
                      <p className="text-xs font-bold text-on-surface">{tEnum(t, 'connectivity', dest.connectivity)}</p>
                      <p className="text-[10px] text-on-surface-variant">{t('advisory.signal')}</p>
                    </div>
                  </div>
                </div>

                {dest.weather_condition && (
                  <div className="mb-2">
                    <WeatherBadge condition={dest.weather_condition} tempCelsius={dest.temp_celsius} riskReason={dest.risk_reason} />
                  </div>
                )}

                {dest.ilp_required && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-2 mb-2">
                    <p className="text-xs font-bold text-purple-700 flex items-center gap-1">
                      <ClipboardList className="w-3.5 h-3.5" /> {t('advisory.ilpRequiredTitle')}
                    </p>
                    <p className="text-[10px] text-purple-600 mt-0.5">{t('advisory.ilpRequiredDesc')}</p>
                  </div>
                )}

                {dest.govt_advisory && (
                  <div className="bg-primary/10 rounded-xl p-3">
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-primary">{dest.govt_advisory}</p>
                    </div>
                  </div>
                )}

                {dest.nearest_hospital_km && (
                  <p className="text-xs text-on-surface-variant mt-2 flex items-center gap-1">
                    <HeartPulse className="w-3 h-3" /> {dest.nearest_hospital_name || t('advisory.nearestHospitalFallback')}: {dest.nearest_hospital_km}km
                    {dest.nearest_hospital_phone && ` · ${dest.nearest_hospital_phone}`}
                  </p>
                )}
              </div>
            </div>
          )
        })}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-10 bg-surface-container-lowest rounded-2xl shadow-sm">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Search className="w-7 h-7 text-primary" />
            </div>
            <p className="font-bold text-on-surface">{t('advisory.noDestinationsFound')}</p>
            <p className="text-sm text-on-surface-variant">{t('advisory.tryDifferentSearch')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
