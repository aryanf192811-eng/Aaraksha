// src/components/shared/DestinationInfo.tsx
// Shared destination-info rendering -- extracted from StopDetailSheet.tsx
// (which still owns it inside a trip's Itinerary tab) so the exact same
// real content (description, govt advisory, hospital, ILP, govt-verified
// local operators with ratings) can also render on a standalone destination
// page reached from Explore, before any trip exists. Takes a `Destination`
// record directly rather than a trip `Stop` -- a stop's own zone_type/
// connectivity/difficulty/altitude_m only exist as a fallback to these same
// destination fields (see trip.service.js#enrichStops), so reading them
// straight off the destination here is the more direct source, not a
// different one.
import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Mountain, HeartPulse, Shield, CalendarDays, Star, FileWarning, Phone,
  Building2, Home, Compass, Palette, ShieldCheck, ChevronDown, IndianRupee, MapPin,
  Signal, Footprints, CheckCircle2, Info,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import localOperatorApi from '../../api/localOperator.api'
import { queryClient } from '../../lib/queryClient'
import { getErrorMessage } from '../../api/client'
import { cn } from '../../lib/utils'
import { tEnum } from '../../lib/i18nEnums'
import { useAuthStore } from '../../store/auth.store'
import { ZONE_TYPES } from '../../constants/enums'
import type { Destination, LocalOperator } from '../../types/api.types'

