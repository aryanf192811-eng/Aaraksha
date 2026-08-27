// src/components/shared/ActiveSOSBanner.tsx
// The backend's false-alarm endpoint (PATCH /sos/:id/false-alarm) has
// existed since early in the build but was never wired to a button
// anywhere — a tourist had no way to call off their own SOS short of
// waiting for a govt operator to resolve it. Shares the same
// ['sos','active-rescue'] query RescueTrackingCard already polls, so this
// renders whenever there's an unresolved SOS regardless of whether a
// rescuer has been assigned yet.
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Siren, Truck, X, Loader2 } from 'lucide-react'
import sosApi from '../../api/sos.api'
import { useSafetyStore } from '../../store/safety.store'
import { formatTimeAgo } from '../../lib/utils'
import { cn } from '../../lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  MEDICAL: 'Medical', LOST: 'Lost', TRAPPED: 'Trapped',
  DISASTER: 'Disaster', MISSING: 'Missing', CRIME: 'Crime', OTHER: 'Emergency',
}

export function ActiveSOSBanner() {
  const queryClient = useQueryClient()
  const setActiveSOSId = useSafetyStore((s) => s.setActiveSOSId)
  const [confirming, setConfirming] = useState(false)

  const { data } = useQuery({
    queryKey: ['sos', 'active-rescue'],
    queryFn: () => sosApi.getActiveRescue().then(r => r.data.data),
    refetchInterval: 20_000,
  })

  const { mutate: cancelSOS, isPending: cancelling } = useMutation({
    mutationFn: (sosId: string) => sosApi.markFalseAlarm(sosId),
    onSuccess: () => {
      toast.success('SOS cancelled — marked as a false alarm')
      setActiveSOSId(null)
      setConfirming(false)
      queryClient.invalidateQueries({ queryKey: ['sos', 'active-rescue'] })
      queryClient.invalidateQueries({ queryKey: ['sos', 'mine'] })
    },
    onError: () => setConfirming(false),
  })

  if (!data) return null

  const isAssigned = !!data.rescuer
  const categoryLabel = CATEGORY_LABELS[data.category] || data.category

  return (
    <div className={cn(
      'rounded-2xl p-4 border-2 animate-slide-up',
      isAssigned ? 'bg-primary border-primary text-primary-foreground' : 'bg-sos border-sos text-white'
    )}>
      <div className="flex items-start gap-3">
        {isAssigned ? <Truck className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <Siren className="w-5 h-5 flex-shrink-0 mt-0.5 animate-pulse" />}
        <div className="flex-1 min-w-0">
          <p className="font-display font-black">{isAssigned ? 'Help is on the way' : 'SOS Active'}</p>
          <p className="text-xs text-white/85 mt-0.5">
            {categoryLabel} · Triggered {formatTimeAgo(data.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/20">
        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => cancelSOS(data.sosId)}
              disabled={cancelling}
              className="flex-1 h-9 rounded-full bg-white text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              {cancelling ? 'Cancelling...' : 'Confirm — this was a false alarm'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={cancelling}
              className="flex-1 h-9 rounded-full border border-white/40 text-white text-xs font-bold"
            >
              Keep active
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="w-full h-9 rounded-full border border-white/40 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
          >
            This was a false alarm
          </button>
        )}
      </div>
    </div>
  )
}
