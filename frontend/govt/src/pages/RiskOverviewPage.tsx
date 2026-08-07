// src/pages/RiskOverviewPage.tsx
import { useQuery } from '@tanstack/react-query'
import { Shield } from 'lucide-react'
import govtApi from '../api/govt.api'
import { cn } from '../lib/utils'

const ZONE_COLORS: Record<string, string> = {
  SAFE: 'text-green-600 bg-green-50', CAUTION: 'text-amber-600 bg-amber-50',
  HIGH_RISK: 'text-orange-600 bg-orange-50', RESTRICTED: 'text-red-600 bg-red-50',
  ILP_REQUIRED: 'text-purple-600 bg-purple-50',
}

export default function RiskOverviewPage() {
  const { data: riskData, isLoading } = useQuery({
    queryKey: ['govt', 'risk-overview'],
    queryFn: () => govtApi.getRiskOverview().then(r => r.data.data),
    refetchInterval: 60_000,
  })

  const risks = riskData || []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-on-surface">Risk Overview</h1>
        <p className="text-on-surface-variant text-sm">Destination-level tourist risk assessment</p>
      </div>

      {isLoading && (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface-container-lowest rounded-xl animate-pulse" />)}</div>
      )}

      {risks.length === 0 && !isLoading && (
        <div className="bg-surface-container-lowest rounded-xl p-10 text-center">
          <Shield className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-bold text-on-surface">No active risk zones</p>
          <p className="text-sm text-on-surface-variant">All tracked tourists are in safe zones</p>
        </div>
      )}

      <div className="grid gap-4">
        {risks.map((zone, i) => (
          <div key={`${zone.city}-${i}`} className="bg-surface-container-lowest rounded-xl shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-black text-on-surface text-lg">{zone.city}</h3>
                <p className="text-sm text-on-surface-variant">{zone.state}</p>
              </div>
              <span className={cn('text-xs font-bold px-3 py-1.5 rounded-full', ZONE_COLORS[zone.zoneType] || ZONE_COLORS.SAFE)}>
                {zone.zoneType?.replace('_', ' ')}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-xl font-black text-on-surface">{zone.total}</p>
                <p className="text-xs text-on-surface-variant">Total</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-blue-600">{zone.solo}</p>
                <p className="text-xs text-on-surface-variant">Solo</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-orange-600">{zone.highRisk}</p>
                <p className="text-xs text-on-surface-variant">High Risk</p>
              </div>
              <div className="text-center">
                <p className={cn('text-xl font-black',
                  (zone.weather?.weather_risk === 'HIGH' || zone.weather?.weather_risk === 'EXTREME') ? 'text-red-600' : 'text-green-600'
                )}>
                  {zone.weather?.weather_condition ?? 'CLEAR'}
                </p>
                <p className="text-xs text-on-surface-variant">Weather</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
