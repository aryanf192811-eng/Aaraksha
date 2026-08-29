// src/pages/DashboardPage.tsx
// v3 — state-aware hierarchy. The page now has three genuinely different
// shapes depending on what's actually true for the user right now, because
// "what should be at the top" isn't a fixed answer for a safety+travel app:
//
//   1. SOS ACTIVE (rare): an urgent banner + live rescue tracking take the
//      top of the page, above even the greeting's usual position. Nothing
//      else competes for attention here.
//   2. TRIP ACTIVE, no SOS (common, mid-journey): "am I okay, right now,
//      here" leads — a trip-status hero with a live alert-count signal,
//      not a generic destination browser. Discovery drops lower, since
//      browsing new places is a secondary need mid-trip.
//   3. NO TRIP, no SOS (common, planning mode): "where should I go" is the
//      actual question, so Explore is promoted to lead content right under
//      a minimal safety trust-line, not buried under a big safety block.
//
// The safety module itself is also state-dependent by design: a
// permanently large red/teal block when nothing is wrong reads as anxious
// and works against the tourism-appeal goal, not for it. It stays compact
// and confident in the calm states and only escalates when there's an
// actual reason to.
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Map, ChevronRight, MapPin, AlertTriangle, Plane, Newspaper, Compass, CheckCircle2, ShieldCheck, Siren, HelpCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { TSIBadge, DMSCard, OfflineBanner, TripCardSkeleton, EmptyState, NewsFeed, ExploreDestinations } from '../components/shared'
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
  ACTIVE:    'bg-tsi-low/15 text-tsi-low',
  COMPLETED: 'bg-trust/15 text-trust-dark',
  CANCELLED: 'bg-sos/15 text-sos-dark',
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
  const heroPhoto = getDestinationImage(activeTrip?.stops?.[0]?.city, { w: 1400, q: 82 })

  const { data: latestNews } = useQuery({
    queryKey: ['trips', activeTrip?.id, 'news'],
    queryFn: () => newsApi.getForTrip(activeTrip!.id).then(r => r.data.data),
    enabled: !!activeTrip,
    staleTime: 2 * 60_000,
  })

  const advisoryCount = useMemo(
    () => (latestNews || []).filter(n => n.severity === 'WARNING' || n.severity === 'CRITICAL').length,
    [latestNews]
  )

  const firstName = tourist?.full_name?.split(' ')[0] || t('dashboard.travelerFallback')

  return (
    <div className="min-h-screen bg-surface pb-28 font-sans">
      <OfflineBanner />

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="px-5 pt-12 pb-1 flex items-center justify-between">
        <p className="text-xs font-extrabold text-primary-dark uppercase tracking-widest">Aaraksha</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => navigate('/help')} aria-label={t('help.title')}
            className="w-9 h-9 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/40 transition-colors">
            <HelpCircle className="w-4.5 h-4.5" />
          </button>
          <button onClick={() => navigate('/profile')} aria-label={t('profile.title')}>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-display font-bold">
              {tourist?.full_name?.[0]?.toUpperCase() || 'T'}
            </div>
          </button>
        </div>
      </div>

      {/* ── Dashboard content — always this, regardless of SOS state.
          Sending an SOS (from the compact hold button below) navigates
          straight to the Safety Center instead of swapping in an
          alternate in-place view here — that in-place view broke the
          flow and was removed on explicit request. The Safety Center
          already owns the false-alarm/status/rescue-tracking experience. ── */}
      <div className="px-5 pb-4">
        <h1 className="font-display text-[2rem] font-extrabold text-on-surface leading-[1.1]">
          {t('dashboard.welcome', { name: firstName })}
        </h1>
      </div>

      {activeTrip ? (
        <>
          {/* ── State 2: trip in progress — "am I okay, here, today" leads ── */}
          <div className="px-5">
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
                        <p className={cn('text-xs font-semibold mt-2 flex items-center gap-1.5',
                          advisoryCount > 0 ? 'text-amber-300' : 'text-emerald-300')}>
                          {advisoryCount > 0
                            ? <><AlertTriangle className="w-3.5 h-3.5" /> {t('dashboard.newAdvisoriesCount', { count: advisoryCount })}</>
                            : <><CheckCircle2 className="w-3.5 h-3.5" /> {t('dashboard.allClear')}</>}
                        </p>
                      </div>
                      <div className="flex-shrink-0 bg-white rounded-2xl p-1.5 shadow-md">
                        <TSIBadge score={activeTrip.tsi_score} size="sm" />
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <SafetyStrip dms={dms} activeSOSId={activeSOSId} onOpen={() => navigate('/sos')} t={t} />

              <QuickActionsRow navigate={navigate} t={t} />

              {latestNews && latestNews.length > 0 && (
                <div className="px-5 mt-8">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display text-xl font-extrabold text-on-surface flex items-center gap-1.5">
                      <Newspaper className="w-5 h-5" /> {t('dashboard.latestAlerts')}
                    </h2>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/trips/${activeTrip.id}?tab=news`)} className="text-primary-dark font-semibold">
                      {t('common.viewAll')}
                    </Button>
                  </div>
                  <NewsFeed items={latestNews.slice(0, 2)} showDestinationName />
                </div>
              )}

              <div className="px-5 mt-8">
                <h2 className="font-display text-xl font-extrabold text-on-surface mb-1">{t('dashboard.exploreTitle')}</h2>
                <p className="text-sm text-on-surface-variant mb-4">{t('dashboard.exploreSubtitleSecondary')}</p>
                <ExploreDestinations />
              </div>
            </>
          ) : (
            <>
              {/* ── State 3: no trip yet — "where should I go" leads ────── */}
              <div className="px-5">
                <button
                  onClick={() => navigate('/trips/new')}
                  className="relative w-full h-64 rounded-[2rem] overflow-hidden shadow-glass-lg text-left cursor-pointer"
                >
                  <img src={getDestinationImage(undefined, { w: 1400, q: 82 })} alt="" loading="eager" className="absolute inset-0 w-full h-full object-cover" />
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
              </div>

              <SafetyStrip dms={dms} activeSOSId={activeSOSId} onOpen={() => navigate('/sos')} t={t} minimal />

              <div className="px-5 mt-8">
                <h2 className="font-display text-2xl font-extrabold text-on-surface mb-1">{t('dashboard.exploreTitle')}</h2>
                <p className="text-sm text-on-surface-variant mb-4">{t('dashboard.exploreSubtitle')}</p>
                <ExploreDestinations />
              </div>

              <QuickActionsRow navigate={navigate} t={t} />
            </>
          )}

          {/* ── Recent Trips ──────────────────────────────────────────── */}
          <div className="px-5 mt-8">
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

          {/* ── Safety Timeline (only once something has escalated) ──── */}
          {escalationLevel > 0 && (
            <div className="px-5 mt-8">
              <SafetyTimeline dms={dms} />
            </div>
          )}

      {/* ── Rescue Readiness ─────────────────────────────────────── */}
      {tourist && (
        <div className="px-5 mt-8">
          <RescueReadinessChecklist tourist={tourist} activeTrip={activeTrip} dms={dms} />
        </div>
      )}

    </div>
  )
}

// Compact, single-row safety status module used in both calm states.
// `minimal` drops the DMS card entirely (no-trip state: a Dead Man's Switch
// isn't even something the user can act on yet without a trip) so the
// no-trip page reads as a trust signal, not a feature to configure right
// now. The SOS hold gesture itself now lives globally in the bottom nav's
// raised center button (NavSOSButton) — this strip is status + a link to
// the Safety Center, not a second SOS trigger sitting right next to the
// nav's one.
function SafetyStrip({ dms, activeSOSId, onOpen, t, minimal }: {
  dms: ReturnType<typeof useDMS>['dms']
  activeSOSId: string | null
  onOpen: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
  minimal?: boolean
}) {
  return (
    <div className="px-5 mt-5">
      <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant p-4 flex items-center gap-3.5">
        <div className={cn('w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0',
          activeSOSId ? 'bg-sos/15 text-sos-dark animate-pulse' : 'bg-tsi-low/10 text-tsi-low')}>
          {activeSOSId ? <Siren className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-on-surface text-base">{t('dashboard.safety')}</p>
          <p className={cn('text-xs mt-0.5 leading-snug', activeSOSId ? 'text-sos-dark font-bold' : 'text-on-surface-variant')}>
            {activeSOSId
              ? t('dashboard.sosActiveStatus')
              : (dms ? t('dashboard.dmsRunning') : minimal ? t('dashboard.safetyReady') : t('dashboard.holdToAlert'))}
          </p>
        </div>
        <button onClick={onOpen} className="flex-shrink-0 text-xs font-bold text-trust-dark bg-trust-light px-3.5 py-2.5 rounded-full cursor-pointer whitespace-nowrap">
          {t('dashboard.safetyCenter')}
        </button>
      </div>
      {!minimal && dms && (
        <div className="mt-2">
          <DMSCard dms={dms} />
        </div>
      )}
    </div>
  )
}

function QuickActionsRow({ navigate, t }: { navigate: (route: string) => void; t: (key: string) => string }) {
  return (
    <div className="px-5 mt-8">
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
  )
}

function TripCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const { t } = useTranslation()
  const photo = getDestinationImage(trip.stops?.[0]?.city, { w: 400, q: 80 })
  return (
    <div onClick={onClick} role="button"
      className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-3 flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer">
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
