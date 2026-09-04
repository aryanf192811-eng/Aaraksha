// src/pages/LocalOperatorsPage.tsx
// Govt-verified local tourism providers (hotels/homestays/guides/experiences/
// artisans) — structural mirror of VolunteersPage.tsx, but simpler: rows are
// seeded by a data-curation script, not typed in by govt users, so there's
// no "Add Provider" dialog, credentials reveal, or team-linking flow here.
// Internal naming stays LocalOperator/localOperators throughout — only the
// user-facing copy says "provider(s)".
import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Store, ShieldCheck, MapPin, Loader2, CheckCircle2, Clock, Phone, Tag,
  AlertTriangle, UserX, Building2, Home, Compass, Mountain, Palette, LandPlot,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import govtApi from '../api/govt.api'
import { getErrorMessage } from '../api/client'
import { queryClient } from '../lib/queryClient'
import { formatTimeAgo, cn } from '../lib/utils'
import type { LocalOperator } from '../types/api.types'

const CATEGORY_META: Record<LocalOperator['category'], { label: string; icon: typeof Building2; bg: string; text: string }> = {
  HOTEL:      { label: 'Hotel',      icon: Building2, bg: 'bg-blue-100',   text: 'text-blue-700' },
  HOMESTAY:   { label: 'Homestay',   icon: Home,       bg: 'bg-emerald-100', text: 'text-emerald-700' },
  GUIDE:      { label: 'Guide',      icon: Compass,    bg: 'bg-indigo-100', text: 'text-indigo-700' },
  EXPERIENCE: { label: 'Experience', icon: Mountain,   bg: 'bg-orange-100', text: 'text-orange-700' },
  ARTISAN:    { label: 'Artisan',    icon: Palette,    bg: 'bg-pink-100',   text: 'text-pink-700' },
}

const CATEGORY_ORDER: LocalOperator['category'][] = ['HOTEL', 'HOMESTAY', 'GUIDE', 'EXPERIENCE', 'ARTISAN']

