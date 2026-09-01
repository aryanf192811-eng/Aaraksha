// src/components/shared/travelAssistant/JourneyResultCard.tsx
// The "premium" surface of the Travel Assistant: a generated journey
// rendered as real visual cards (transport-mode SVG icon per leg, cost/
// duration pills, an inline TSI-style safety badge), not a wall of chat
// text. Legs reveal staggered on mount (30-50ms/item, per this app's
// motion conventions) and respect prefers-reduced-motion.
import { useEffect, useState } from 'react'
import { Train, Plane, Bus, Car, Ship, Waypoints, MapPin, IndianRupee, Clock, ShieldCheck, ChevronDown, Star, Sparkles } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { BuildJourneyResult, JourneyLeg } from '../../../api/travelPlanner.api'

// MIXED/FERRY: see chatbot.md's "Multi-modal legs" convention -- a single
// typical_routes row can legitimately represent a connecting journey (e.g.
// road + government ferry) rather than one physical vehicle, disclosed via
// `notes` (rendered below) instead of hidden inside a combined duration.
const MODE_ICON: Record<string, typeof Train> = {
  TRAIN: Train, FLIGHT: Plane, BUS: Bus, SHARED_TAXI: Car, LOCAL_TRANSPORT: Car,
  FERRY: Ship, MIXED: Waypoints,
}

// Same score-band language as SOSManagementPage.tsx's TSI_STYLE badge --
// a generated-but-not-yet-committed journey and a real trip should never
// disagree about what "Low Risk" vs "High Risk" looks like.
const SAFETY_STYLE = (score: number) =>
  score >= 80 ? 'bg-emerald-100 text-emerald-700' : score >= 60 ? 'bg-amber-100 text-amber-700' : score >= 40 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'

function fmtInr(n: number | null) {
  if (n == null) return '—'
  return `₹${n.toLocaleString('en-IN')}`
}
function fmtDuration(min: number | null) {
  if (min == null) return 'time varies'
  const h = Math.round(min / 60)
  return h < 1 ? `${min}m` : `~${h}h`
}

function LegRow({ leg, index }: { leg: JourneyLeg; index: number }) {
  const [visible, setVisible] = useState(false)
  const Icon = MODE_ICON[leg.mode] || Car
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) { setVisible(true); return }
    const t = setTimeout(() => setVisible(true), index * 40)
    return () => clearTimeout(t)
  }, [index])

  return (
    <div className={cn(
      'flex items-center gap-3 py-2.5 transition-all duration-300 ease-out',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
    )}>
      <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-surface truncate">{leg.fromName} → {leg.toName}</p>
        <p className="text-xs text-on-surface-variant flex items-center gap-1.5 flex-wrap">
          <Clock className="w-3 h-3" /> {fmtDuration(leg.durationMinutes)}
          <span aria-hidden>·</span>
          <IndianRupee className="w-3 h-3" /> {fmtInr(leg.costMinInr)}-{fmtInr(leg.costMaxInr)?.replace('₹', '')}
          {leg.estimated && <span className="text-[10px] uppercase tracking-wide font-bold text-amber-600 ml-1">estimated</span>}
        </p>
        {/* Disclosure for anything a bare from->to/duration/cost row can't
            say on its own -- e.g. a MIXED leg's actual road+ferry
            breakdown. Never hide this; it's often the safety-relevant part. */}
        {leg.notes && <p className="text-[11px] text-on-surface-variant/80 mt-0.5 leading-snug">{leg.notes}</p>}
      </div>
    </div>
  )
}

// externalLegs is optional: a fresh build-journey result has it (the
// Delhi->Guwahati-style gateway hop), but an AI-proposed adjustment to an
// ALREADY-COMMITTED trip doesn't -- there's no fresh "how you got to
// Guwahati" leg to show when only the NE-internal stops changed. Found by
// live-testing the adjust flow: this component originally assumed
// externalLegs always existed and crashed rendering a proposal.
export function JourneyResultCard({ result }: { result: Omit<BuildJourneyResult, 'externalLegs'> & { externalLegs?: BuildJourneyResult['externalLegs'] } }) {
  const [showWhy, setShowWhy] = useState(true)
  const { itinerary } = result
  const worst = itinerary.safety.worstStop

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden">
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white px-4 py-3.5">
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">Your Journey</p>
        <p className="font-display font-black text-lg leading-tight">
          {itinerary.orderedStops.map((s) => s.name).join(' → ')}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs font-semibold">
          <span className="flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" /> {result.totalCostInr.toLocaleString('en-IN')} est.</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {itinerary.daysNeeded} days</span>
          <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 bg-white/20')}>
            <ShieldCheck className="w-3.5 h-3.5" /> {itinerary.scores.safety}/100
          </span>
        </div>
      </div>

      <div className="px-4 py-3 divide-y divide-outline-variant/60">
        {result.externalLegs && <LegRow leg={result.externalLegs.outbound} index={0} />}
        {itinerary.legs.map((leg, i) => <LegRow key={i} leg={leg} index={i + 1} />)}
        {result.externalLegs && <LegRow leg={result.externalLegs.return} index={itinerary.legs.length + 1} />}
      </div>

      {itinerary.orderedStops.some((s) => s.reviewSummary) && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {itinerary.orderedStops.filter((s) => s.reviewSummary).map((s) => (
            <div key={s.id} className="flex items-center gap-1 text-xs bg-surface-container px-2.5 py-1 rounded-full">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span className="font-bold">{s.name}</span>
              <span className="text-on-surface-variant">{s.reviewSummary!.avgRating}/5 · {s.reviewSummary!.reviewCount} review{s.reviewSummary!.reviewCount === 1 ? '' : 's'}</span>
            </div>
          ))}
        </div>
      )}

      {worst && (
        <div className={cn('mx-4 mb-3 rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-semibold', SAFETY_STYLE(itinerary.scores.safety))}>
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          {worst.city} is the highest-risk stop on this route ({worst.label})
        </div>
      )}

      <button onClick={() => setShowWhy((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-outline-variant text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
        <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Why this route</span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', showWhy && 'rotate-180')} />
      </button>
      {showWhy && (
        <ul className="px-4 pb-4 space-y-1.5">
          {result.whyThisRoute.map((line, i) => (
            <li key={i} className="text-xs text-on-surface-variant leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-amber-500">
              {line}
            </li>
          ))}
          {result.narrativeSource === 'TEMPLATED_FALLBACK' && (
            <li className="text-[10px] text-on-surface-variant/70 italic pt-1">AI explanation unavailable right now — showing a summary instead.</li>
          )}
        </ul>
      )}
    </div>
  )
}
