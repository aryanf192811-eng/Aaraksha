// src/pages/IncidentQueuePage.tsx — E-FIR officer triage queue
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { FileWarning, Loader2, X, Phone, Clock, MapPin, UserCheck, CheckCircle2, FileText, UserPlus, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import govtApi, { type IncidentEntry, type IncidentStatus } from '../api/govt.api'
import { queryClient } from '../lib/queryClient'
import { formatTimeAgo, formatDateTime, cn } from '../lib/utils'
import { useAuthStore } from '../store/auth.store'
import { useSOSSocket } from '../hooks/useSOSSocket'

const CATEGORY_LABEL: Record<string, string> = {
  THEFT: 'Theft', HARASSMENT: 'Harassment', ASSAULT: 'Assault', FRAUD: 'Fraud',
  LOST_DOCUMENT: 'Lost Document', VEHICLE_ACCIDENT: 'Vehicle Accident',
  PROPERTY_DAMAGE: 'Property Damage', OTHER: 'Other',
}

const STATUS_STYLE: Record<string, string> = {
  FILED:                'border-l-4 border-l-red-500 bg-surface-container-lowest',
  ASSIGNED:              'border-l-4 border-l-amber-500 bg-surface-container-lowest',
  UNDER_INVESTIGATION:   'border-l-4 border-l-blue-500 bg-surface-container-lowest',
  RESOLVED:              'border-l-4 border-l-green-500 bg-surface-container opacity-70',
  CLOSED:                'border-l-4 border-l-slate-300 bg-surface-container opacity-70',
}
const STATUS_BADGE: Record<string, string> = {
  FILED:                'bg-red-100 text-red-700',
  ASSIGNED:              'bg-amber-100 text-amber-700',
  UNDER_INVESTIGATION:   'bg-blue-100 text-blue-700',
  RESOLVED:              'bg-green-100 text-green-700',
  CLOSED:                'bg-slate-100 text-slate-600',
}
const PRIORITY_BADGE: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-slate-100 text-slate-600',
}
const STATUS_TABS: Array<{ value: IncidentStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'FILED', label: 'Filed' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'UNDER_INVESTIGATION', label: 'Investigating' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]
// Forward-only next step per current status — keeps the officer from
// jumping the ladder backwards by accident (e.g. RESOLVED -> FILED).
const NEXT_STATUSES: Record<string, IncidentStatus[]> = {
  FILED:                ['ASSIGNED', 'UNDER_INVESTIGATION'],
  ASSIGNED:              ['UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED'],
  UNDER_INVESTIGATION:   ['RESOLVED', 'CLOSED'],
  RESOLVED:              ['CLOSED'],
  CLOSED:                [],
}