const OPERATOR_CATEGORY_ICON: Record<LocalOperator['category'], typeof Building2> = {
  HOTEL: Building2, HOMESTAY: Home, GUIDE: Compass, EXPERIENCE: Mountain, ARTISAN: Palette,
}
const OPERATOR_CATEGORY_TINT: Record<LocalOperator['category'], { bg: string; text: string }> = {
  HOTEL: { bg: 'bg-blue-100', text: 'text-blue-700' },
  HOMESTAY: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  GUIDE: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  EXPERIENCE: { bg: 'bg-orange-100', text: 'text-orange-700' },
  ARTISAN: { bg: 'bg-pink-100', text: 'text-pink-700' },
}
const OPERATOR_CATEGORY_LABEL_KEY: Record<LocalOperator['category'], string> = {
  HOTEL: 'tripDetail.localOperatorCategoryHotel',
  HOMESTAY: 'tripDetail.localOperatorCategoryHomestay',
  GUIDE: 'tripDetail.localOperatorCategoryGuide',
  EXPERIENCE: 'tripDetail.localOperatorCategoryExperience',
  ARTISAN: 'tripDetail.localOperatorCategoryArtisan',
}
function getOperatorMapsUrl(op: LocalOperator): string {
  const osmMatch = op.source.match(/(?:OpenStreetMap|OSM)\s+(node|way)\s+(\d+)/i)
  if (osmMatch) return `https://www.openstreetmap.org/${osmMatch[1].toLowerCase()}/${osmMatch[2]}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${op.business_name}, ${op.district}, ${op.state}`)}`
}

interface DestinationInfoProps {
  destination: Destination
  className?: string
}

export function DestinationInfo({ destination, className }: DestinationInfoProps) {
  const { t } = useTranslation()
  const { updateTourist } = useAuthStore()

  const [ratingOperatorId, setRatingOperatorId] = useState<string | null>(null)
  const [ratingValue, setRatingValue] = useState<number>(0)
  const [ratingText, setRatingText] = useState('')
  const [descExpanded, setDescExpanded] = useState(false)

  useEffect(() => { setDescExpanded(false); setRatingOperatorId(null); setRatingValue(0); setRatingText('') }, [destination.id])

  const { mutate: submitOperatorReview, isPending: submittingRating } = useMutation({
    mutationFn: (operatorId: string) => localOperatorApi.createReview(operatorId, { rating: ratingValue, reviewText: ratingText.trim() || undefined }),
    onSuccess: (res) => {
      const { pointsAwarded, touristLocalPoints } = res.data.data
      toast.success(t('tripDetail.operatorReviewSubmittedWithPoints', { points: pointsAwarded }))
      if (touristLocalPoints != null) updateTourist({ local_points: touristLocalPoints })
      setRatingOperatorId(null)
      setRatingValue(0)
      setRatingText('')
      queryClient.invalidateQueries({ queryKey: ['destination', destination.id] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const [activePillTip, setActivePillTip] = useState<string | null>(null)
  const [hoveredPillTip, setHoveredPillTip] = useState<string | null>(null)

  const zoneTip = destination.zone_type === ZONE_TYPES.SAFE
    ? 'Safety: Low incident risk · Safe for solo & family travel'
    : destination.zone_type === ZONE_TYPES.CAUTION
    ? 'Safety: Moderate risk · Stay alert in remote areas'
    : 'Safety: High risk/restricted · Permit or guide required'

  const connTip = (() => {
    const c = destination.connectivity?.toUpperCase()
    if (c === 'HIGH' || c === 'GOOD') return 'Connectivity: Fast 4G mobile data & calling'
    if (c === 'MODERATE') return 'Connectivity: 3G/4G available · Signal drops in valleys'
    if (c === 'LOW') return 'Connectivity: Weak 2G signal · Voice/SMS only'
    return 'Connectivity: Zero cellular coverage · Offline SOS & GPS only'
  })()

  const diffTip = (() => {
    const d = destination.difficulty?.toUpperCase()
    if (d === 'EASY') return 'Terrain: Gentle walks · Suitable for all fitness levels'
    if (d === 'MODERATE') return 'Terrain: Moderate incline · Basic hiking fitness needed'
    return 'Terrain: Steep alpine trails · Good hiking endurance required'
  })()

  const altTip = destination.altitude_m != null
    ? `Altitude: ${destination.altitude_m.toLocaleString()}m elevation above sea level`
    : null

  const activePill = hoveredPillTip || activePillTip
  const activeTipText = activePill === 'zone' ? zoneTip
    : activePill === 'conn' ? connTip
    : activePill === 'diff' ? diffTip
    : activePill === 'alt' ? altTip
    : null

  return (
    <div className={cn("space-y-4", className)}>
      {/* ── Boxed Overview Card ───────────── */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/60 p-5 shadow-sm space-y-3.5 overflow-hidden">
        <h2 className="font-display text-lg font-bold text-on-surface">
          {t('common.overview', 'Overview')}
        </h2>

        {/* Telemetry Pills Row */}
        <div className="flex flex-wrap gap-2">
          {/* Zone Type */}
          <button
            type="button"
            onMouseEnter={() => setHoveredPillTip('zone')}
            onMouseLeave={() => setHoveredPillTip(null)}
            onFocus={() => setHoveredPillTip('zone')}
            onBlur={() => setHoveredPillTip(null)}
            onClick={() => setActivePillTip(activePillTip === 'zone' ? null : 'zone')}
            title={zoneTip}
            className={cn(
              'text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer select-none',
              destination.zone_type === ZONE_TYPES.SAFE
                ? 'bg-safe/10 border-safe/25 text-safe'
                : destination.zone_type === ZONE_TYPES.CAUTION
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-700'
                : 'bg-sos/10 border-sos/25 text-sos',
              activePill === 'zone' && 'ring-2 ring-primary/40 shadow-sm'
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{tEnum(t, 'zoneType', destination.zone_type)}</span>
          </button>

          {/* Connectivity */}
          <button
            type="button"
            onMouseEnter={() => setHoveredPillTip('conn')}
            onMouseLeave={() => setHoveredPillTip(null)}
            onFocus={() => setHoveredPillTip('conn')}
            onBlur={() => setHoveredPillTip(null)}
            onClick={() => setActivePillTip(activePillTip === 'conn' ? null : 'conn')}
            title={connTip}
            className={cn(
              'text-xs font-semibold px-3 py-1.5 rounded-full bg-trust/10 border border-trust/25 text-trust-dark flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer select-none',
              activePill === 'conn' && 'ring-2 ring-primary/40 shadow-sm'
            )}
          >
            <Signal className="w-3.5 h-3.5 shrink-0" />
            <span>{tEnum(t, 'connectivity', destination.connectivity)}</span>
          </button>

          {/* Difficulty */}
          <button
            type="button"
            onMouseEnter={() => setHoveredPillTip('diff')}
            onMouseLeave={() => setHoveredPillTip(null)}
            onFocus={() => setHoveredPillTip('diff')}
            onBlur={() => setHoveredPillTip(null)}
            onClick={() => setActivePillTip(activePillTip === 'diff' ? null : 'diff')}
            title={diffTip}
            className={cn(
              'text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer select-none',
              activePill === 'diff' && 'ring-2 ring-primary/40 shadow-sm'
            )}
          >
            <Footprints className="w-3.5 h-3.5 shrink-0" />
            <span>{tEnum(t, 'difficulty', destination.difficulty)}</span>
          </button>

          {/* Altitude */}
          {destination.altitude_m != null && (
            <button
              type="button"
              onMouseEnter={() => setHoveredPillTip('alt')}
              onMouseLeave={() => setHoveredPillTip(null)}
              onFocus={() => setHoveredPillTip('alt')}
              onBlur={() => setHoveredPillTip(null)}
              onClick={() => setActivePillTip(activePillTip === 'alt' ? null : 'alt')}
              title={altTip!}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer select-none',
                activePill === 'alt' && 'ring-2 ring-primary/40 shadow-sm'
              )}
            >
              <Mountain className="w-3.5 h-3.5 shrink-0" />
              <span>{destination.altitude_m}m</span>
            </button>
          )}
        </div>

        {/* In-Card Responsive Explanation Banner */}
        {activeTipText && (
          <div className="flex items-start justify-between gap-2 text-xs font-medium text-on-surface bg-surface-container/90 border border-outline-variant/60 rounded-xl px-3 py-2.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <Info className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="leading-snug text-on-surface break-words">{activeTipText}</span>
            </div>
            <button
              type="button"
              onClick={() => { setActivePillTip(null); setHoveredPillTip(null); }}
              className="text-on-surface-variant hover:text-on-surface p-0.5 text-xs font-bold leading-none shrink-0"
              aria-label="Dismiss hint"
            >
              ✕
            </button>
          </div>
        )}

        {/* Synopsis description with Read more */}
        {destination.description && (() => {
          const firstSentenceEnd = destination.description.search(/(?<=[.!?])\s(?=[A-Z])/)
          const cut = firstSentenceEnd > 20 && firstSentenceEnd < 160 ? firstSentenceEnd : 110
          const isLong = destination.description.length > cut + 20
          const summary = isLong ? destination.description.slice(0, cut).trimEnd() : destination.description
          return (
            <div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {summary}
                {isLong && !descExpanded && '…'}
                {isLong && descExpanded && (
                  <span> {destination.description.slice(cut).trimStart()}</span>
                )}
                {isLong && (
                  <button
                    onClick={() => setDescExpanded((v) => !v)}
                    className="ml-1.5 text-xs font-bold text-primary-dark inline-flex items-center gap-0.5 hover:underline"
                  >
                    {descExpanded ? t('tripDetail.readLess') : t('tripDetail.readMore')}
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', descExpanded && 'rotate-180')} />
                  </button>
                )}
              </p>
            </div>
          )
        })()}

        {/* Curated Highlights Inset Container */}
        {destination.highlights && destination.highlights.length > 0 && (
          <div className="p-3.5 bg-amber-500/[0.08] rounded-2xl border border-amber-500/20 space-y-2">
            <ul className="space-y-2">
              {destination.highlights.map((h, i) => (
                <li key={i} className="text-xs sm:text-sm text-on-surface font-medium flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 fill-amber-500 text-white flex-shrink-0 mt-0.5" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Boxed Travel Essentials Specs Bar (Matches Picture 1) ── */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 p-3.5 shadow-sm flex items-center justify-between">
        {/* Best Time */}
        <div className="flex-1 flex flex-col items-center text-center">
          <CalendarDays className="w-4 h-4 text-primary-dark mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            {t('destinationDetail.bestTime', 'Best Time')}
          </span>
          <span className="text-xs font-bold text-on-surface mt-0.5 truncate max-w-full">
            {destination.best_months || 'Oct - Apr'}
          </span>
        </div>

        <div className="w-px h-8 bg-outline-variant/60" />

        {/* Permit */}
        <div className="flex-1 flex flex-col items-center text-center">
          <Shield className="w-4 h-4 text-purple-600 mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            {t('destinationDetail.permit', 'Permit')}
          </span>
          <span className={cn(
            'text-xs font-bold mt-0.5 truncate max-w-full',
            destination.ilp_required ? 'text-purple-700' : 'text-purple-600'
          )}>
            {destination.ilp_required ? 'ILP Required' : 'No ILP'}
          </span>
        </div>

        <div className="w-px h-8 bg-outline-variant/60" />

        {/* Police */}
        <div className="flex-1 flex flex-col items-center text-center">
          <ShieldCheck className="w-4 h-4 text-trust mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            {t('destinationDetail.police', 'Police')}
          </span>
          <span className="text-xs font-bold text-on-surface mt-0.5 truncate max-w-full">
            {destination.nearest_police_km != null ? `${destination.nearest_police_km}km away` : 'Sadar PS'}
          </span>
        </div>
      </div>

      {destination.govt_advisory && (
        <div className="rounded-2xl bg-tsi-high/10 border border-tsi-high/25 px-3 py-2.5 flex items-start gap-2">
          <FileWarning className="w-4 h-4 text-tsi-high flex-shrink-0 mt-0.5" />
          <p className="text-xs text-tsi-high leading-relaxed">{destination.govt_advisory}</p>
        </div>
      )}

      {destination.nearest_hospital_name && (
        <div className="rounded-2xl bg-sos/10 border border-sos/25 px-3.5 py-3 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-sos/15 flex items-center justify-center flex-shrink-0"><HeartPulse className="w-5 h-5 text-sos-dark" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sos-dark">Nearest Hospital</p>
            <p className="text-sm font-bold text-on-surface truncate">{destination.nearest_hospital_name}</p>
            {destination.nearest_hospital_km != null && (
              <p className="text-xs text-on-surface-variant">{destination.nearest_hospital_km}km away</p>
            )}
          </div>
          {destination.nearest_hospital_phone && (
            <a href={`tel:${destination.nearest_hospital_phone}`}
              className="flex-shrink-0 h-9 px-3.5 rounded-full bg-sos text-white text-xs font-bold flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
          )}
        </div>
      )}

      {destination.localOperators && destination.localOperators.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            {t('tripDetail.localOperatorsTitle')}
          </p>
          <p className="text-xs text-on-surface-variant mb-2.5">
            {t('tripDetail.localOperatorsCount', { count: destination.localOperators.length })}
          </p>
          <div className="space-y-2.5">
            {destination.localOperators.map((op) => {
              const Icon = OPERATOR_CATEGORY_ICON[op.category] || Building2
              const tint = OPERATOR_CATEGORY_TINT[op.category]
              return (
                <div key={op.id} className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', tint.bg, tint.text)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-on-surface">{op.business_name}</p>
                        <span className={cn('text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0', tint.bg, tint.text)}>
                          {t(OPERATOR_CATEGORY_LABEL_KEY[op.category])}
                        </span>
                      </div>
                      {op.description && (
                        <p className="text-xs text-on-surface-variant leading-relaxed mt-1">{op.description}</p>
                      )}
                      {op.price_range_text && (
                        <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                          <IndianRupee className="w-3 h-3" /> {op.price_range_text}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {op.contact_phone && (
                          <a href={`tel:${op.contact_phone}`}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-dark bg-primary/10 px-2.5 py-1.5 rounded-full">
                            <Phone className="w-3 h-3" /> {op.contact_phone}
                          </a>
                        )}
                        <a href={getOperatorMapsUrl(op)} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant bg-surface-container px-2.5 py-1.5 rounded-full">
                          <MapPin className="w-3 h-3" /> {t('tripDetail.viewOnMap')}
                        </a>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
                        <ShieldCheck className="w-3 h-3" /> {t('tripDetail.localOperatorVerifiedBadge')}
                      </div>
                      <p className="text-[10px] text-on-surface-variant/70 mt-1">
                        {t('tripDetail.localOperatorSource', { source: op.source })}
                      </p>

                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {op.avgRating != null ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-on-surface">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {op.avgRating.toFixed(1)}
                            <span className="text-on-surface-variant font-medium">
                              ({t('tripDetail.operatorReviewCount', { count: op.reviewCount })})
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant">{t('tripDetail.operatorNoReviewsYet')}</span>
                        )}
                        {ratingOperatorId !== op.id && (
                          <button onClick={() => { setRatingOperatorId(op.id); setRatingValue(0); setRatingText('') }}
                            className="text-xs font-bold text-primary-dark underline">
                            {t('tripDetail.operatorRateThis')}
                          </button>
                        )}
                      </div>

                      {ratingOperatorId === op.id && (
                        <div className="mt-2.5 bg-surface-container rounded-xl p-3">
                          <div className="flex items-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button key={n} onClick={() => setRatingValue(n)} aria-label={`${n} star`}
                                className="p-0.5">
                                <Star className={cn('w-5 h-5', n <= ratingValue ? 'fill-amber-400 text-amber-400' : 'text-outline-variant')} />
                              </button>
                            ))}
                          </div>
                          <textarea value={ratingText} onChange={(e) => setRatingText(e.target.value)} rows={2}
                            placeholder={t('tripDetail.operatorReviewPlaceholder')}
                            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-2 text-xs resize-none focus:outline-none focus:border-primary" />
                          <div className="mt-2 flex items-center gap-2">
                            <button onClick={() => submitOperatorReview(op.id)} disabled={ratingValue === 0 || submittingRating}
                              className="h-8 px-3.5 rounded-full bg-primary text-on-surface text-xs font-bold disabled:opacity-40">
                              {submittingRating ? t('tripDetail.operatorReviewSubmitting') : t('tripDetail.operatorReviewSubmit')}
                            </button>
                            <button onClick={() => setRatingOperatorId(null)} className="text-xs font-semibold text-on-surface-variant">
                              {t('common.cancel')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
