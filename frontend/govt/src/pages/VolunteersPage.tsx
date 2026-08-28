// src/pages/VolunteersPage.tsx
// Closes the loop the SOS Management "Assign Rescuer" panel depends on — a
// volunteer is invisible to that panel until they're verified. Two paths
// in here: review a citizen's own sign-up (Pending Review), or provision
// one directly for a walk-in local responder (Add Volunteer) — both land
// in the same roster, and both require a govt operator to vouch for them.
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  HeartHandshake, ShieldCheck, MapPin, Loader2, CheckCircle2, Clock, IdCard,
  AlertTriangle, UserPlus, Copy, Check, Award, Radio, UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import govtApi, { type CreateVolunteerPayload } from '../api/govt.api'
import { queryClient } from '../lib/queryClient'
import { formatTimeAgo, cn } from '../lib/utils'
import type { Volunteer } from '../types/api.types'

const GOVT_ID_TYPES: { value: CreateVolunteerPayload['govtIdType']; label: string }[] = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'DRIVING_LICENSE', label: 'Driving Licence' },
]

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  AVAILABLE: { label: 'Available', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  DEPLOYED:  { label: 'Deployed',  dot: 'bg-amber-500 animate-pulse', text: 'text-amber-700' },
  OFF_DUTY:  { label: 'Off duty',  dot: 'bg-slate-400', text: 'text-slate-600' },
}

const EMPTY_FORM: CreateVolunteerPayload = {
  fullName: '', phone: '', govtIdType: 'AADHAAR', govtIdNumber: '', district: '', state: '',
}

