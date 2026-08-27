// src/components/shared/TSIBreakdown.tsx
// tsi.service.js has always computed a factor-by-factor breakdown
// (tsi_factors) and stored it on the trip — the API already returned it,
// the frontend type already declared it, nothing ever rendered it. A
// score with no visible reasoning reads as arbitrary; this makes the
// engine show its work.
import { AlertTriangle, TrendingDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TSIFactors } from '../../types/api.types'

const FACTOR_LABELS: Record<string, string> = {
  travelType: 'Travel type',
  duration: 'Trip duration',
  season: 'Monsoon season',
  connectivity: 'Connectivity',
  medicalAccess: 'Medical access',
  terrain: 'Altitude / terrain',
  restrictedZone: 'Zone restrictions',
  difficulty: 'Route difficulty',
  weather: 'Weather',
}

function riskColor(score: number) {
  if (score >= 80) return 'text-tsi-low'
  if (score >= 60) return 'text-tsi-moderate'
  if (score >= 40) return 'text-tsi-high'
  return 'text-sos'
}

export function TSIBreakdown({ score, label, factors }: { score: number; label: string; factors: TSIFactors }) {
  const worstStop = factors.stopRisks?.reduce((w, s) => (!w || s.penalty > w.penalty ? s : w), factors.stopRisks[0])

  // Trip-level modifiers (always present) plus, when stop data exists, the
  // worst stop's own factors unrolled into the same flat list — that's
  // where most of a typical score's penalty actually comes from, and the
  // old UI only ever showed the combined "worstStop" total.
  const rows: { label: string; delta: number }[] = []
  if (factors.travelType) rows.push({ label: FACTOR_LABELS.travelType, delta: factors.travelType })
  if (factors.duration) rows.push({ label: FACTOR_LABELS.duration, delta: factors.duration })
  if (factors.season) rows.push({ label: FACTOR_LABELS.season, delta: factors.season })

  if (worstStop) {
    for (const [key, delta] of Object.entries(worstStop.factors)) {
      if (delta) rows.push({ label: `${FACTOR_LABELS[key] || key} (${worstStop.city})`, delta })
    }
  } else if (factors.worstStop) {
    rows.push({ label: 'Highest-risk stop', delta: factors.worstStop })
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant p-5">
      <div className="flex items-center gap-2 mb-1">
        <TrendingDown className="w-4 h-4 text-on-surface-variant" />
        <h3 className="font-bold text-on-surface">Why this score?</h3>
      </div>
      <p className="text-xs text-on-surface-variant mb-4">Rule-based, not AI — every point is a specific, checkable reason</p>

      <div className="flex items-baseline gap-2 mb-4">
        <span className={cn('text-3xl font-black', riskColor(score))}>{score}</span>
        <span className="text-sm text-on-surface-variant">/ 100</span>
        <span className={cn('ml-auto text-xs font-bold px-2 py-1 rounded-full', riskColor(score), 'bg-current/10')}>{label}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-on-surface-variant font-semibold uppercase tracking-wide pb-1 border-b border-outline-variant">
          <span>Base score</span>
          <span className="tabular-nums">100</span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm py-0.5">
            <span className="text-on-surface-variant">{row.label}</span>
            <span className={cn('font-bold tabular-nums', row.delta < 0 ? 'text-sos' : 'text-tsi-low')}>
              {row.delta > 0 ? '+' : ''}{row.delta}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between text-sm font-black pt-1.5 border-t border-outline-variant">
          <span className="text-on-surface">Risk-adjusted score</span>
          <span className={cn('tabular-nums', riskColor(score))}>{score}</span>
        </div>
      </div>

      {worstStop && (
        <div className="flex items-start gap-2 mt-4 pt-4 border-t border-outline-variant text-xs text-on-surface-variant">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-primary-dark" />
          <p><strong className="text-on-surface">{worstStop.city}</strong> drives this score — the trip's risk is set by its riskiest stop, not an average.</p>
        </div>
      )}
    </div>
  )
}
