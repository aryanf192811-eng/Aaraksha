// src/components/shared/SafetyAdvisory.tsx
// Gemini explains the ALREADY-computed deterministic TSI — it never scores
// or decides anything (see backend/src/services/gemini.service.js#generateSafetyAdvisory).
// On-demand, not auto-fetched: same "Generate" pattern as the AI packing
// list, since it's a real API call with latency/cost, not free to prefetch.
// Explicitly not a chatbot — one-shot generation, no follow-up input.
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sparkles, Loader2, RefreshCw, WifiOff, ChevronDown } from 'lucide-react'
import tripApi from '../../api/trip.api'
import { cn } from '../../lib/utils'

export function SafetyAdvisory({ tripId }: { tripId: string }) {
  // Expanded by default the moment a briefing is generated (the user just
  // asked for it) — the toggle exists to let them collapse it back down
  // afterward without losing the result, not to hide it on arrival.
  const [expanded, setExpanded] = useState(true)
  const { data, mutate, isPending } = useMutation({
    mutationFn: () => tripApi.getSafetyAdvisory(tripId).then(r => r.data.data),
    onSuccess: () => setExpanded(true),
  })

  if (!data) {
    return (
      <button onClick={() => mutate()} disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 text-primary text-sm font-bold py-3 hover:bg-primary/5 transition-colors disabled:opacity-60">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {isPending ? 'Analyzing your route...' : 'Get AI Safety Briefing'}
      </button>
    )
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 animate-slide-up">
      <div className="w-full flex items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center justify-between gap-2 min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5" /> AI Safety Briefing
          </p>
          <ChevronDown className={cn('w-4 h-4 text-primary transition-transform flex-shrink-0', expanded && 'rotate-180')} />
        </button>
        <button type="button" onClick={() => mutate()} disabled={isPending} title="Regenerate"
          className="text-on-surface-variant hover:text-primary transition-colors disabled:opacity-60 flex-shrink-0">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <>
          <ul className="mt-3 space-y-2">
            {data.advisory.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-on-surface leading-snug">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0 mt-1.5" />
                {bullet}
              </li>
            ))}
          </ul>
          {data.source === 'OFFLINE_FALLBACK' && (
            <p className="flex items-center gap-1 text-[11px] text-on-surface-variant mt-3 pt-2.5 border-t border-primary/10">
              <WifiOff className="w-3 h-3 flex-shrink-0" /> AI unavailable right now — showing a summary from your safety score directly
            </p>
          )}
        </>
      )}
    </div>
  )
}
