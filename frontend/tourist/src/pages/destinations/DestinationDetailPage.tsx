// src/pages/destinations/DestinationDetailPage.tsx
// Explore Destinations used to send every card tap straight into the
// "create a trip" form -- there was no way to actually learn about a place
// before committing to plan a trip there. This page is that missing step.
// It deliberately doesn't reinvent the destination content: DestinationInfo
// (shared with StopDetailSheet.tsx) already renders the real curated data
// -- description, govt advisory, hospital, ILP, verified local operators --
// this page just reaches it from Explore, before any trip exists, and adds
// live weather + real traveller reviews (already built for CommunityPage,
// just not surfaced on a destination's own page until now).
//
// Visual pass: reworked as a premium "documentary" page -- taller hero,
// photo-essay gallery strip (getDestinationGallery, gracefully 1-4 photos),
// an icon-led "at a glance" bento stat row mirroring TripDetailPage's own
// bento grid, a real weather moment instead of just a header chip, and
// eyebrow-labelled section rhythm (the same small/bold/uppercase/
// tracking-wide treatment DashboardPage and TripDetailPage already use for
// "ACTIVE TRIP") -- all built from the existing Inter-only type system and
// glass/shadow tokens, no second typeface, no new visual system.
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, ArrowRight, MapPin, Compass, Cloud, CloudRain, CloudSnow, CloudFog, Sun, Zap,
  Star, IndianRupee, Clock, Users2, ThumbsUp, ThumbsDown, Lightbulb, ShieldCheck,
  ShieldQuestion, ShieldAlert, MessageSquare, Loader2, Mountain, Wifi, TrendingUp,
  CalendarRange, Shield, Droplets, Wind, Route, BadgeCheck,
} from 'lucide-react'
import destinationApi from '../../api/destination.api'
import reviewApi from '../../api/review.api'
import { DestinationInfo } from '../../components/shared/DestinationInfo'
import { getDestinationImage, getDestinationGallery } from '../../lib/destinationImages'
import { tEnum } from '../../lib/i18nEnums'
import { formatINR, cn } from '../../lib/utils'
import { ZONE_TYPES } from '../../constants/enums'

const ZONE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  [ZONE_TYPES.SAFE]:         { bg: 'bg-tsi-low',      text: 'text-white', label: 'Safe' },
  [ZONE_TYPES.CAUTION]:      { bg: 'bg-tsi-moderate', text: 'text-white', label: 'Caution' },
  [ZONE_TYPES.HIGH_RISK]:    { bg: 'bg-tsi-high',     text: 'text-white', label: 'High Risk' },
  [ZONE_TYPES.RESTRICTED]:   { bg: 'bg-sos',          text: 'text-white', label: 'Restricted' },
  [ZONE_TYPES.ILP_REQUIRED]: { bg: 'bg-purple-500',   text: 'text-white', label: 'ILP Required' },
}

const WEATHER_ICON: Record<string, typeof Sun> = {
  CLEAR: Sun, CLOUDY: Cloud, FOG: CloudFog, RAIN: CloudRain, HEAVY_RAIN: CloudRain, SNOW: CloudSnow, STORM: Zap,
}
// Plain English labels, matching the same non-i18n convention already used
// by WeatherBadge.tsx for this exact enum -- not a gap introduced here.
const WEATHER_LABEL: Record<string, string> = {
  CLEAR: 'Clear skies', CLOUDY: 'Cloudy', FOG: 'Foggy', RAIN: 'Rainy', HEAVY_RAIN: 'Heavy rain', SNOW: 'Snowfall', STORM: 'Stormy',
}

const SAFE_ICONS: Record<string, typeof ShieldCheck> = { YES: ShieldCheck, SOMEWHAT: ShieldQuestion, NO: ShieldAlert }
const SAFE_COLORS: Record<string, string> = {
  YES: 'text-tsi-low bg-tsi-low/10', SOMEWHAT: 'text-primary-dark bg-primary/10', NO: 'text-sos-dark bg-sos/10',
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('w-3.5 h-3.5', n <= value ? 'fill-primary text-primary' : 'fill-none text-outline-variant')} />
      ))}
    </div>
  )
}

// Small eyebrow + heading pair -- the editorial "ACTIVE TRIP"-style label
// DashboardPage/TripDetailPage already use above a section, not invented
// fresh for this page.
function SectionHeading({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon?: typeof Route }) {
  return (
    <div className="mb-3">
      <p className="text-[11px] font-extrabold text-primary uppercase tracking-wide mb-1">{eyebrow}</p>
      <h2 className="font-display text-lg font-extrabold text-on-surface flex items-center gap-1.5">
        {Icon && <Icon className="w-4.5 h-4.5" />} {title}
      </h2>
    </div>
  )
}

