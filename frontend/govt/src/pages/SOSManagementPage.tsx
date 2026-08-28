// src/pages/SOSManagementPage.tsx — real-time SOS feed with assignment modal
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { AlertTriangle, Loader2, X, Phone, Droplet, Clock, MapPin, UserCheck, Battery, CheckCircle2, Send, ShieldCheck, HeartHandshake, Navigation, Radio, Gauge, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import govtApi, { type NearbyRescuer } from '../api/govt.api'
import { queryClient } from '../lib/queryClient'
import { formatTimeAgo, cn } from '../lib/utils'
import type { SOSWithDetails } from '../types/api.types'
import { useSOSSocket } from '../hooks/useSOSSocket'

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:      'border-l-4 border-l-red-500 bg-surface-container-lowest',
  ASSIGNED:    'border-l-4 border-l-amber-500 bg-surface-container-lowest',
  RESOLVED:    'border-l-4 border-l-green-500 bg-surface-container opacity-70',
  FALSE_ALARM: 'border-l-4 border-l-slate-300 bg-surface-container opacity-70',
}

// Same score bands as the tourist app's TSI — govt sees the identical risk
// context the tourist saw before departing, not a separately-invented scale.
const TSI_STYLE: Record<string, string> = {
  'Low Risk':      'bg-green-100 text-green-700',
  'Moderate Risk': 'bg-amber-100 text-amber-700',
  'High Risk':     'bg-orange-100 text-orange-700',
  'Extreme Risk':  'bg-red-100 text-red-700',
}

