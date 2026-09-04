// src/pages/TrustAppealsPage.tsx
// The govt-side half of the trust-score anti-fraud loop — closes it back
// up: a restricted tourist can appeal, and this is where a district officer
// decides. Same pending-review-queue pattern as VolunteersPage's "Pending
// Review" tab (badge-counted nav item, card list, confirm dialog with an
// amber warning box) -- the closest existing template, not a new UI
// language for what's conceptually the same kind of decision.
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ShieldAlert, Loader2, CheckCircle2, Clock, ThumbsUp, ThumbsDown, Gauge } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import govtApi, { type TrustAppeal } from '../api/govt.api'
import { getErrorMessage } from '../api/client'
import { queryClient } from '../lib/queryClient'
import { formatTimeAgo } from '../lib/utils'

export default function TrustAppealsPage() {
  const [reviewing, setReviewing] = useState<TrustAppeal | null>(null)
  const [notes, setNotes] = useState('')

  const { data: pending, isLoading } = useQuery({
    queryKey: ['govt', 'trust-appeals'],
    queryFn: () => govtApi.getPendingTrustAppeals().then((r) => r.data.data),
    refetchInterval: 30_000,
  })

  const { mutate: decide, isPending: deciding } = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVE' | 'REJECT' }) =>
      govtApi.decideTrustAppeal(id, decision, notes.trim() || undefined),
    onSuccess: (_res, { decision }) => {
      toast.success(decision === 'APPROVE' ? "Appeal approved — the tourist's access is restored" : 'Appeal rejected')
      queryClient.invalidateQueries({ queryKey: ['govt', 'trust-appeals'] })
      setReviewing(null)
      setNotes('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const pendingList = pending || []

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-on-surface">Trust Appeals</h1>
        <p className="text-on-surface-variant text-sm">
          Restricted tourists' pleas to restore full access — approving resets their score to a watched midpoint, not a full reset.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      )}
      {!isLoading && pendingList.length === 0 && (
        <div className="text-center py-16 px-6 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest">
          <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <p className="text-lg font-bold text-on-surface">No pending appeals</p>
          <p className="text-on-surface-variant text-sm">Every submitted appeal has been reviewed</p>
        </div>
      )}

      <div className="space-y-3">
        {pendingList.map((a) => (
          <div key={a.id} className="rounded-xl p-5 shadow-sm bg-surface-container-lowest border-l-4 border-l-amber-500">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-on-surface">{a.full_name}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant mt-1">
                    <span>{a.phone}</span>
                    <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />Trust score: {a.trust_score}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Submitted {formatTimeAgo(a.created_at)}</span>
                  </div>
                  <p className="text-sm text-on-surface mt-2 bg-surface-container rounded-lg p-2.5">{a.message}</p>
                </div>
              </div>
              <Button onClick={() => setReviewing(a)}
                className="flex-shrink-0 h-9 px-4 bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold text-sm flex items-center gap-2">
                Review
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!reviewing} onOpenChange={(open) => { if (!open) { setReviewing(null); setNotes('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review appeal — {reviewing?.full_name}</DialogTitle>
            <DialogDescription>Approving restores full access; rejecting leaves the restriction in place.</DialogDescription>
          </DialogHeader>

          {reviewing && (
            <div className="space-y-4">
              <div className="bg-surface-container rounded-xl p-4">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1">Their appeal</p>
                <p className="text-sm text-on-surface">{reviewing.message}</p>
              </div>

              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Approving resets <strong>{reviewing.full_name}</strong>'s trust score to 50 (a clean slate,
                  still watched — not back to 100) and lifts the restriction immediately. This was never
                  blocking their ability to trigger a real SOS.
                </p>
              </div>

              <Textarea placeholder="Notes (optional) — visible in the audit trail" value={notes}
                onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl resize-none" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" disabled={deciding} onClick={() => reviewing && decide({ id: reviewing.id, decision: 'REJECT' })}
              className="rounded-full font-bold flex items-center gap-2 border-sos/40 text-sos hover:bg-sos/10 hover:text-sos">
              {deciding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ThumbsDown className="w-4 h-4" /> Reject</>}
            </Button>
            <Button disabled={deciding} onClick={() => reviewing && decide({ id: reviewing.id, decision: 'APPROVE' })}
              className="bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold flex items-center gap-2">
              {deciding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ThumbsUp className="w-4 h-4" /> Approve</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