export default function IncidentQueuePage() {
  const govtUser = useAuthStore(s => s.govtUser)
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'ALL'>('ALL')
  const [assignedToMe, setAssignedToMe] = useState(false)
  const [selected, setSelected] = useState<IncidentEntry | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [assignOfficerId, setAssignOfficerId] = useState('')
  useSOSSocket() // also subscribes to INCIDENT_FILED / INCIDENT_STATUS_UPDATED; invalidates the queries below

  const { data: queueData, isLoading } = useQuery({
    queryKey: ['govt', 'incidents', statusFilter, assignedToMe],
    queryFn: () => govtApi.getIncidentQueue({
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      assignedToMe: assignedToMe || undefined,
      page: 1, limit: 50,
    }).then(r => r.data),
    refetchInterval: 20_000,
  })

  const { data: officers } = useQuery({
    queryKey: ['govt', 'incidents', 'officers'],
    queryFn: () => govtApi.getAssignableOfficers().then(r => r.data.data),
    staleTime: 5 * 60_000,
  })

  const { mutate: assign, isPending: assigning } = useMutation({
    mutationFn: ({ id, officerId }: { id: string; officerId?: string }) => govtApi.assignIncident(id, officerId),
    onSuccess: (res) => {
      toast.success('Case assigned')
      queryClient.invalidateQueries({ queryKey: ['govt', 'incidents'] })
      setSelected(res.data.data)
      setAssignOfficerId('')
    },
    onError: () => toast.error('Failed to assign case'),
  })

  const { mutate: updateStatus, isPending: updating } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: IncidentStatus }) =>
      govtApi.updateIncidentStatus(id, { status, resolutionNotes: resolutionNotes.trim() || undefined }),
    onSuccess: (res) => {
      toast.success('Case status updated')
      queryClient.invalidateQueries({ queryKey: ['govt', 'incidents'] })
      setSelected(res.data.data)
      setResolutionNotes('')
    },
    onError: () => toast.error('Failed to update case'),
  })

  const incidents = queueData?.data || []
  const filedCount = incidents.filter(i => i.status === 'FILED').length

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-on-surface">E-FIR Queue</h1>
          <p className="text-on-surface-variant text-sm">Officer triage · Investigation tracking</p>
        </div>
        {filedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-semibold text-red-600">{filedCount} unassigned</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex gap-1 bg-surface-container rounded-full p-1 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                statusFilter === tab.value ? 'bg-on-surface text-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface')}>
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={() => setAssignedToMe(v => !v)}
          className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-colors',
            assignedToMe ? 'bg-primary/10 border-primary/30 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container')}>
          <UserCheck className="w-3.5 h-3.5" /> Assigned to me
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      <div className="space-y-3">
        {incidents.map((inc) => (
          <div key={inc.id}
            className={cn('rounded-xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-all', STATUS_STYLE[inc.status] || STATUS_STYLE.CLOSED)}
            onClick={() => { setSelected(inc); setResolutionNotes(''); setAssignOfficerId('') }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <FileWarning className="w-4 h-4 flex-shrink-0 text-on-surface-variant" />
                  <span className="font-mono text-xs font-bold text-on-surface-variant">{inc.case_number}</span>
                  <span className="font-bold text-on-surface">{inc.full_name || 'Unlinked report'}</span>
                  <span className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                    {CATEGORY_LABEL[inc.category] || inc.category}
                  </span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0', PRIORITY_BADGE[inc.priority])}>
                    {inc.priority}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant line-clamp-1 mb-1.5">{inc.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                  {inc.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{inc.phone}</span>}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimeAgo(inc.filed_at)}</span>
                  {inc.location_text && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{inc.location_text}</span>}
                </div>
                {inc.assigned_officer_name && (
                  <p className="text-xs text-amber-700 mt-1 font-medium flex items-center gap-1.5">
                    <UserCheck className="w-3 h-3 flex-shrink-0" /> {inc.assigned_officer_name}
                  </p>
                )}
              </div>
              <span className={cn('text-xs font-bold px-3 py-1 rounded-full flex-shrink-0', STATUS_BADGE[inc.status])}>
                {inc.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        ))}

        {!isLoading && incidents.length === 0 && (
          <div className="text-center py-20">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-lg font-bold text-on-surface">No cases in this view</p>
            <p className="text-on-surface-variant text-sm">Filed reports will show up here for triage</p>
          </div>
        )}
      </div>

      {/* ── Detail Modal ──────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-outline-variant flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-on-surface">Case {selected.case_number}</h2>
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block', STATUS_BADGE[selected.status])}>
                  {selected.status.replace('_', ' ')}
                </span>
              </div>
              <button onClick={() => setSelected(null)}><X className="w-6 h-6 text-on-surface-variant" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-bold text-on-surface-variant uppercase">Complainant</p><p className="font-bold">{selected.full_name || 'Not linked'}</p></div>
                <div><p className="text-xs font-bold text-on-surface-variant uppercase">Phone</p><p className="font-bold">{selected.phone || '—'}</p></div>
                <div><p className="text-xs font-bold text-on-surface-variant uppercase">Category</p><p className="font-bold">{CATEGORY_LABEL[selected.category] || selected.category}</p></div>
                <div><p className="text-xs font-bold text-on-surface-variant uppercase">Priority</p>
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full inline-block', PRIORITY_BADGE[selected.priority])}>{selected.priority}</span>
                </div>
              </div>

              <div className="bg-surface-container rounded-xl p-3">
                <p className="text-xs font-bold text-on-surface-variant uppercase mb-1">Description</p>
                <p className="text-sm text-on-surface">{selected.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-on-surface-variant">
                <div><p className="font-bold uppercase mb-0.5">Filed</p><p>{formatDateTime(selected.filed_at)}</p></div>
                {selected.incident_occurred_at && (
                  <div><p className="font-bold uppercase mb-0.5">Occurred</p><p>{formatDateTime(selected.incident_occurred_at)}</p></div>
                )}
              </div>
              {selected.location_text && (
                <p className="flex items-center gap-2 text-sm text-on-surface">
                  <MapPin className="w-4 h-4 text-on-surface-variant flex-shrink-0" /> {selected.location_text}
                </p>
              )}

              {/* Assignment */}
              <div className="space-y-2 pt-3 border-t border-outline-variant">
                <p className="font-bold text-on-surface flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Assignment</p>
                {selected.assigned_officer_name ? (
                  <p className="text-sm text-on-surface-variant">
                    Assigned to <span className="font-semibold text-on-surface">{selected.assigned_officer_name}</span>
                    {selected.assigned_at && <> · {formatTimeAgo(selected.assigned_at)}</>}
                  </p>
                ) : (
                  <p className="text-sm text-on-surface-variant">Unassigned</p>
                )}
                <div className="flex gap-2">
                  <Select value={assignOfficerId} onValueChange={setAssignOfficerId}>
                    <SelectTrigger className="h-10 rounded-xl flex-1"><SelectValue placeholder="Reassign to officer..." /></SelectTrigger>
                    <SelectContent>
                      {(officers || []).map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name} · {o.role} · {o.district}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button disabled={assigning} onClick={() => assign({ id: selected.id, officerId: assignOfficerId || undefined })}
                    className="h-10 rounded-xl bg-primary-dark hover:bg-primary-dark text-white font-bold px-4 flex-shrink-0">
                    {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : (selected.assigned_officer_id === govtUser?.id ? 'Reassign' : 'Assign to me')}
                  </Button>
                </div>
              </div>

              {/* Status ladder */}
              {NEXT_STATUSES[selected.status]?.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-outline-variant">
                  <p className="font-bold text-on-surface flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Update Status</p>
                  <textarea placeholder="Investigation / resolution notes..." value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)} rows={2}
                    className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary" />
                  <div className="flex flex-wrap gap-2">
                    {NEXT_STATUSES[selected.status].map(next => (
                      <Button key={next} variant="outline" disabled={updating}
                        onClick={() => updateStatus({ id: selected.id, status: next })}
                        className={cn('h-10 rounded-full font-bold flex-1 min-w-[140px]',
                          next === 'RESOLVED' ? 'border-2 border-green-500 text-green-700 hover:bg-green-50' :
                          next === 'CLOSED' ? 'border-2 border-slate-400 text-slate-700 hover:bg-slate-50' :
                          'border-2 border-blue-500 text-blue-700 hover:bg-blue-50')}>
                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : `Mark ${next.replace('_', ' ')}`}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {selected.resolution_notes && (
                <div className="bg-surface-container rounded-xl p-3">
                  <p className="text-xs font-bold text-on-surface-variant uppercase mb-1">Notes on file</p>
                  <p className="text-sm text-on-surface">{selected.resolution_notes}</p>
                </div>
              )}

              <a href={govtApi.getEfirReportUrl(selected.id)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-11 rounded-full border-2 border-outline-variant text-on-surface font-bold hover:bg-surface-container transition-colors">
                <FileText className="w-4 h-4" /> Download E-FIR PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
