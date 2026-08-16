// src/pages/VolunteersPage.tsx
// Closes the loop the SOS Management "Assign Rescuer" panel depends on — a
// volunteer registered in the Rescuer app is invisible to that panel until
// a district officer verifies their government ID here (see
// VolunteerRepository#findNearbyAvailableRescuers's `is_verified = TRUE`
// filter). Without this page the volunteer half of the unified-rescuer
// system had no way to ever go live.
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { HeartHandshake, ShieldCheck, MapPin, Loader2, CheckCircle2, Clock, IdCard, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import govtApi from '../api/govt.api'
import { queryClient } from '../lib/queryClient'
import { formatTimeAgo } from '../lib/utils'
import type { Volunteer } from '../types/api.types'

export default function VolunteersPage() {
  // Verifying grants dispatch access to a stranger's exact GPS location —
  // a one-click action here would be careless for what it actually
  // authorizes, so it goes through an explicit confirm step instead of
  // firing straight off the list row.
  const [reviewing, setReviewing] = useState<Volunteer | null>(null)

  const { data: pending, isLoading } = useQuery({
    queryKey: ['govt', 'volunteers', 'pending'],
    queryFn: () => govtApi.getPendingVolunteers().then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const { mutate: verify, isPending: verifying } = useMutation({
    mutationFn: (id: string) => govtApi.verifyVolunteer(id),
    onSuccess: (res) => {
      toast.success(`${res.data.data.full_name} verified — now assignable to nearby SOS incidents`)
      queryClient.invalidateQueries({ queryKey: ['govt', 'volunteers', 'pending'] })
      setReviewing(null)
    },
  })

  const list = pending || []

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-on-surface">Volunteers</h1>
          <p className="text-on-surface-variant text-sm">Verify local responders before they can be assigned to an SOS</p>
        </div>
        {list.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-semibold text-amber-600">{list.length} pending review</span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && list.length === 0 && (
        <div className="text-center py-20">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-on-surface">No pending verifications</p>
          <p className="text-on-surface-variant text-sm">Every registered volunteer has been reviewed</p>
        </div>
      )}

      <div className="space-y-3">
        {list.map((v: Volunteer) => (
          <div key={v.id} className="rounded-xl p-5 shadow-sm bg-surface-container-lowest border-l-4 border-l-amber-500">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-on-surface">{v.full_name}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant mt-1">
                    <span>{v.phone}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{v.district}, {v.state}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Registered {formatTimeAgo(v.created_at)}</span>
                  </div>
                  <p className="flex items-center gap-1 text-xs text-on-surface-variant mt-1">
                    <IdCard className="w-3 h-3" /> {v.govt_id_type} · ····{v.govt_id_suffix}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setReviewing(v)}
                className="flex-shrink-0 h-9 px-4 bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold text-sm flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Review
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Verification confirm dialog ────────────────────────────── */}
      <Dialog open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify identity — {reviewing?.full_name}</DialogTitle>
            <DialogDescription>
              Confirm this registration before granting dispatch access.
            </DialogDescription>
          </DialogHeader>

          {reviewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-surface-container rounded-xl p-4">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Full name</p>
                  <p className="text-sm font-bold text-on-surface">{reviewing.full_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Phone</p>
                  <p className="text-sm font-bold text-on-surface">{reviewing.phone}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Identity document</p>
                  <p className="text-sm font-bold text-on-surface">{reviewing.govt_id_type} ····{reviewing.govt_id_suffix}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">District</p>
                  <p className="text-sm font-bold text-on-surface">{reviewing.district}, {reviewing.state}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Verifying makes <strong>{reviewing.full_name}</strong> eligible for assignment to real SOS
                  incidents and shares a tourist's live location with them once dispatched. Only confirm if the
                  government ID above matches your records.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)} className="rounded-full">
              Cancel
            </Button>
            <Button
              disabled={verifying}
              onClick={() => reviewing && verify(reviewing.id)}
              className="bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold flex items-center gap-2"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> Confirm & Verify</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
