// src/pages/DashboardPage.tsx
// Layout: sticky header -> hero status -> quick actions -> active trip -> DMS card -> recent trips
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Map, Shield, ChevronRight, MapPin, AlertTriangle, Plane, Newspaper } from 'lucide-react'
import { Button } from '../components/ui/button'
import { TSIBadge, SOSButton, DMSCard, OfflineBanner, TripCardSkeleton, EmptyState, NewsFeed } from '../components/shared'
import { RescueReadinessChecklist } from '../components/shared/RescueReadinessChecklist'
import { SafetyTimeline, useEscalationLevel } from '../components/shared/SafetyTimeline'
import { useAuthStore } from '../store/auth.store'
import { useSafetyStore } from '../store/safety.store'
import { useDMS } from '../hooks/useDMS'
import tripApi from '../api/trip.api'
import newsApi from '../api/news.api'
import type { Trip } from '../types/api.types'
import { formatDate, cn } from '../lib/utils'
import { TRIP_STATUSES } from '../constants/enums'

const STATUS_COLORS: Record<string, string> = {
  PLANNED:   'bg-slate-100 text-slate-600',
  ACTIVE:    'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const QUICK_ACTIONS = [
  { Icon: MapPin,        label: 'Check In', route: '/checkin',  color: 'bg-green-50 border-green-200' },
  { Icon: Map,            label: 'My Trips', route: '/trips',    color: 'bg-amber-50 border-amber-200' },
  { Icon: AlertTriangle, label: 'Advisory', route: '/advisory', color: 'bg-orange-50 border-orange-200' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const tourist = useAuthStore((s) => s.tourist)
  const { dms } = useDMS()
  const activeSOSId = useSafetyStore((s) => s.activeSOSId)
  const escalationLevel = useEscalationLevel(dms)

  const { data: tripsData, isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripApi.getMyTrips({ limit: 10 }).then(r => r.data),
    staleTime: 60_000,
  })

  const trips = tripsData?.data || []
  const activeTrip = trips.find(t => t.status === TRIP_STATUSES.ACTIVE)

  const { data: latestNews } = useQuery({
    queryKey: ['trips', activeTrip?.id, 'news'],
    queryFn: () => newsApi.getForTrip(activeTrip!.id).then(r => r.data.data),
    enabled: !!activeTrip,
    staleTime: 2 * 60_000,
  })

  return (
    <div className="min-h-screen bg-surface pb-28 font-sans">
      <OfflineBanner />

      {/* ── Hero Header ──────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest px-5 pt-12 pb-6 shadow-sm border-b border-outline-variant/60">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-extrabold text-primary uppercase tracking-widest">Aaraksha</p>
            <h1 className="font-display text-2xl font-black text-on-surface leading-tight mt-0.5">
              Welcome, {tourist?.full_name?.split(' ')[0] || 'Traveler'}
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">Smart Tourism · Safe Journey</p>
          </div>
          <button className="relative p-2" onClick={() => navigate('/profile')}>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
              {tourist?.full_name?.[0]?.toUpperCase() || 'T'}
            </div>
          </button>
        </div>

        {/* Active trip TSI */}
        {activeTrip && (
          <div className="glass-card rounded-2xl p-4 flex items-center gap-4 cursor-pointer relative overflow-hidden"
            onClick={() => navigate(`/trips/${activeTrip.id}`)}
            role="button">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
            <TSIBadge score={activeTrip.tsi_score} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-primary uppercase tracking-wide">Active Trip</p>
              <p className="font-bold text-on-surface truncate">{activeTrip.title}</p>
              <p className="text-xs text-on-surface-variant">{formatDate(activeTrip.start_date)} → {formatDate(activeTrip.end_date)}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-on-surface-variant flex-shrink-0" />
          </div>
        )}
      </div>

      {/* ── Safety Section ────────────────────────────────────────── */}
      <div className="px-5 mt-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-black text-on-surface">Safety</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/sos')} className="text-primary font-semibold">
            <Shield className="w-4 h-4 mr-1" /> Safety Center
          </Button>
        </div>

        {/* Big SOS button */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant p-6 flex flex-col items-center gap-4">
          <SOSButton onTrigger={() => navigate('/sos')} isActive={!!activeSOSId} size="default" />
          {activeSOSId && (
            <div className="bg-sos-light border border-sos/30 rounded-xl px-4 py-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-sos flex-shrink-0" />
              <p className="text-sm font-bold text-sos-dark">SOS Active — Emergency services notified</p>
            </div>
          )}
        </div>

        {/* DMS Card */}
        <DMSCard dms={dms || null} />
      </div>

      {/* ── Latest Alerts ─────────────────────────────────────────── */}
      {activeTrip && latestNews && latestNews.length > 0 && (
        <div className="px-5 mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-black text-on-surface flex items-center gap-1.5">
              <Newspaper className="w-4.5 h-4.5" /> Latest Alerts
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/trips/${activeTrip.id}`)} className="text-primary font-semibold">
              View all
            </Button>
          </div>
          <NewsFeed items={latestNews.slice(0, 2)} showDestinationName />
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <div className="px-5 mt-5">
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(({ Icon, label, route, color }) => (
            <button key={label} onClick={() => navigate(route)}
              className={cn('rounded-2xl border p-4 flex flex-col items-center gap-2 font-semibold text-xs text-on-surface bg-surface-container-lowest shadow-sm hover:shadow-md active:scale-95 transition-all', color)}>
              <Icon className="w-6 h-6" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent Trips ──────────────────────────────────────────── */}
      <div className="px-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-black text-on-surface">My Trips</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/trips')} className="text-primary font-semibold">
            View all
          </Button>
        </div>

        {isLoading && [1, 2].map(i => <TripCardSkeleton key={i} />)}

        {!isLoading && trips.length === 0 && (
          <EmptyState icon={Plane} title="No trips yet"
            description="Plan your first safe journey to Northeast India"
            action={
              <Button onClick={() => navigate('/trips/new')} className="bg-primary hover:brightness-95 text-primary-foreground rounded-full px-6">
                <Plus className="w-4 h-4 mr-2" /> Plan New Trip
              </Button>
            }
          />
        )}

        <div className="space-y-3">
          {trips.slice(0, 3).map((trip) => (
            <TripCard key={trip.id} trip={trip} onClick={() => navigate(`/trips/${trip.id}`)} />
          ))}
        </div>

        {trips.length > 0 && (
          <Button onClick={() => navigate('/trips/new')}
            className="w-full mt-4 bg-on-surface hover:bg-on-surface/90 text-surface rounded-full h-12 font-bold">
            <Plus className="w-4 h-4 mr-2" /> Plan New Trip
          </Button>
        )}
      </div>

      {/* ── Safety Timeline (only renders once something has escalated) ── */}
      {escalationLevel > 0 && (
        <div className="px-5 mt-6">
          <SafetyTimeline dms={dms} />
        </div>
      )}

      {/* ── Rescue Readiness ─────────────────────────────────────── */}
      {tourist && (
        <div className="px-5 mt-6">
          <RescueReadinessChecklist tourist={tourist} activeTrip={activeTrip} dms={dms} />
        </div>
      )}
    </div>
  )
}

function TripCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  return (
    <div onClick={onClick} role="button"
      className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant p-5 flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer">
      {trip.tsi_score !== null && <TSIBadge score={trip.tsi_score} size="sm" showRing={false} />}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-on-surface truncate">{trip.title}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{formatDate(trip.start_date)} → {formatDate(trip.end_date)}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', STATUS_COLORS[trip.status] || STATUS_COLORS.PLANNED)}>
            {trip.status}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-on-surface-variant">
            <MapPin className="w-3 h-3" /> {(trip.stop_count || 0)} stops
          </span>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-on-surface-variant flex-shrink-0" />
    </div>
  )
}
