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
import { Siren, Truck, X, Loader2, Plus } from 'lucide-react'
import sosApi from '../../api/sos.api'
import { useSafetyStore } from '../../store/safety.store'
import { markSelfAction } from '../../lib/selfActionSuppress'
import { getErrorMessage } from '../../api/client'
import { formatTimeAgo } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { SOS_SPECIFIC_CATEGORIES } from '../../constants/sosCategories'

const CATEGORY_LABELS: Record<string, string> = {
  MEDICAL: 'Medical', LOST: 'Lost', TRAPPED: 'Trapped',
  DISASTER: 'Disaster', MISSING: 'Missing', CRIME: 'Crime', OTHER: 'Emergency',
}

export function ActiveSOSBanner() {
  const queryClient = useQueryClient()
  const setActiveSOSId = useSafetyStore((s) => s.setActiveSOSId)
  const [confirming, setConfirming] = useState(false)
  const [showAmend, setShowAmend] = useState(false)

  const { data } = useQuery({
    queryKey: ['sos', 'active-rescue'],
    queryFn: () => sosApi.getActiveRescue().then(r => r.data.data),
    refetchInterval: 20_000,
  })

  const { mutate: cancelSOS, isPending: cancelling } = useMutation({
    mutationFn: (sosId: string) => sosApi.markFalseAlarm(sosId),
    // Marked in onMutate, not onSuccess -- the server's socket broadcast
    // for this same status change can (and often does) reach the client
    // before the HTTP response this onSuccess waits on, so setting the
    // suppression flag only after the round-trip completes was too late
    // to actually catch it.
    onMutate: (sosId) => { markSelfAction(sosId) },
    onSuccess: () => {
      toast.success('SOS cancelled — marked as a false alarm')
      setActiveSOSId(null)
      setConfirming(false)
      queryClient.invalidateQueries({ queryKey: ['sos', 'active-rescue'] })
      queryClient.invalidateQueries({ queryKey: ['sos', 'mine'] })
    },
    onError: () => setConfirming(false),
  })

  // A structured "modify my request," not just chat -- the tourist's
  // original category never changes, this adds to a separate, audited,
  // timestamped log govt and the assigned rescuer see live. pendingCategory
  // (rather than just the mutation's own isPending) lets each button show
  // its OWN spinner instead of every option going generically fuzzy at once
  // -- a small thing, but it's the difference between "the app is thinking"
  // and "I don't know what I just tapped."
  const [pendingCategory, setPendingCategory] = useState<string | null>(null)
  const { mutate: amendCategory, isPending: amending } = useMutation({
    mutationFn: (category: string) => sosApi.amendCategory(data!.sosId, category),
    onSuccess: () => {
      toast.success('Added — govt and your rescuer can see this update')
      setShowAmend(false)
      queryClient.invalidateQueries({ queryKey: ['sos', 'active-rescue'] })
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
      // Most likely cause of a failure here is the SOS closing out from
      // under this panel (resolved/false-alarmed elsewhere) -- refetch
      // immediately instead of leaving stale, now-pointless buttons up
      // for however long is left on the 20s poll.
      queryClient.invalidateQueries({ queryKey: ['sos', 'active-rescue'] })
    },
    onSettled: () => setPendingCategory(null),
  })

  if (!data) return null

  const isAssigned = !!data.rescuer
  const categoryLabel = CATEGORY_LABELS[data.category] || data.category
  const alreadyAdded = new Set([data.category, ...data.additionalCategories])
  const amendOptions = SOS_SPECIFIC_CATEGORIES.filter((c) => !alreadyAdded.has(c.value))

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
          {/* Structured amendment log, not just chat -- each addition is a
              real, timestamped API call govt/the rescuer already see live. */}
          {data.additionalCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {data.additionalCategories.map((cat) => (
                <span key={cat} className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5">
                  + {CATEGORY_LABELS[cat] || cat}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {!confirming && !showAmend && amendOptions.length > 0 && (
        <button
          onClick={() => setShowAmend(true)}
          className="mt-2 w-full h-9 rounded-full border border-white/40 text-white text-xs font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add another concern
        </button>
      )}
      {showAmend && (
        <div className="mt-3 pt-3 border-t border-white/20">
          <p className="text-xs text-white/85 mb-2">Is this also something else? This updates govt and your rescuer immediately.</p>
          <div className="grid grid-cols-3 gap-2">
            {amendOptions.map(({ value, Icon }) => (
              <button
                key={value}
                onClick={() => { setPendingCategory(value); amendCategory(value) }}
                disabled={amending}
                className="bg-white/15 hover:bg-white/25 rounded-xl p-2.5 flex flex-col items-center gap-1 text-white disabled:opacity-50 transition-colors"
              >
                {pendingCategory === value ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                <span className="text-[10px] font-bold">{CATEGORY_LABELS[value]}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAmend(false)}
            disabled={amending}
            className="mt-2 w-full h-8 rounded-full text-white/80 text-xs font-semibold hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Mutually exclusive with the amend panel above -- both are
          "secondary action" surfaces, and showing two open control panels
          at once (amend's own Cancel button sitting directly above this
          one) read as cluttered/confusing rather than just busy. */}
      {!showAmend && (
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
      )}
    </div>
  )
}