export default function SOSManagementPage() {
  const [selectedSOS, setSelectedSOS] = useState<SOSWithDetails | null>(null)
  // Two independent selections, exactly one of which may be active at a
  // time (mirrors the backend's assignRescue contract — teamId XOR
  // volunteerId) — picking in one dropdown clears the other rather than
  // letting the operator stage an ambiguous double-selection.
  const [assignTeamId, setAssignTeamId] = useState('')
  const [assignVolunteerId, setAssignVolunteerId] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  useSOSSocket() // subscribes to real-time events; invalidates the queries below

  // Keyboard-accessible modal: Escape closes it, and focus moves into the
  // panel on open instead of staying on the card that triggered it — this
  // is a hand-rolled overlay (not the Radix Dialog used elsewhere), so
  // neither behavior comes for free.
  useEffect(() => {
    if (!selectedSOS) return
    modalRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSOS(null)
        setAssignTeamId('')
        setAssignVolunteerId('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedSOS])

  const { data: sosData, isLoading } = useQuery({
    queryKey: ['govt', 'sos'],
    queryFn: () => govtApi.getActiveSOS({ page: 1, limit: 50 }).then(r => r.data),
    refetchInterval: 15_000,
  })

  // Distance-sorted list mixing official teams and govt-verified volunteers
  // — only fetched while the assign panel for an ACTIVE SOS is open, since
  // it depends on that specific SOS's coordinates.
  const { data: nearbyRescuers, isLoading: loadingRescuers } = useQuery({
    queryKey: ['govt', 'nearby-rescuers', selectedSOS?.id],
    queryFn: () => govtApi.getNearbyRescuers(selectedSOS!.id).then(r => r.data.data),
    enabled: !!selectedSOS && selectedSOS.status === 'ACTIVE',
  })

  const { mutate: assignRescue, isPending: assigning } = useMutation({
    mutationFn: ({ sosId, rescuer }: { sosId: string; rescuer: NearbyRescuer }) =>
      govtApi.assignRescue(sosId, rescuer.kind === 'TEAM' ? { teamId: rescuer.id } : { volunteerId: rescuer.id }),
    onSuccess: (_res, { rescuer }) => {
      toast.success(`${rescuer.kind === 'TEAM' ? 'Rescue team' : 'Volunteer'} assigned`)
      queryClient.invalidateQueries({ queryKey: ['govt', 'sos'] })
      setSelectedSOS(null)
      setAssignTeamId('')
      setAssignVolunteerId('')
    },
  })

  const { mutate: resolveSOS, isPending: resolving } = useMutation({
    // resolutionNotes is optional server-side (min 3 chars *if present*) —
    // an empty string isn't "absent", so it must be dropped entirely rather
    // than sent as '', which would fail the min-length check.
    mutationFn: (sosId: string) => govtApi.resolveSOS(sosId, resolutionNotes.trim() ? { resolutionNotes: resolutionNotes.trim() } : {}),
    onSuccess: () => {
      toast.success('SOS resolved')
      queryClient.invalidateQueries({ queryKey: ['govt', 'sos'] })
      queryClient.invalidateQueries({ queryKey: ['govt', 'dashboard'] })
      setSelectedSOS(null)
      setResolutionNotes('')
    },
  })

  const sosList = sosData?.data || []

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-on-surface">SOS Management</h1>
          <p className="text-on-surface-variant text-sm">Active incidents · Real-time feed</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sos animate-pulse" />
          <span className="text-sm font-semibold text-red-600">
            {sosList.filter((s: SOSWithDetails) => s.status === 'ACTIVE').length} Active
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      <div className="space-y-3">
        {sosList.map((sos: SOSWithDetails) => (
          <div key={sos.id}
            className={cn('rounded-xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-all', STATUS_STYLE[sos.status] || STATUS_STYLE.RESOLVED)}
            onClick={() => { setSelectedSOS(sos); setAssignTeamId(''); setAssignVolunteerId('') }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <AlertTriangle className={cn('w-4 h-4 flex-shrink-0',
                    sos.status === 'ACTIVE' ? 'text-red-500' : sos.status === 'ASSIGNED' ? 'text-amber-500' : 'text-green-500'
                  )} />
                  <span className="font-bold text-on-surface">{sos.full_name}</span>
                  <span className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                    {sos.category}
                  </span>
                  {sos.tsi_label && (
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0', TSI_STYLE[sos.tsi_label] || TSI_STYLE['Moderate Risk'])}>
                      Trip: {sos.tsi_label}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{sos.phone}</span>
                  {sos.blood_group && <span className="flex items-center gap-1"><Droplet className="w-3 h-3 text-red-400" />{sos.blood_group}</span>}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimeAgo(sos.created_at)}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />
                    <a href={`https://maps.google.com/?q=${sos.latitude},${sos.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      onClick={e => e.stopPropagation()}>
                      View on map
                    </a>
                  </span>
                  {sos.last_battery !== null && (
                    <span className="flex items-center gap-1"><Battery className="w-3 h-3" />{sos.last_battery}%</span>
                  )}
                </div>
                {sos.rescue_team_name && (
                  <p className="text-xs text-amber-700 mt-1 font-medium flex items-center gap-1.5">
                    <UserCheck className="w-3 h-3 flex-shrink-0" />
                    {sos.rescue_team_name} ({sos.assignment_status})
                    {sos.rescuer_eta_minutes != null && (
                      <span className="flex items-center gap-1 text-amber-600">
                        · <Navigation className="w-3 h-3" />{sos.rescuer_distance_km} km · ETA {sos.rescuer_eta_minutes} min
                        {sos.rescuer_is_live && <Radio className="w-3 h-3 text-green-600 animate-pulse" />}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <span className={cn('text-xs font-bold px-3 py-1 rounded-full flex-shrink-0',
                sos.status === 'ACTIVE'   ? 'bg-red-100 text-red-700' :
                sos.status === 'ASSIGNED' ? 'bg-amber-100 text-amber-700' :
                                             'bg-green-100 text-green-700'
              )}>{sos.status}</span>
            </div>
          </div>
        ))}

        {!isLoading && sosList.length === 0 && (
          <div className="text-center py-20">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-lg font-bold text-on-surface">No active incidents</p>
            <p className="text-on-surface-variant text-sm">All tourists are safe</p>
          </div>
        )}
      </div>

      {/* ── SOS Detail Modal ──────────────────────────────────── */}
      {selectedSOS && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sos-detail-title"
            className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto outline-none">
            <div className="p-6 border-b border-outline-variant flex items-center justify-between">
              <h2 id="sos-detail-title" className="text-xl font-black text-on-surface">SOS Details</h2>
              <button onClick={() => { setSelectedSOS(null); setAssignTeamId(''); setAssignVolunteerId('') }} aria-label="Close">
                <X className="w-6 h-6 text-on-surface-variant" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-bold text-on-surface-variant uppercase">Tourist</p><p className="font-bold">{selectedSOS.full_name}</p></div>
                <div><p className="text-xs font-bold text-on-surface-variant uppercase">Phone</p><p className="font-bold">{selectedSOS.phone}</p></div>
                <div><p className="text-xs font-bold text-on-surface-variant uppercase">Category</p><p className="font-bold text-red-600">{selectedSOS.category}</p></div>
                <div><p className="text-xs font-bold text-on-surface-variant uppercase">Blood Group</p><p className="font-bold">{selectedSOS.blood_group || 'Unknown'}</p></div>
                <div><p className="text-xs font-bold text-on-surface-variant uppercase">Trigger Type</p><p className="font-bold">{selectedSOS.trigger_type}</p></div>
                <div><p className="text-xs font-bold text-on-surface-variant uppercase">Battery</p><p className="font-bold">{selectedSOS.last_battery !== null ? `${selectedSOS.last_battery}%` : '—'}</p></div>
              </div>

              {selectedSOS.tsi_label && (
                <div className={cn('rounded-xl p-3', TSI_STYLE[selectedSOS.tsi_label] || TSI_STYLE['Moderate Risk'])}>
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                    <Gauge className="w-3.5 h-3.5" /> Trip Safety Index
                  </span>
                  <span className="font-black text-lg">{selectedSOS.tsi_score} — {selectedSOS.tsi_label}</span>
                </div>
              )}

              {/* Rescuer status — the modal previously went silent once a rescuer
                  was assigned; this is the live distance/ETA the govt operator
                  needs to know whether to escalate further. */}
              {selectedSOS.assignment_id && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wide">
                    <UserCheck className="w-3.5 h-3.5" /> {selectedSOS.rescue_team_name}
                    <span className="font-normal normal-case text-amber-600">({selectedSOS.rescue_team_type})</span>
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-800">{selectedSOS.assignment_status}</span>
                    {selectedSOS.rescuer_eta_minutes != null && (
                      <span className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
                        <Navigation className="w-4 h-4" /> {selectedSOS.rescuer_distance_km} km · ETA {selectedSOS.rescuer_eta_minutes} min
                      </span>
                    )}
                  </div>
                  {selectedSOS.team_phone && (
                    <a href={`tel:${selectedSOS.team_phone}`} className="flex items-center gap-1.5 text-xs text-amber-700 hover:underline">
                      <Phone className="w-3 h-3" /> {selectedSOS.team_phone}
                    </a>
                  )}
                  <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
                    {selectedSOS.rescuer_is_live
                      ? <><Radio className="w-3 h-3 text-green-600 animate-pulse" /> Live position — updated {formatTimeAgo(selectedSOS.rescuer_location_updated_at ?? selectedSOS.assigned_at!)}</>
                      : <>Base location — no live GPS reported yet</>}
                  </p>
                </div>
              )}

              {selectedSOS.message && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-700 uppercase mb-1">Message</p>
                  <p className="text-sm text-on-surface">{selectedSOS.message}</p>
                </div>
              )}

              <a href={`https://maps.google.com/?q=${selectedSOS.latitude},${selectedSOS.longitude}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary font-semibold hover:underline">
                <MapPin className="w-4 h-4" /> View Location on Google Maps
              </a>

              {selectedSOS.emergency_contacts?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase mb-2">Emergency Contacts</p>
                  {selectedSOS.emergency_contacts.map((c, i) => (
                    <p key={i} className="text-sm text-on-surface">{c.name} ({c.relation}) — {c.phone}</p>
                  ))}
                </div>
              )}

              {selectedSOS.status === 'ACTIVE' && (() => {
                const teamOptions = (nearbyRescuers ?? []).filter(r => r.kind === 'TEAM')
                const volunteerOptions = (nearbyRescuers ?? []).filter(r => r.kind === 'VOLUNTEER')
                const selectedRescuer = teamOptions.find(r => r.id === assignTeamId) ?? volunteerOptions.find(r => r.id === assignVolunteerId) ?? null
                // Both lists come back from the backend already ranked by
                // weighted score (distance + category-type match +
                // reputation — see rescueScoring.js), so [0] of the
                // combined pool is the top overall recommendation.
                const topPick = (nearbyRescuers ?? [])[0]

                return (
                  <div className="space-y-4 pt-4 border-t border-outline-variant">
                    <p className="font-bold text-on-surface">Assign Rescuer</p>

                    {loadingRescuers && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    )}

                    {!loadingRescuers && topPick && (
                      <button type="button"
                        onClick={() => topPick.kind === 'TEAM'
                          ? (setAssignTeamId(topPick.id), setAssignVolunteerId(''))
                          : (setAssignVolunteerId(topPick.id), setAssignTeamId(''))}
                        className="w-full text-left bg-violet-50 border-2 border-violet-200 hover:border-violet-400 rounded-xl p-3 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700 uppercase tracking-wide">
                            <Gauge className="w-3.5 h-3.5" /> Recommended
                            {topPick.isSpecialistMatch && <span className="text-violet-500">· Specialist match</span>}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white">{topPick.score}% match</span>
                        </div>
                        <p className="text-sm font-bold text-on-surface">
                          {topPick.name} <span className="font-normal text-on-surface-variant">({topPick.kind === 'TEAM' ? topPick.type : 'Volunteer'})</span>
                        </p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          {topPick.distanceKm.toFixed(1)} km away · distance {topPick.scoreBreakdown.distance}% · category fit {topPick.scoreBreakdown.categoryMatch}% · reputation {topPick.scoreBreakdown.reputation}%
                        </p>
                      </button>
                    )}

                    {!loadingRescuers && (
                      <>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Official Rescue Team
                          </label>
                          <Select
                            value={assignTeamId}
                            onValueChange={(v) => { setAssignTeamId(v); setAssignVolunteerId('') }}
                            disabled={teamOptions.length === 0}
                          >
                            <SelectTrigger aria-label="Official Rescue Team" className="h-11 rounded-xl w-full">
                              <SelectValue placeholder={teamOptions.length === 0 ? 'No teams available nearby' : `${teamOptions.length} team${teamOptions.length === 1 ? '' : 's'} available`} />
                            </SelectTrigger>
                            <SelectContent>
                              {teamOptions.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.score}% · {t.name} · {t.type} · {t.distanceKm.toFixed(1)} km away
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">
                            <HeartHandshake className="w-3.5 h-3.5 text-teal-600" /> Verified Volunteer
                          </label>
                          <Select
                            value={assignVolunteerId}
                            onValueChange={(v) => { setAssignVolunteerId(v); setAssignTeamId('') }}
                            disabled={volunteerOptions.length === 0}
                          >
                            <SelectTrigger aria-label="Verified Volunteer" className="h-11 rounded-xl w-full">
                              <SelectValue placeholder={volunteerOptions.length === 0 ? 'No verified volunteers available nearby' : `${volunteerOptions.length} volunteer${volunteerOptions.length === 1 ? '' : 's'} available`} />
                            </SelectTrigger>
                            <SelectContent>
                              {volunteerOptions.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.score}% · {v.name} · {v.district} · {v.distanceKm.toFixed(1)} km away
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {volunteerOptions.length === 0 && (
                            <p className="text-xs text-on-surface-variant mt-1.5">
                              No verified volunteers nearby — review pending sign-ups on the{' '}
                              <a href="/volunteers" className="text-primary font-semibold hover:underline">Volunteers</a> page.
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    <Button disabled={!selectedRescuer || assigning}
                      onClick={() => selectedRescuer && assignRescue({ sosId: selectedSOS.id, rescuer: selectedRescuer })}
                      className="w-full h-11 bg-primary-dark hover:bg-primary-dark text-white rounded-full font-bold flex items-center justify-center gap-2">
                      {assigning ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Assign Rescuer</>}
                    </Button>
                  </div>
                )
              })()}

              {selectedSOS.status !== 'RESOLVED' && selectedSOS.status !== 'FALSE_ALARM' && (
                <div className="space-y-2 pt-3 border-t border-outline-variant">
                  <Textarea placeholder="Resolution notes..." aria-label="Resolution notes" value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)} rows={2}
                    className="rounded-xl resize-none" />
                  <Button variant="outline" disabled={resolving} onClick={() => resolveSOS(selectedSOS.id)}
                    className="w-full h-11 rounded-full border-2 border-green-500 text-green-700 font-bold hover:bg-green-50 flex items-center justify-center gap-2">
                    {resolving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Mark as Resolved</>}
                  </Button>
                </div>
              )}

              {(selectedSOS.status === 'RESOLVED' || selectedSOS.status === 'FALSE_ALARM') && (
                <a href={govtApi.getIncidentReportUrl(selectedSOS.id)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-full border-2 border-outline-variant text-on-surface font-bold hover:bg-surface-container transition-colors">
                  <FileText className="w-4 h-4" /> Download Incident Report
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
