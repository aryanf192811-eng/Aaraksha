// src/components/shared/DMSCard.tsx
// Dead Man's Switch card: countdown timer + reset button + status indicator.
// Disabling the switch lives on the Safety Center (SOSPage) instead of
// here — this card is the Home-screen summary and should only ever offer
// the one-tap "I'm safe" action; a disable control here would be one tap
// away from someone accidentally turning off their own safety net.
import { Timer, RotateCcw, AlertCircle, Siren } from 'lucide-react'
import { Button } from '../ui/button'
import { cn, formatCountdown } from '../../lib/utils'
import { useSafetyStore } from '../../store/safety.store'
import { useDMS } from '../../hooks/useDMS'
import type { DMS } from '../../types/api.types'

interface DMSCardProps {
  dms: DMS | null
  className?: string
}

export function DMSCard({ dms, className }: DMSCardProps) {
  const { resetDMS, resetting } = useDMS()
  const { dmsSecondsRemaining, dmsWarning } = useSafetyStore()

  if (!dms) {
    return (
      <div className={cn('rounded-2xl border border-dashed border-outline-variant p-5 text-center', className)}>
        <Timer className="w-8 h-8 text-on-surface-variant mx-auto mb-2" />
        <p className="text-sm font-medium text-on-surface-variant">No active Dead Man's Switch</p>
        <p className="text-xs text-on-surface-variant/70 mt-1">Activate from the SOS screen</p>
      </div>
    )
  }

  const seconds = dmsSecondsRemaining ?? dms.seconds_remaining ?? 0
  const isWarning = dmsWarning || seconds <= 600
  const isTriggered = dms.status === 'TRIGGERED'

  return (
    <div className={cn(
      'rounded-2xl border-2 p-5 transition-all duration-300',
      isTriggered   ? 'border-sos bg-sos/5 shadow-lg shadow-sos/10' :
      isWarning     ? 'border-primary bg-primary/5 shadow-md shadow-primary/10 animate-pulse' :
      dms.status === 'PAUSED' ? 'border-outline-variant bg-surface-container shadow-sm' :
                      'border-tsi-low/40 bg-tsi-low/5 shadow-sm',
      className,
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Timer className={cn('w-5 h-5',
            isTriggered ? 'text-sos' : isWarning ? 'text-primary' : 'text-tsi-low'
          )} />
          <span className="text-sm font-bold text-on-surface">Dead Man's Switch</span>
        </div>
        {/* Status badge */}
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold',
          isTriggered ? 'bg-sos/15 text-sos-dark' :
          dms.status === 'PAUSED' ? 'bg-surface-container-high text-on-surface-variant' :
          isWarning   ? 'bg-primary/15 text-primary-dark' :
                        'bg-tsi-low/15 text-tsi-low'
        )}>
          {dms.status}
        </span>
      </div>

      {/* Countdown */}
      {dms.status === 'ACTIVE' && (
        <div className="text-center my-4">
          <p className={cn('font-display text-4xl font-black tabular-nums',
            isWarning ? 'text-primary-dark' : 'text-on-surface'
          )}>
            {formatCountdown(Math.max(0, seconds))}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">until auto-SOS</p>
        </div>
      )}

      {/* Warning message */}
      {isWarning && dms.status === 'ACTIVE' && (
        <div className="flex items-center gap-2 bg-primary/15 rounded-lg p-2 mb-3">
          <AlertCircle className="w-4 h-4 text-primary-dark flex-shrink-0" />
          <p className="text-xs text-primary-dark font-medium">Check in now or SOS will auto-trigger</p>
        </div>
      )}

      {/* Triggered — the countdown block above only renders for ACTIVE, so
          without this the card went blank between the header badge and the
          footer once status flipped, giving no confirmation anything
          happened. */}
      {isTriggered && (
        <div className="flex items-center gap-2 bg-sos/15 rounded-lg p-3 mb-3">
          <Siren className="w-5 h-5 text-sos-dark flex-shrink-0" />
          <p className="text-sm text-sos-dark font-semibold">
            Missed check-in — an automatic SOS has been sent to authorities and your emergency contacts.
          </p>
        </div>
      )}

      {/* Actions */}
      {dms.status === 'ACTIVE' && (
        <Button
          onClick={() => resetDMS(dms.id)}
          disabled={resetting}
          className="w-full bg-tsi-low hover:brightness-110 text-white rounded-full h-11 font-bold"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {resetting ? 'Checking in...' : "I'm Safe — Check In"}
        </Button>
      )}

      <p className="text-xs text-on-surface-variant/70 text-center mt-2">
        {dms.interval_seconds != null
          ? `Interval: every ${dms.interval_seconds}s (demo mode)`
          : `Interval: every ${dms.interval_minutes} minutes`}
      </p>
    </div>
  )
}
