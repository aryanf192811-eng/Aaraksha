// src/components/shared/SafetyTimeline.tsx
// The escalation ladder (check-in → DMS warning → DMS timeout → SOS →
// rescue assigned) has always existed *behaviorally* — dms.service.js's
// processDMSWarnings/processDMSTriggers and sos.service.js's assignment
// flow already implement every step. It just had no single visual
// representation showing a tourist (or, via the same shape, a govt
// operator) where they currently sit on it. This derives the current
// level from state already being fetched elsewhere (DMS + active SOS) —
// no new table, no new service, no second source of truth.
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '../../lib/utils'
import sosApi from '../../api/sos.api'
import type { DMS } from '../../types/api.types'
import type { ActiveRescueInfo } from '../../api/sos.api'

export type EscalationLevel = 0 | 1 | 2 | 3

const STEPS: { level: EscalationLevel; label: string }[] = [
  { level: 0, label: 'Checked in' },
  { level: 1, label: "DMS warning" },
  { level: 2, label: 'SOS active' },
  { level: 3, label: 'Rescue assigned' },
]

export function computeEscalationLevel(dms: DMS | null | undefined, activeSOS: ActiveRescueInfo | null | undefined): EscalationLevel {
  if (activeSOS?.rescuer) return 3
  if (activeSOS) return 2
  if (dms?.status === 'ACTIVE' && dms.warning_sent_at) return 1
  return 0
}

// Shares the ['sos','active-rescue'] query cache with ActiveSOSBanner/
// RescueTrackingCard (react-query dedupes by key, so this is not an extra
// network request) — lets callers decide whether to render a wrapper
// around <SafetyTimeline> at all, since it renders nothing at level 0.
export function useEscalationLevel(dms: DMS | null | undefined): EscalationLevel {
  const { data: activeSOS } = useQuery({
    queryKey: ['sos', 'active-rescue'],
    queryFn: () => sosApi.getActiveRescue().then(r => r.data.data),
    refetchInterval: 20_000,
  })
  return computeEscalationLevel(dms, activeSOS)
}

export function SafetyTimeline({ dms }: { dms: DMS | null | undefined }) {
  const level = useEscalationLevel(dms)
  if (level === 0) return null // nothing escalated — no need to take up space saying so

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant p-4">
      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-3">Safety Timeline</p>
      <div className="flex items-center">
        {STEPS.map((step, i) => (
          <div key={step.level} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              {step.level < level ? (
                <CheckCircle2 className="w-5 h-5 text-tsi-low" />
              ) : step.level === level ? (
                <Circle className="w-5 h-5 text-sos fill-sos/20 animate-pulse" />
              ) : (
                <Circle className="w-5 h-5 text-outline-variant" />
              )}
              <span className={cn('text-[10px] font-semibold text-center leading-tight w-16',
                step.level <= level ? 'text-on-surface' : 'text-on-surface-variant')}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-0.5 flex-1 mx-1 -mt-4', step.level < level ? 'bg-tsi-low' : 'bg-outline-variant')} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