// Icon-led bento stat cell -- same card language (rounded-3xl, shadow-sm,
// tinted icon circle) as TripDetailPage's own bento stat grid.
function StatCard({ icon: Icon, label, value, tint }: { icon: typeof Mountain; label: string; value: string; tint: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[92px]">
      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center mb-2', tint)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-black text-on-surface leading-tight truncate">{value}</p>
        <p className="text-[11px] text-on-surface-variant mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function DestinationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [showAllReviews, setShowAllReviews] = useState(false)

  const { data: destination, isLoading } = useQuery({
    queryKey: ['destination', id],
    queryFn: () => destinationApi.getById(id!).then((r) => r.data.data),
    enabled: !!id,
  })

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['destination', id, 'reviews'],
    queryFn: () => reviewApi.getForDestination(id!).then((r) => r.data.data),
    enabled: !!id,
  })
  const reviews = reviewsData?.reviews || []
  const reviewAgg = reviewsData?.aggregate
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 2)

  // Real curated multi-day itineraries for this destination's state
  // (migration 032) -- gated on the destination's own state, so this query
  // simply never fires until the destination itself has loaded.
  const { data: itineraries } = useQuery({
    queryKey: ['destination', id, 'curated-itineraries', destination?.state],
    queryFn: () => destinationApi.getCuratedItineraries(destination!.state).then((r) => r.data.data),
    enabled: !!destination?.state,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface pb-24">
        <div className="h-96 bg-surface-container-high animate-pulse rounded-b-[32px]" />
        <div className="px-5 pt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] bg-surface-container-high rounded-3xl animate-pulse" />)}
          </div>
          <div className="h-4 bg-surface-container-high rounded w-2/3 animate-pulse" />
          <div className="h-3 bg-surface-container-high rounded w-full animate-pulse" />
          <div className="h-3 bg-surface-container-high rounded w-5/6 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!destination) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center mb-4">
          <MapPin className="w-7 h-7 text-on-surface-variant" />
        </div>
        <p className="font-bold text-on-surface mb-1">{t('destinationDetail.notFoundTitle')}</p>
        <p className="text-sm text-on-surface-variant mb-5">{t('destinationDetail.notFoundDesc')}</p>
        <button onClick={() => navigate('/dashboard')}
          className="h-11 px-6 rounded-full bg-primary text-on-surface text-sm font-bold">
          {t('destinationDetail.backToExplore')}
        </button>
      </div>
    )
  }

  const badge = ZONE_BADGE[destination.zone_type] || ZONE_BADGE[ZONE_TYPES.SAFE]
  const WeatherIcon = destination.weather_condition ? (WEATHER_ICON[destination.weather_condition] || Cloud) : null
  const gallery = getDestinationGallery(destination.name, { w: 500, q: 78 })

  return (
    <div className="min-h-screen bg-surface pb-28">
      {/* Hero — taller, full-bleed, documentary-style photo */}
      <div className="relative h-[26rem] sm:h-[32rem] rounded-b-[32px] overflow-hidden shadow-glass-lg">
        <img src={getDestinationImage(destination.name, { w: 1600, q: 82 })} alt={destination.name}
          className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/35" />

        <div className="relative flex items-center justify-between px-5 pt-12">
          <button onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-glass hover:bg-white/30 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          {WeatherIcon && destination.temp_celsius != null && (
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-xl border border-white/30 rounded-full px-3.5 py-1.5 shadow-glass text-white text-xs font-bold">
              <WeatherIcon className="w-3.5 h-3.5" /> {destination.temp_celsius}°C
            </div>
          )}
        </div>

        <div className="relative px-5 pt-10 pb-8">
          <span className={cn('inline-block text-[11px] font-bold px-2.5 py-1 rounded-full mb-3', badge.bg, badge.text)}>
            {badge.label}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-[1.05] drop-shadow-md">{destination.name}</h1>
          <p className="text-sm text-white/80 mt-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {destination.state}
          </p>
        </div>
      </div>

      <div className="relative px-5 -mt-6">
        <button onClick={() => navigate('/trips/new', { state: { destinationName: destination.name } })}
          className="w-full h-13 py-3.5 rounded-3xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-glass-lg flex items-center justify-center gap-2 transition-colors">
          <Compass className="w-4.5 h-4.5" /> {t('destinationDetail.planTripHere')}
        </button>
      </div>

      {/* Photo essay strip — only when there's genuinely more than one
          verified photo; a single-photo destination just keeps its hero,
          no empty/duplicated strip. */}
      {gallery.length > 1 && (
        <div className="px-5 mt-4">
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
            {gallery.map((src, i) => (
              <div key={i} className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-glass">
                <img src={src} alt={`${destination.name} ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At a glance — icon-led bento infographic row */}
      <div className="px-5 mt-7">
        <SectionHeading eyebrow={t('destinationDetail.atAGlanceEyebrow')} title={t('destinationDetail.atAGlanceTitle')} />
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Mountain} tint="bg-tsi-high/10 text-tsi-high"
            label={t('destinationDetail.altitudeStatLabel')} value={`${destination.altitude_m}m`} />
          <StatCard icon={Wifi} tint="bg-trust/10 text-trust-dark"
            label={t('destinationDetail.connectivityStatLabel')} value={tEnum(t, 'connectivity', destination.connectivity)} />
          <StatCard icon={TrendingUp} tint="bg-purple-100 text-purple-700"
            label={t('destinationDetail.difficultyStatLabel')} value={tEnum(t, 'difficulty', destination.difficulty)} />
          <StatCard icon={Shield} tint={destination.ilp_required ? 'bg-primary/15 text-primary-dark' : 'bg-tsi-low/10 text-tsi-low'}
            label={t('destinationDetail.ilpStatLabel')}
            value={destination.ilp_required ? t('destinationDetail.ilpRequiredValue') : t('destinationDetail.ilpNotRequiredValue')} />
        </div>
        {destination.best_months && (
          <div className="mt-3 bg-surface-container-lowest rounded-3xl shadow-sm p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <CalendarRange className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-on-surface-variant">{t('destinationDetail.bestTimeStatLabel')}</p>
              <p className="text-sm font-black text-on-surface truncate">{destination.best_months}</p>
            </div>
          </div>
        )}
      </div>

      {/* Live weather — a real designed moment, not just the header chip */}
      {destination.weather_condition && destination.temp_celsius != null && (
        <div className="px-5 mt-7">
          <SectionHeading eyebrow={t('destinationDetail.weatherEyebrow')} title={t('destinationDetail.weatherTitle')} />
          <div className="relative rounded-3xl shadow-glass-lg p-5 bg-gradient-to-br from-trust to-trust-dark text-white overflow-hidden">
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-4xl font-black leading-none">{destination.temp_celsius}°C</p>
                <p className="text-sm text-white/85 mt-1.5 font-semibold">
                  {WEATHER_LABEL[destination.weather_condition] || destination.weather_condition}
                </p>
                {destination.weather_desc && (
                  <p className="text-xs text-white/70 mt-0.5 capitalize">{destination.weather_desc}</p>
                )}
              </div>
              {WeatherIcon && <WeatherIcon className="w-16 h-16 text-white/80 flex-shrink-0" />}
            </div>
            {(destination.humidity_pct != null || destination.wind_kmh != null || destination.risk_reason) && (
              <div className="relative flex items-center gap-2 mt-4 flex-wrap">
                {destination.humidity_pct != null && (
                  <span className="flex items-center gap-1 text-xs font-semibold bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    <Droplets className="w-3.5 h-3.5" /> {destination.humidity_pct}%
                  </span>
                )}
                {destination.wind_kmh != null && (
                  <span className="flex items-center gap-1 text-xs font-semibold bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    <Wind className="w-3.5 h-3.5" /> {destination.wind_kmh} km/h
                  </span>
                )}
                {destination.risk_reason && (
                  <span className="text-xs font-semibold bg-tsi-high/90 px-2.5 py-1 rounded-full">{destination.risk_reason}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* The story — DestinationInfo's real curated content (description,
          highlights, advisory, hospital, ILP, verified local operators),
          untouched internally, now framed inside this page's own editorial
          section rhythm rather than dropped in with no heading. */}
      <div className="px-5 mt-7">
        <SectionHeading eyebrow={t('destinationDetail.storyEyebrow')} title={t('destinationDetail.storyTitle', { name: destination.name })} />
        <DestinationInfo destination={destination} />
      </div>

      {/* Recommended itineraries — real curated_itineraries rows for this
          destination's state (migration 032). Nothing renders when empty,
          same no-flat-empty-state precedent DestinationInfo's own
          local-operators section already follows. */}
      {itineraries && itineraries.length > 0 && (
        <div className="px-5 mt-8">
          <SectionHeading icon={Route} eyebrow={t('destinationDetail.itinerariesEyebrow')} title={t('destinationDetail.itinerariesTitle')} />
          <div className="space-y-3">
            {itineraries.map((it) => (
              <div key={it.id} className="bg-surface-container-lowest rounded-3xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-display font-bold text-on-surface text-sm leading-snug">{it.title}</h3>
                  {it.is_govt_approved && (
                    <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold bg-tsi-low/10 text-tsi-low px-2 py-1 rounded-full">
                      <BadgeCheck className="w-3 h-3" /> {t('destinationDetail.govtApprovedBadge')}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-primary-dark mb-2">
                  {t('destinationDetail.itineraryDaysLabel', { count: it.days })}
                </p>
                {it.summary && <p className="text-sm text-on-surface-variant leading-relaxed mb-2.5">{it.summary}</p>}
                <p className="text-[10px] text-on-surface-variant/70 mb-3">{t('destinationDetail.itinerarySource', { source: it.source })}</p>
                <button
                  onClick={() => navigate('/trips/new', { state: { prefillTitle: it.title, prefillStops: it.stops } })}
                  className="w-full h-10 rounded-full bg-primary/10 text-primary-dark text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/15 transition-colors">
                  {t('destinationDetail.useThisItinerary')} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What travellers say -- real destination_reviews data, already built
          for CommunityPage, surfaced here too instead of only there. */}
      <div className="px-5 mt-8">
        <SectionHeading icon={MessageSquare} eyebrow={t('destinationDetail.reviewsEyebrow')} title={t('destinationDetail.travellersSayTitle')} />

        {reviewsLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" /></div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-on-surface-variant">{t('destinationDetail.noReviewsYet')}</p>
        ) : (
          <>
            {reviewAgg && reviewAgg.review_count > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex items-center justify-around mb-3">
                <div className="text-center">
                  <p className="text-2xl font-black text-on-surface">{reviewAgg.avg_rating}</p>
                  <StarRow value={Math.round(Number(reviewAgg.avg_rating))} />
                  <p className="text-[10px] text-on-surface-variant mt-0.5">{t('community.reviewCount', { count: reviewAgg.review_count })}</p>
                </div>
                {reviewAgg.avg_cost_inr && (
                  <div className="text-center">
                    <p className="text-sm font-bold text-on-surface">{formatINR(Number(reviewAgg.avg_cost_inr))}</p>
                    <p className="text-[10px] text-on-surface-variant">{t('community.avgCost')}</p>
                  </div>
                )}
                {reviewAgg.common_crowd_level && (
                  <div className="text-center">
                    <p className="text-sm font-bold text-on-surface">{tEnum(t, 'crowdLevel', reviewAgg.common_crowd_level)}</p>
                    <p className="text-[10px] text-on-surface-variant">{t('community.crowd')}</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {visibleReviews.map((r) => {
                const SafeIcon = r.felt_safe ? SAFE_ICONS[r.felt_safe] : null
                return (
                  <div key={r.id} className="bg-surface-container-lowest rounded-2xl shadow-sm p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-trust/15 text-trust-dark font-display font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {r.tourist_name.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-bold text-on-surface text-sm truncate">{r.tourist_name}</p>
                      </div>
                      <StarRow value={r.rating} />
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {r.actual_cost_inr != null && (
                        <span className="text-[10px] bg-surface-container rounded-full px-2 py-1 font-semibold text-on-surface-variant flex items-center gap-1">
                          <IndianRupee className="w-3 h-3" /> {formatINR(r.actual_cost_inr)}
                        </span>
                      )}
                      {r.time_spent_hours != null && (
                        <span className="text-[10px] bg-surface-container rounded-full px-2 py-1 font-semibold text-on-surface-variant flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {r.time_spent_hours}h
                        </span>
                      )}
                      {r.crowd_level && (
                        <span className="text-[10px] bg-surface-container rounded-full px-2 py-1 font-semibold text-on-surface-variant flex items-center gap-1">
                          <Users2 className="w-3 h-3" /> {t('community.crowdSuffix', { level: tEnum(t, 'crowdLevel', r.crowd_level) })}
                        </span>
                      )}
                      {r.felt_safe && SafeIcon && (
                        <span className={cn('text-[10px] rounded-full px-2 py-1 font-semibold flex items-center gap-1', SAFE_COLORS[r.felt_safe])}>
                          <SafeIcon className="w-3 h-3" /> {tEnum(t, 'feltSafe', r.felt_safe)}
                        </span>
                      )}
                    </div>
                    {r.review_text && <p className="text-sm text-on-surface mb-1.5">{r.review_text}</p>}
                    {r.liked_text && (
                      <p className="text-xs text-on-surface-variant flex items-start gap-1.5 mb-1">
                        <ThumbsUp className="w-3.5 h-3.5 text-tsi-low flex-shrink-0 mt-0.5" /> {r.liked_text}
                      </p>
                    )}
                    {r.disliked_text && (
                      <p className="text-xs text-on-surface-variant flex items-start gap-1.5 mb-1">
                        <ThumbsDown className="w-3.5 h-3.5 text-sos flex-shrink-0 mt-0.5" /> {r.disliked_text}
                      </p>
                    )}
                    {r.tips_text && (
                      <p className="text-xs text-primary flex items-start gap-1.5 bg-primary/10 rounded-lg p-2 mt-2">
                        <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {r.tips_text}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {reviews.length > 2 && !showAllReviews && (
              <button onClick={() => setShowAllReviews(true)}
                className="w-full mt-3 h-10 rounded-full border border-outline-variant text-on-surface text-xs font-bold">
                {t('destinationDetail.showAllReviews', { count: reviews.length })}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
