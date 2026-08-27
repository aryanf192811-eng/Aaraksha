// src/components/shared/ExploreDestinations.tsx
// The dashboard's discovery surface — real destination photography, a
// working search + safety-zone filter (backed by the same params
// destination.api.ts already exposes), and a generous 2-column photo-card
// grid. The zone filter is deliberately Aaraksha's own angle on the
// generic "category pills" pattern: filter by how safe a place currently
// is, not by a generic tag — that's the actual point of difference.
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, MapPin } from 'lucide-react'
import destinationApi from '../../api/destination.api'
import { getDestinationImage } from '../../lib/destinationImages'
import { cn } from '../../lib/utils'
import { ZONE_TYPES } from '../../constants/enums'

const ZONE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  [ZONE_TYPES.SAFE]:         { bg: 'bg-green-500',  text: 'text-white', label: 'Safe' },
  [ZONE_TYPES.CAUTION]:      { bg: 'bg-amber-500',  text: 'text-white', label: 'Caution' },
  [ZONE_TYPES.HIGH_RISK]:    { bg: 'bg-orange-500', text: 'text-white', label: 'High Risk' },
  [ZONE_TYPES.RESTRICTED]:   { bg: 'bg-red-500',    text: 'text-white', label: 'Restricted' },
  [ZONE_TYPES.ILP_REQUIRED]: { bg: 'bg-purple-500', text: 'text-white', label: 'ILP Required' },
}

const ZONE_PILLS = [
  { key: 'ALL', label: 'All' },
  { key: ZONE_TYPES.SAFE, label: 'Safe' },
  { key: ZONE_TYPES.CAUTION, label: 'Caution' },
  { key: ZONE_TYPES.HIGH_RISK, label: 'High Risk' },
  { key: ZONE_TYPES.ILP_REQUIRED, label: 'ILP Required' },
]

export function ExploreDestinations() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [zone, setZone] = useState('ALL')

  const { data } = useQuery({
    queryKey: ['destinations', 'explore'],
    queryFn: () => destinationApi.getAll().then(r => r.data.data),
    staleTime: 5 * 60_000,
  })

  const destinations = useMemo(() => {
    const all = [...(data || [])].sort((a, b) => b.popularity_index - a.popularity_index)
    return all.filter((d) => {
      const matchesZone = zone === 'ALL' || d.zone_type === zone
      const matchesQuery = !query.trim() || d.name.toLowerCase().includes(query.trim().toLowerCase()) || d.state.toLowerCase().includes(query.trim().toLowerCase())
      return matchesZone && matchesQuery
    })
  }, [data, zone, query])

  if (!data) return null

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-on-surface-variant" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('dashboard.searchPlaceholder')}
          className="w-full h-12 pl-11 pr-4 rounded-2xl bg-surface-container-lowest border border-outline-variant text-sm placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Zone filter pills — Aaraksha's own take on "category" filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 mb-4 scrollbar-none">
        {ZONE_PILLS.map((p) => (
          <button
            key={p.key}
            onClick={() => setZone(p.key)}
            className={cn(
              'flex-shrink-0 px-4 h-9 rounded-full text-sm font-bold whitespace-nowrap transition-colors cursor-pointer',
              zone === p.key
                ? 'bg-on-surface text-surface'
                : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {destinations.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-8">{t('dashboard.noDestinationsFound')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {destinations.slice(0, 8).map((dest) => {
            const badge = ZONE_BADGE[dest.zone_type] || ZONE_BADGE[ZONE_TYPES.SAFE]
            return (
              <button
                key={dest.id}
                onClick={() => navigate('/trips/new', { state: { destinationName: dest.name } })}
                className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-sm active:scale-[0.97] transition-transform cursor-pointer text-left"
              >
                <img
                  src={getDestinationImage(dest.name, { w: 500, q: 75 })}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 photo-scrim" />
                <span className={cn('absolute top-2.5 left-2.5 text-[10px] font-bold px-2.5 py-1 rounded-full', badge.bg, badge.text)}>
                  {badge.label}
                </span>
                <div className="absolute bottom-0 left-0 right-0 p-3.5">
                  <p className="font-display font-bold text-white text-base leading-tight">{dest.name}</p>
                  <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {dest.state}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
