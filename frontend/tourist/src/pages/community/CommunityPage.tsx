// src/pages/community/CommunityPage.tsx
// Community scam reports + destination filter
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import type { ComponentType } from 'react'
import {
  ArrowLeft, Plus, X, Loader2, AlertCircle, Globe, CheckCircle2, Check, Send,
  Compass, IndianRupee, Wallet, UserX, AlertTriangle, HelpCircle,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import destinationApi from '../../api/destination.api'
import scamApi from '../../api/scam.api'
import { queryClient } from '../../lib/queryClient'
import { formatTimeAgo } from '../../lib/utils'

const ScamSchema = z.object({
  destinationId: z.string().uuid('Select a destination'),
  category: z.enum(['FAKE_GUIDE', 'OVERCHARGING', 'THEFT', 'HARASSMENT', 'UNSAFE_AREA', 'OTHER']),
  description: z.string().min(10, 'Describe the incident in at least 10 characters').max(2000),
  incidentDate: z.string().optional(),
})
type ScamForm = z.infer<typeof ScamSchema>
type ScamCategory = ScamForm['category']

const SCAM_ICONS: Record<ScamCategory, ComponentType<{ className?: string }>> = {
  FAKE_GUIDE: Compass, OVERCHARGING: IndianRupee, THEFT: Wallet,
  HARASSMENT: UserX, UNSAFE_AREA: AlertTriangle, OTHER: HelpCircle,
}
const SCAM_LABELS: Record<ScamCategory, string> = {
  FAKE_GUIDE: 'Fake Guide', OVERCHARGING: 'Overcharging', THEFT: 'Theft',
  HARASSMENT: 'Harassment', UNSAFE_AREA: 'Unsafe Area', OTHER: 'Other',
}

export default function CommunityPage() {
  const navigate = useNavigate()
  const [selectedDest, setSelectedDest] = useState('')
  const [showReportForm, setShowReportForm] = useState(false)

  const { data: destinations } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => destinationApi.getAll().then(r => r.data.data),
    staleTime: 10 * 60_000,
  })

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['scam-reports', selectedDest],
    queryFn: () => scamApi.getByDestination(selectedDest).then(r => r.data.data),
    enabled: !!selectedDest,
  })

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ScamForm>({
    resolver: zodResolver(ScamSchema),
    defaultValues: { destinationId: selectedDest },
  })

  const { mutate: submitReport, isPending } = useMutation({
    mutationFn: (data: ScamForm) => scamApi.createReport(data),
    onSuccess: () => {
      toast.success('Report submitted. Thank you for keeping travellers safe!')
      queryClient.invalidateQueries({ queryKey: ['scam-reports', selectedDest] })
      reset()
      setShowReportForm(false)
    },
  })

  const reports = reportsData?.reports || []
  const aggregate = reportsData?.aggregate || { total: 0, byCategory: {} }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6 text-on-surface" /></button>
            <div>
              <h1 className="text-xl font-black text-on-surface">Community Reports</h1>
              <p className="text-xs text-on-surface-variant">Scam alerts · Safety warnings</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowReportForm(true)}
            className="bg-primary hover:brightness-95 text-on-surface rounded-full text-xs px-3 font-bold">
            <Plus className="w-3 h-3 mr-1" /> Report
          </Button>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-4">
        <Select onValueChange={v => { setSelectedDest(v); setValue('destinationId', v) }}>
          <SelectTrigger className="h-11 rounded-xl bg-surface-container-lowest">
            <SelectValue placeholder="Select destination to view reports" />
          </SelectTrigger>
          <SelectContent>
            {(destinations || []).map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}, {d.state}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedDest && aggregate.total > 0 && (
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
            <p className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {aggregate.total} reports for this destination
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(aggregate.byCategory).map(([cat, count]) => {
                const Icon = SCAM_ICONS[cat as ScamCategory] ?? HelpCircle
                return (
                  <span key={cat} className="text-xs bg-surface-container-lowest border border-primary/20 rounded-full px-2.5 py-1 font-semibold text-primary flex items-center gap-1">
                    <Icon className="w-3 h-3" /> {SCAM_LABELS[cat as ScamCategory] || cat}: {count}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {!selectedDest && (
          <div className="text-center py-12">
            <Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-on-surface">Select a destination</p>
            <p className="text-sm text-on-surface-variant">View community safety reports from fellow travellers</p>
          </div>
        )}

        {selectedDest && isLoading && <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 bg-surface-container-lowest rounded-2xl animate-pulse" />)}</div>}

        {selectedDest && !isLoading && reports.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="font-bold text-on-surface">No reports for this destination</p>
            <p className="text-sm text-on-surface-variant">Be the first to report an incident if you see something</p>
          </div>
        )}

        {reports.map((report) => {
          const Icon = SCAM_ICONS[report.category as ScamCategory] ?? HelpCircle
          return (
            <div key={report.id} className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-on-surface-variant" />
                <span className="text-sm font-bold text-on-surface">{SCAM_LABELS[report.category as ScamCategory] || report.category}</span>
                {report.verified && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold ml-auto flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>
              <p className="text-sm text-on-surface mb-2">{report.description}</p>
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span>{formatTimeAgo(report.created_at)}</span>
                {report.incident_date && <span>· Incident: {report.incident_date}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Report Modal */}
      {showReportForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-surface-container-lowest rounded-t-3xl w-full max-h-[85vh] overflow-y-auto p-6 pb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-on-surface">Report an Incident</h2>
              <button onClick={() => setShowReportForm(false)}><X className="w-6 h-6 text-on-surface-variant" /></button>
            </div>
            <form onSubmit={handleSubmit(d => submitReport(d))} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Destination *</Label>
                <Select onValueChange={v => setValue('destinationId', v)} defaultValue={selectedDest}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {(destinations || []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}, {d.state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.destinationId && <p className="text-xs text-red-500">{errors.destinationId.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Incident Type *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(SCAM_LABELS) as [ScamCategory, string][]).map(([value, label]) => {
                    const Icon = SCAM_ICONS[value]
                    return (
                      <button key={value} type="button"
                        onClick={() => setValue('category', value)}
                        className="border-2 border-outline-variant rounded-xl p-2.5 text-center hover:border-amber-400 hover:bg-primary/10 transition-colors">
                        <Icon className="w-5 h-5 mx-auto mb-1 text-on-surface-variant" />
                        <span className="text-xs font-semibold text-on-surface">{label}</span>
                      </button>
                    )
                  })}
                </div>
                {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Description *</Label>
                <textarea rows={3} placeholder="Describe what happened... (min 10 characters)" {...register('description')}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary" />
                {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Incident Date (optional)</Label>
                <Input type="date" className="h-11 rounded-xl" {...register('incidentDate')} />
              </div>

              <Button type="submit" disabled={isPending} className="w-full h-12 bg-on-surface text-surface rounded-full font-bold flex items-center justify-center gap-2">
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Submit Report</>}
              </Button>

              <p className="text-xs text-on-surface-variant text-center">
                Reports are anonymous and help future travellers stay safe.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
