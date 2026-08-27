// src/pages/DashboardPage.tsx
// v2 layout, rebuilt against direct feedback on v1 (too boxy, too safe,
// didn't match the reference travel-app patterns): bolder greeting type,
// a tighter single-register safety panel instead of a tall stacked block,
// and Explore promoted to a real search+filter+grid section instead of a
// cramped horizontal rail. All data hooks are unchanged from the original
// dashboard — this is still a visual/structural pass only.
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Map, ChevronRight, MapPin, AlertTriangle, Plane, Newspaper, Compass } from 'lucide-react'
import { Button } from '../components/ui/button'
import { TSIBadge, SOSButton, DMSCard, OfflineBanner, TripCardSkeleton, EmptyState, NewsFeed, ExploreDestinations } from '../components/shared'
import { RescueReadinessChecklist } from '../components/shared/RescueReadinessChecklist'
import { SafetyTimeline, useEscalationLevel } from '../components/shared/SafetyTimeline'
import { useAuthStore } from '../store/auth.store'
import { useSafetyStore } from '../store/safety.store'
import { useDMS } from '../hooks/useDMS'
import tripApi from '../api/trip.api'
import newsApi from '../api/news.api'
import type { Trip } from '../types/api.types'
import { formatDate, cn } from '../lib/utils'
import { getDestinationImage } from '../lib/destinationImages'
import { tEnum } from '../lib/i18nEnums'
import { TRIP_STATUSES } from '../constants/enums'