export default function VolunteersPage() {
  const [tab, setTab] = useState<'pending' | 'roster'>('pending')
  const [reviewing, setReviewing] = useState<Volunteer | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<CreateVolunteerPayload>(EMPTY_FORM)
  const [credentials, setCredentials] = useState<{ volunteer: Volunteer; temporaryPassword: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: pending, isLoading: loadingPending } = useQuery({
    queryKey: ['govt', 'volunteers', 'pending'],
    queryFn: () => govtApi.getPendingVolunteers().then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const { data: roster, isLoading: loadingRoster } = useQuery({
    queryKey: ['govt', 'volunteers', 'all'],
    queryFn: () => govtApi.getAllVolunteers().then(r => r.data.data),
    refetchInterval: 30_000,
    enabled: tab === 'roster',
  })

  const { mutate: verify, isPending: verifying } = useMutation({
    mutationFn: (id: string) => govtApi.verifyVolunteer(id),
    onSuccess: (res) => {
      toast.success(`${res.data.data.full_name} verified — now assignable to nearby SOS incidents`)
      queryClient.invalidateQueries({ queryKey: ['govt', 'volunteers'] })
      setReviewing(null)
    },
  })

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: (id: string) => govtApi.rejectVolunteer(id),
    onSuccess: (res) => {
      toast.success(`${res.data.data.full_name}'s application was rejected`)
      queryClient.invalidateQueries({ queryKey: ['govt', 'volunteers'] })
      setReviewing(null)
    },
  })

  const { mutate: createVolunteer, isPending: submittingCreate } = useMutation({
    mutationFn: (data: CreateVolunteerPayload) => govtApi.createVolunteer(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['govt', 'volunteers'] })
      setCreating(false)
      setForm(EMPTY_FORM)
      setCredentials(res.data.data)
    },
  })

  const copyCredentials = () => {
    if (!credentials) return
    navigator.clipboard.writeText(`Phone: ${credentials.volunteer.phone}\nPassword: ${credentials.temporaryPassword}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pendingList = pending || []
  const rosterList = roster || []
  const formValid = form.fullName.trim().length >= 2 && form.phone.trim().length === 10
    && form.govtIdNumber.trim().length >= 8 && form.district.trim().length >= 2 && form.state.trim().length >= 2

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-on-surface">Volunteers</h1>
          <p className="text-on-surface-variant text-sm">Verified local responders eligible for SOS assignment</p>
        </div>
        <Button onClick={() => setCreating(true)}
          className="h-10 px-4 bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold text-sm flex items-center gap-2 flex-shrink-0">
          <UserPlus className="w-4 h-4" /> Add Volunteer
        </Button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-surface-container rounded-full p-1 w-fit mb-5">
        <button onClick={() => setTab('pending')}
          className={cn('h-9 px-4 rounded-full text-sm font-bold transition-colors flex items-center gap-1.5',
            tab === 'pending' ? 'bg-surface-container-lowest shadow-sm text-on-surface' : 'text-on-surface-variant')}>
          Pending Review
          {pendingList.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] rounded-full w-4.5 h-4.5 flex items-center justify-center font-bold">{pendingList.length}</span>
          )}
        </button>
        <button onClick={() => setTab('roster')}
          className={cn('h-9 px-4 rounded-full text-sm font-bold transition-colors',
            tab === 'roster' ? 'bg-surface-container-lowest shadow-sm text-on-surface' : 'text-on-surface-variant')}>
          All Volunteers
        </button>
      </div>

      {/* ── Pending Review ────────────────────────────────────── */}
      {tab === 'pending' && (
        <>
          {loadingPending && (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          )}
          {!loadingPending && pendingList.length === 0 && (
            <div className="text-center py-20">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-lg font-bold text-on-surface">No pending verifications</p>
              <p className="text-on-surface-variant text-sm">Every registered volunteer has been reviewed</p>
            </div>
          )}
          <div className="space-y-3">
            {pendingList.map((v: Volunteer) => (
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
                  <Button onClick={() => setReviewing(v)}
                    className="flex-shrink-0 h-9 px-4 bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Review
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── All Volunteers (roster) ───────────────────────────── */}
      {tab === 'roster' && (
        <>
          {loadingRoster && (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          )}
          {!loadingRoster && rosterList.length === 0 && (
            <div className="text-center py-20">
              <HeartHandshake className="w-12 h-12 text-on-surface-variant mx-auto mb-4 opacity-40" />
              <p className="text-lg font-bold text-on-surface">No volunteers yet</p>
              <p className="text-on-surface-variant text-sm">Verified sign-ups and provisioned accounts will appear here</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rosterList.map((v: Volunteer) => {
              const meta = STATUS_META[v.status] ?? STATUS_META.OFF_DUTY
              return (
                <div key={v.id} className="rounded-xl p-4 shadow-sm bg-surface-container-lowest border border-outline-variant/60">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                      <HeartHandshake className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-on-surface truncate">{v.full_name}</p>
                        {v.is_verified
                          ? <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          : <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0">Unverified</span>}
                      </div>
                      <p className="text-xs text-on-surface-variant truncate">{v.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Radio className={cn('w-3 h-3', meta.text)} />
                    <span className={cn('text-xs font-bold', meta.text)}>{meta.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{v.district}</span>
                    <span className="flex items-center gap-1 font-semibold text-primary"><Award className="w-3 h-3" />{v.points} pts</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Verification confirm dialog ────────────────────────── */}
      <Dialog open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review application — {reviewing?.full_name}</DialogTitle>
            <DialogDescription>Verify to grant dispatch access, or reject if the ID doesn't check out.</DialogDescription>
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
            <Button variant="outline" onClick={() => setReviewing(null)} className="rounded-full">Cancel</Button>
            <Button variant="outline" disabled={rejecting || verifying} onClick={() => reviewing && reject(reviewing.id)}
              className="rounded-full font-bold flex items-center gap-2 border-sos/40 text-sos hover:bg-sos/10 hover:text-sos">
              {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserX className="w-4 h-4" /> Reject</>}
            </Button>
            <Button disabled={verifying || rejecting} onClick={() => reviewing && verify(reviewing.id)}
              className="bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold flex items-center gap-2">
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> Confirm & Verify</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Provision a volunteer directly ─────────────────────── */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a volunteer</DialogTitle>
            <DialogDescription>
              For a walk-in local responder or an outreach contact — this account is verified immediately and a
              one-time password is generated for them to log into the Rescuer app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label htmlFor="volunteer-fullname" className="text-xs font-semibold text-on-surface-variant mb-1 block">Full name *</label>
              <Input id="volunteer-fullname" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="e.g. Bikash Gogoi" className="h-10 rounded-lg" />
            </div>
            <div>
              <label htmlFor="volunteer-phone" className="text-xs font-semibold text-on-surface-variant mb-1 block">Phone *</label>
              <Input id="volunteer-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                placeholder="10-digit mobile number" className="h-10 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant mb-1 block">ID type</label>
                <Select value={form.govtIdType} onValueChange={(v) => setForm(f => ({ ...f, govtIdType: v as CreateVolunteerPayload['govtIdType'] }))}>
                  <SelectTrigger aria-label="ID type" className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOVT_ID_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="volunteer-id-number" className="text-xs font-semibold text-on-surface-variant mb-1 block">ID number *</label>
                <Input id="volunteer-id-number" value={form.govtIdNumber} onChange={e => setForm(f => ({ ...f, govtIdNumber: e.target.value }))}
                  placeholder="ID number" className="h-10 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="volunteer-district" className="text-xs font-semibold text-on-surface-variant mb-1 block">District *</label>
                <Input id="volunteer-district" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                  placeholder="e.g. Kamrup Metropolitan" className="h-10 rounded-lg" />
              </div>
              <div>
                <label htmlFor="volunteer-state" className="text-xs font-semibold text-on-surface-variant mb-1 block">State *</label>
                <Input id="volunteer-state" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                  placeholder="e.g. Assam" className="h-10 rounded-lg" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setForm(EMPTY_FORM) }} className="rounded-full">Cancel</Button>
            <Button disabled={!formValid || submittingCreate} onClick={() => createVolunteer(form)}
              className="bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold flex items-center gap-2">
              {submittingCreate ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" /> Create Account</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── One-time credentials reveal ─────────────────────────── */}
      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-safe" /> Account created</DialogTitle>
            <DialogDescription>
              Share these credentials with {credentials?.volunteer.full_name} securely — this password is shown only once
              and cannot be retrieved again.
            </DialogDescription>
          </DialogHeader>

          {credentials && (
            <div className="bg-surface-container rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Phone</p>
                  <p className="text-sm font-bold text-on-surface tabular-nums">{credentials.volunteer.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Temporary password</p>
                  <p className="text-sm font-bold text-on-surface font-mono tracking-wide">{credentials.temporaryPassword}</p>
                </div>
              </div>
              <Button variant="outline" onClick={copyCredentials} className="w-full h-9 rounded-lg flex items-center justify-center gap-2 text-sm">
                {copied ? <><Check className="w-4 h-4 text-safe" /> Copied</> : <><Copy className="w-4 h-4" /> Copy credentials</>}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setCredentials(null)} className="bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold w-full">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