// Same derivation as the tourist app's StopDetailSheet: a real OSM
// node/way cited in `source` gets a precise, direct link; everything else
// falls back to a real Google Maps search (business + district + state) —
// an honest search, not a fabricated pin, since no coordinate exists
// anywhere in this data model for govt-registry/cooperative citations.
function getOperatorMapsUrl(op: LocalOperator): string {
  const osmMatch = op.source?.match(/(?:OpenStreetMap|OSM)\s+(node|way)\s+(\d+)/i)
  if (osmMatch) return `https://www.openstreetmap.org/${osmMatch[1].toLowerCase()}/${osmMatch[2]}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${op.business_name}, ${op.district}, ${op.state}`)}`
}

export default function LocalOperatorsPage() {
  const [tab, setTab] = useState<'pending' | 'roster'>('pending')
  const [reviewing, setReviewing] = useState<LocalOperator | null>(null)

  const { data: pending, isLoading: loadingPending } = useQuery({
    queryKey: ['govt', 'localOperators', 'pending'],
    queryFn: () => govtApi.getPendingLocalOperators().then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const { data: roster, isLoading: loadingRoster } = useQuery({
    queryKey: ['govt', 'localOperators', 'all'],
    queryFn: () => govtApi.getAllLocalOperators().then(r => r.data.data),
    refetchInterval: 30_000,
    enabled: tab === 'roster',
  })

  const { mutate: verify, isPending: verifying } = useMutation({
    mutationFn: (id: string) => govtApi.verifyLocalOperator(id),
    onSuccess: (res) => {
      toast.success(`${res.data.data.business_name} verified — now listed as a govt-verified provider`)
      queryClient.invalidateQueries({ queryKey: ['govt', 'localOperators'] })
      setReviewing(null)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: (id: string) => govtApi.rejectLocalOperator(id),
    onSuccess: (res) => {
      toast.success(`${res.data.data.business_name} was rejected`)
      queryClient.invalidateQueries({ queryKey: ['govt', 'localOperators'] })
      setReviewing(null)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const pendingList = pending || []
  const rosterList = roster || []

  // "Tourism Ecosystem Coverage" is specifically a govt-verified reach metric —
  // rosterList includes unverified rows too (findAll() has no is_verified
  // filter, same as VolunteersPage's roster), so this must filter to verified
  // before counting. Counting unverified rows here would silently overstate
  // the one number this page exists to prove.
  const coverage = useMemo(() => {
    return rosterList.filter((op) => op.is_verified).reduce(
      (acc, op) => {
        acc.total += 1
        acc.byCategory[op.category] = (acc.byCategory[op.category] ?? 0) + 1
        if (op.destination_id) acc.destinations.add(op.destination_id)
        if (op.district) acc.districts.add(op.district)
        return acc
      },
      { total: 0, byCategory: {} as Partial<Record<LocalOperator['category'], number>>, destinations: new Set<string>(), districts: new Set<string>() }
    )
  }, [rosterList])

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-on-surface">Local Tourism Providers</h1>
          <p className="text-on-surface-variant text-sm">Govt-verified hotels, homestays, guides, experiences & artisans</p>
        </div>
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
          All Providers
        </button>
      </div>

      {/* ── Pending Review ────────────────────────────────────── */}
      {tab === 'pending' && (
        <>
          {loadingPending && (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          )}
          {!loadingPending && pendingList.length === 0 && (
            <div className="text-center py-16 px-6 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest">
              <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-lg font-bold text-on-surface">No pending providers</p>
              <p className="text-on-surface-variant text-sm mt-0.5">Every submitted provider has been reviewed</p>
            </div>
          )}
          <div className="space-y-3">
            {pendingList.map((op: LocalOperator) => {
              const meta = CATEGORY_META[op.category]
              const Icon = meta.icon
              return (
                <div key={op.id} className="rounded-xl p-5 shadow-sm bg-surface-container-lowest border-l-4 border-l-amber-500">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', meta.bg, meta.text)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-on-surface">{op.business_name}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant mt-1">
                          <span className={cn('font-semibold', meta.text)}>{meta.label}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{op.district}, {op.state}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Submitted {formatTimeAgo(op.created_at)}</span>
                        </div>
                        {op.source && (
                          <p className="text-xs text-on-surface-variant mt-1">Source: {op.source}</p>
                        )}
                      </div>
                    </div>
                    <Button onClick={() => setReviewing(op)}
                      className="flex-shrink-0 h-11 px-4 bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Review
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── All Providers (roster) ────────────────────────────── */}
      {tab === 'roster' && (
        <>
          {loadingRoster && (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          )}
          {!loadingRoster && rosterList.length === 0 && (
            <div className="text-center py-16 px-6 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                <Store className="w-7 h-7" />
              </div>
              <p className="text-lg font-bold text-on-surface">No verified providers yet</p>
              <p className="text-on-surface-variant text-sm mt-0.5">Verified local tourism providers will appear here</p>
            </div>
          )}

          {!loadingRoster && rosterList.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 mb-4 flex flex-wrap items-start gap-x-8 gap-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <LandPlot className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Tourism Ecosystem Coverage</p>
                  <p className="text-sm font-bold text-on-surface">
                    {coverage.total} verified provider{coverage.total === 1 ? '' : 's'} across {coverage.districts.size} district{coverage.districts.size === 1 ? '' : 's'}
                    {coverage.destinations.size > 0 && <> · {coverage.destinations.size} destination{coverage.destinations.size === 1 ? '' : 's'}</>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 self-center">
                {CATEGORY_ORDER.filter(c => (coverage.byCategory[c] ?? 0) > 0).map((c) => (
                  <span key={c} className={cn('text-xs font-semibold px-2 py-1 rounded-full', CATEGORY_META[c].bg, CATEGORY_META[c].text)}>
                    {coverage.byCategory[c]} {CATEGORY_META[c].label.toLowerCase()}{(coverage.byCategory[c] ?? 0) === 1 ? '' : 's'}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rosterList.map((op: LocalOperator) => {
              const meta = CATEGORY_META[op.category]
              const Icon = meta.icon
              return (
                <div key={op.id} className="rounded-xl p-4 shadow-sm bg-surface-container-lowest border border-outline-variant/60">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', meta.bg, meta.text)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Name carries the hierarchy; the govt-verified pill rides
                          beside it while still reading as its own trust signal. */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-on-surface truncate">{op.business_name}</p>
                        {op.is_verified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Unverified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant truncate mt-0.5">{op.district}, {op.state}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full', meta.bg, meta.text)}>{meta.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-on-surface-variant">
                    {op.contact_phone ? (
                      <a href={`tel:${op.contact_phone}`} className="flex items-center gap-1 hover:text-primary-dark transition-colors">
                        <Phone className="w-3 h-3" />{op.contact_phone}
                      </a>
                    ) : <span />}
                    {op.price_range_text && (
                      <span className="flex items-center gap-1 font-semibold text-primary"><Tag className="w-3 h-3" />{op.price_range_text}</span>
                    )}
                  </div>
                  <a href={getOperatorMapsUrl(op)} target="_blank" rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-[11px] font-bold text-on-surface-variant hover:text-primary-dark transition-colors w-fit">
                    <MapPin className="w-3 h-3" /> View on map
                  </a>
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
            <DialogTitle>Review provider — {reviewing?.business_name}</DialogTitle>
            <DialogDescription>Verify to list this provider publicly, or reject if it doesn't check out.</DialogDescription>
          </DialogHeader>

          {reviewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-surface-container rounded-xl p-4">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Business name</p>
                  <p className="text-sm font-bold text-on-surface">{reviewing.business_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Category</p>
                  <p className="text-sm font-bold text-on-surface">{CATEGORY_META[reviewing.category].label}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Contact phone</p>
                  <p className="text-sm font-bold text-on-surface">{reviewing.contact_phone}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">District</p>
                  <p className="text-sm font-bold text-on-surface">{reviewing.district}, {reviewing.state}</p>
                </div>
                {reviewing.price_range_text && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Price range</p>
                    <p className="text-sm font-bold text-on-surface">{reviewing.price_range_text}</p>
                  </div>
                )}
                {reviewing.source && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Source</p>
                    <p className="text-sm font-bold text-on-surface">{reviewing.source}</p>
                  </div>
                )}
                {reviewing.description && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Description</p>
                    <p className="text-sm text-on-surface">{reviewing.description}</p>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Verifying makes <strong>{reviewing.business_name}</strong> visible as a govt-verified provider
                  across the platform. Only confirm if the details above match your records.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)} className="h-11 px-4 rounded-full">Cancel</Button>
            <Button variant="outline" disabled={rejecting || verifying} onClick={() => reviewing && reject(reviewing.id)}
              className="h-11 px-4 rounded-full font-bold flex items-center gap-2 border-sos/40 text-sos hover:bg-sos/10 hover:text-sos">
              {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserX className="w-4 h-4" /> Reject</>}
            </Button>
            <Button disabled={verifying || rejecting} onClick={() => reviewing && verify(reviewing.id)}
              className="h-11 px-4 bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold flex items-center gap-2">
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> Confirm & Verify</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