const STATUS_COLORS: Record<string, string> = {
  PLANNED:   'bg-slate-100 text-slate-600',
  ACTIVE:    'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const QUICK_ACTIONS = [
  { Icon: MapPin,        labelKey: 'dashboard.checkIn',  route: '/checkin' },
  { Icon: Map,           labelKey: 'dashboard.myTrips',  route: '/trips' },
  { Icon: AlertTriangle, labelKey: 'dashboard.advisory', route: '/advisory' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
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
  const heroPhoto = getDestinationImage(activeTrip?.stops?.[0]?.city, { w: 1000, q: 78 })

  const { data: latestNews } = useQuery({
    queryKey: ['trips', activeTrip?.id, 'news'],
    queryFn: () => newsApi.getForTrip(activeTrip!.id).then(r => r.data.data),
    enabled: !!activeTrip,
    staleTime: 2 * 60_000,
  })

  const firstName = tourist?.full_name?.split(' ')[0] || t('dashboard.travelerFallback')

  return (
    <div className="min-h-screen bg-surface pb-28 font-sans">
      <OfflineBanner />

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="px-5 pt-12 pb-1 flex items-center justify-between">
        <p className="text-xs font-extrabold text-primary-dark uppercase tracking-widest">Aaraksha</p>
        <button className="flex-shrink-0" onClick={() => navigate('/profile')} aria-label={t('profile.title')}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-primary-foreground font-display font-bold shadow-glow-amber">
            {tourist?.full_name?.[0]?.toUpperCase() || 'T'}
          </div>
        </button>
      </div>
      <div className="px-5 pb-4">
        <h1 className="font-display text-[2rem] font-extrabold text-on-surface leading-[1.1]">
          {t('dashboard.welcome', { name: firstName })}
        </h1>
      </div>

      {/* ── Hero: photo-backed trip, or a bold discovery prompt ────── */}
      <div className="px-5">
        {activeTrip ? (
          <button
            onClick={() => navigate(`/trips/${activeTrip.id}`)}
            className="relative w-full h-56 rounded-[2rem] overflow-hidden shadow-glass-lg text-left cursor-pointer"
          >
            <img src={heroPhoto} alt="" loading="eager" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 photo-scrim" />
            <div className="relative h-full p-5 flex flex-col justify-end">
              <p className="text-[11px] font-extrabold text-primary uppercase tracking-wide mb-1">{t('dashboard.activeTrip')}</p>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-extrabold text-white text-2xl leading-tight truncate">{activeTrip.title}</p>
                  <p className="text-sm text-white/75 mt-1">{formatDate(activeTrip.start_date)} → {formatDate(activeTrip.end_date)}</p>
                </div>
                <div className="flex-shrink-0 bg-white rounded-2xl p-1.5 shadow-md">
                  <TSIBadge score={activeTrip.tsi_score} size="sm" />
                </div>
              </div>
            </div>
          </button>
        ) : (
          <button
            onClick={() => navigate('/trips/new')}
            className="relative w-full h-64 rounded-[2rem] overflow-hidden shadow-glass-lg text-left cursor-pointer"
          >
            <img src={getDestinationImage(undefined, { w: 1000, q: 78 })} alt="" loading="eager" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 photo-scrim" />
            <div className="relative h-full p-5 flex flex-col justify-end">
              <p className="font-display font-extrabold text-white text-3xl leading-[1.1] max-w-[80%]">
                {t('dashboard.discoverHeroTitle')}
              </p>
              <p className="text-sm text-white/80 mt-2 mb-4 max-w-[85%]">{t('dashboard.discoverHeroSubtitle')}</p>
              <span className="inline-flex items-center gap-1.5 self-start bg-primary text-primary-foreground text-sm font-extrabold px-5 py-3 rounded-full">
                <Compass className="w-4.5 h-4.5" /> {t('dashboard.startPlanning')}
              </span>
            </div>
          </button>
        )}
      </div>

      {/* ── Safety strip — a single-row band, not a tall stacked block. */}
      {/*    Still its own teal register so "this is the civic-safety   */}
      {/*    part" reads instantly against the amber discovery moments. */}
      <div className="px-5 mt-4">
        <div className="rounded-3xl bg-gradient-to-r from-trust-dark to-trust p-4 flex items-center gap-3.5 shadow-glow-teal">
          <SOSButton onTrigger={() => navigate('/sos')} isActive={!!activeSOSId} size="compact" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-white text-base">{t('dashboard.safety')}</p>
            <p className="text-xs text-white/75 mt-0.5 leading-snug">
              {activeSOSId ? t('dashboard.sosActiveBanner') : dms ? t('dashboard.dmsRunning') : t('dashboard.holdToAlert')}
            </p>
          </div>
          <button onClick={() => navigate('/sos')} className="flex-shrink-0 text-xs font-bold text-white bg-white/15 px-3.5 py-2.5 rounded-full cursor-pointer whitespace-nowrap">
            {t('dashboard.safetyCenter')}
          </button>
        </div>
        {dms && (
          <div className="mt-2">
            <DMSCard dms={dms} />
          </div>
        )}
      </div>

      {/* ── Explore: search + safety-zone filter + a generous grid ─── */}
      <div className="px-5 mt-7">
        <h2 className="font-display text-2xl font-extrabold text-on-surface mb-1">{t('dashboard.exploreTitle')}</h2>
        <p className="text-sm text-on-surface-variant mb-4">{t('dashboard.exploreSubtitle')}</p>
        <ExploreDestinations />
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <div className="px-5 mt-7">
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(({ Icon, labelKey, route }) => (
            <button key={labelKey} onClick={() => navigate(route)}
              className="rounded-2xl py-4 flex flex-col items-center gap-2 font-bold text-xs text-on-surface bg-surface-container-lowest active:scale-95 transition-all cursor-pointer">
              <Icon className="w-6 h-6 text-primary-dark" />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Latest Alerts ─────────────────────────────────────────── */}
      {activeTrip && latestNews && latestNews.length > 0 && (
        <div className="px-5 mt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-extrabold text-on-surface flex items-center gap-1.5">
              <Newspaper className="w-5 h-5" /> {t('dashboard.latestAlerts')}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/trips/${activeTrip.id}`)} className="text-primary-dark font-semibold">
              {t('common.viewAll')}
            </Button>
          </div>
          <NewsFeed items={latestNews.slice(0, 2)} showDestinationName />
        </div>
      )}

      {/* ── Recent Trips ──────────────────────────────────────────── */}
      <div className="px-5 mt-7">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-extrabold text-on-surface">{t('dashboard.myTrips')}</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/trips')} className="text-primary-dark font-semibold">
            {t('common.viewAll')}
          </Button>
        </div>

        {isLoading && [1, 2].map(i => <TripCardSkeleton key={i} />)}

        {!isLoading && trips.length === 0 && (
          <EmptyState icon={Plane} title={t('dashboard.noTripsTitle')}
            description={t('dashboard.noTripsDescription')}
            action={
              <Button onClick={() => navigate('/trips/new')} className="bg-primary hover:brightness-95 text-primary-foreground rounded-full px-6">
                <Plus className="w-4 h-4 mr-2" /> {t('dashboard.planNewTrip')}
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
            <Plus className="w-4 h-4 mr-2" /> {t('dashboard.planNewTrip')}
          </Button>
        )}
      </div>

      {/* ── Safety Timeline (only renders once something has escalated) ── */}
      {escalationLevel > 0 && (
        <div className="px-5 mt-7">
          <SafetyTimeline dms={dms} />
        </div>
      )}

      {/* ── Rescue Readiness ─────────────────────────────────────── */}
      {tourist && (
        <div className="px-5 mt-7">
          <RescueReadinessChecklist tourist={tourist} activeTrip={activeTrip} dms={dms} />
        </div>
      )}
    </div>
  )
}

function TripCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const { t } = useTranslation()
  const photo = getDestinationImage(trip.stops?.[0]?.city, { w: 300, q: 65 })
  return (
    <div onClick={onClick} role="button"
      className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant p-3 flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer">
      <img src={photo} alt="" loading="lazy" width={56} height={56}
        className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-on-surface truncate">{trip.title}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{formatDate(trip.start_date)} → {formatDate(trip.end_date)}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', STATUS_COLORS[trip.status] || STATUS_COLORS.PLANNED)}>
            {tEnum(t, 'tripStatus', trip.status)}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-on-surface-variant">
            <MapPin className="w-3 h-3" /> {(trip.stop_count || 0)} {t('dashboard.stops')}
          </span>
        </div>
      </div>
      {trip.tsi_score !== null && <TSIBadge score={trip.tsi_score} size="sm" showRing={false} />}
      <ChevronRight className="w-5 h-5 text-on-surface-variant flex-shrink-0" />
    </div>
  )
}
