// src/pages/community/CommunityPage.tsx
// Community scam reports + destination filter, plus the Community
// Experience System: detailed real-visit reviews (cost, crowd, safety
// perception, tips) so a future tourist gets more than a bare star rating.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import type { ComponentType } from 'react'
import {
  ArrowLeft, Plus, X, Loader2, AlertCircle, Globe, CheckCircle2, Check, Send,
  Compass, IndianRupee, Wallet, UserX, AlertTriangle, HelpCircle,
  Star, MessageSquare, Camera, ThumbsUp, ThumbsDown, Lightbulb, Users2,
  Clock, ShieldCheck, ShieldQuestion, ShieldAlert, Sparkles, Flame, ChevronRight,
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
import reviewApi, { type CreateReviewPayload } from '../../api/review.api'
import { queryClient } from '../../lib/queryClient'
import { formatTimeAgo, formatINR, cn } from '../../lib/utils'

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

const CROWD_LABELS: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' }
const SAFE_CONFIG: Record<string, { label: string; icon: typeof ShieldCheck; color: string }> = {
  YES:      { label: 'Felt Safe',    icon: ShieldCheck,    color: 'text-green-600 bg-green-50' },
  SOMEWHAT: { label: 'Somewhat Safe', icon: ShieldQuestion, color: 'text-amber-600 bg-amber-50' },
  NO:       { label: 'Did Not Feel Safe', icon: ShieldAlert, color: 'text-red-600 bg-red-50' },
}

function StarRating({ value, onChange, readOnly, size = 'md' }: { value: number; onChange?: (v: number) => void; readOnly?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'lg' ? 'w-8 h-8' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={cn(!readOnly && 'active:scale-90 transition-transform', readOnly && 'cursor-default')}>
          <Star className={cn(px, n <= value ? 'fill-amber-400 text-amber-400' : 'fill-none text-outline-variant')} />
        </button>
      ))}
    </div>
  )
}

function MiniRating({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-on-surface-variant">{label}</span>
      <StarRating value={value} onChange={onChange} size="sm" />
    </div>
  )
}

export default function CommunityPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'reports' | 'experiences'>('reports')
  const [selectedDest, setSelectedDest] = useState('')
  const [showReportForm, setShowReportForm] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)

  const { data: destinations } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => destinationApi.getAll().then(r => r.data.data),
    staleTime: 10 * 60_000,
  })

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['scam-reports', selectedDest],
    queryFn: () => scamApi.getByDestination(selectedDest).then(r => r.data.data),
    enabled: !!selectedDest && activeTab === 'reports',
  })

  // Cross-destination ranking — the "distributed safety sensor network"
  // reframing of the same report data: which destinations have active
  // reports right now, discoverable without already knowing where to look.
  const { data: hotspots } = useQuery({
    queryKey: ['scam-reports', 'hotspots'],
    queryFn: () => scamApi.getHotspots().then(r => r.data.data),
    enabled: activeTab === 'reports' && !selectedDest,
    staleTime: 2 * 60_000,
  })

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['destinations', selectedDest, 'reviews'],
    queryFn: () => reviewApi.getForDestination(selectedDest).then(r => r.data.data),
    enabled: !!selectedDest && activeTab === 'experiences',
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
  const reviews = reviewsData?.reviews || []
  const reviewAgg = reviewsData?.aggregate

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6 text-on-surface" /></button>
            <div>
              <h1 className="text-xl font-black text-on-surface">Community</h1>
              <p className="text-xs text-on-surface-variant">Real tourists · Real experiences</p>
            </div>
          </div>
          {activeTab === 'reports' ? (
            <Button size="sm" onClick={() => setShowReportForm(true)}
              className="bg-primary hover:brightness-95 text-on-surface rounded-full text-xs px-3 font-bold">
              <Plus className="w-3 h-3 mr-1" /> Report
            </Button>
          ) : (
            <Button size="sm" onClick={() => selectedDest ? setShowReviewForm(true) : toast.info('Select a destination first')}
              className="bg-primary hover:brightness-95 text-on-surface rounded-full text-xs px-3 font-bold">
              <Plus className="w-3 h-3 mr-1" /> Write Review
            </Button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1.5 bg-surface-container rounded-full p-1">
          <button onClick={() => setActiveTab('reports')}
            className={cn('flex-1 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              activeTab === 'reports' ? 'bg-on-surface text-surface shadow-sm' : 'text-on-surface-variant')}>
            <AlertCircle className="w-3.5 h-3.5" /> Safety Reports
          </button>
          <button onClick={() => setActiveTab('experiences')}
            className={cn('flex-1 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              activeTab === 'experiences' ? 'bg-on-surface text-surface shadow-sm' : 'text-on-surface-variant')}>
            <Sparkles className="w-3.5 h-3.5" /> Experiences
          </button>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-4">
        <Select value={selectedDest} onValueChange={v => { setSelectedDest(v); setValue('destinationId', v) }}>
          <SelectTrigger className="h-11 rounded-xl bg-surface-container-lowest">
            <SelectValue placeholder={activeTab === 'reports' ? 'Select destination to view reports' : 'Select destination to view experiences'} />
          </SelectTrigger>
          <SelectContent>
            {(destinations || []).map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}, {d.state}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* ── Safety Reports Tab ─────────────────────────────── */}
        {activeTab === 'reports' && (
          <>
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

            {!selectedDest && hotspots && hotspots.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-2 px-0.5">
                  <Flame className="w-3.5 h-3.5 text-orange-500" /> Community Safety Hotspots — last 90 days
                </p>
                <div className="space-y-2">
                  {hotspots.map((h) => {
                    const Icon = SCAM_ICONS[h.top_category as ScamCategory] ?? HelpCircle
                    return (
                      <button key={h.destination_id} type="button"
                        onClick={() => { setSelectedDest(h.destination_id); setValue('destinationId', h.destination_id) }}
                        className="w-full bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex items-center gap-3 text-left hover:shadow-md transition-all">
                        <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4.5 h-4.5 text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-on-surface truncate">{h.name}, {h.state}</p>
                          <p className="text-xs text-on-surface-variant">
                            {h.recent_count} {h.recent_count === 1 ? 'report' : 'reports'} · Most common: {SCAM_LABELS[h.top_category as ScamCategory] || h.top_category}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {!selectedDest && (!hotspots || hotspots.length === 0) && (
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
          </>
        )}

        {/* ── Experiences Tab ────────────────────────────────── */}
        {activeTab === 'experiences' && (
          <>
            {!selectedDest && (
              <div className="text-center py-12">
                <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-on-surface">Select a destination</p>
                <p className="text-sm text-on-surface-variant">Read real visit experiences from fellow travellers</p>
              </div>
            )}

            {selectedDest && reviewsLoading && <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-32 bg-surface-container-lowest rounded-2xl animate-pulse" />)}</div>}

            {selectedDest && reviewAgg && reviewAgg.review_count > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-3xl font-black text-on-surface">{reviewAgg.avg_rating}</p>
                  <div>
                    <StarRating value={Math.round(Number(reviewAgg.avg_rating))} readOnly size="sm" />
                    <p className="text-xs text-on-surface-variant mt-0.5">{reviewAgg.review_count} {reviewAgg.review_count === 1 ? 'review' : 'reviews'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-outline-variant">
                  {reviewAgg.avg_cost_inr && (
                    <div className="text-center">
                      <p className="text-sm font-bold text-on-surface">{formatINR(Number(reviewAgg.avg_cost_inr))}</p>
                      <p className="text-[10px] text-on-surface-variant">Avg Cost</p>
                    </div>
                  )}
                  {reviewAgg.avg_time_spent_hours && (
                    <div className="text-center">
                      <p className="text-sm font-bold text-on-surface">{reviewAgg.avg_time_spent_hours}h</p>
                      <p className="text-[10px] text-on-surface-variant">Avg Time</p>
                    </div>
                  )}
                  {reviewAgg.common_crowd_level && (
                    <div className="text-center">
                      <p className="text-sm font-bold text-on-surface">{CROWD_LABELS[reviewAgg.common_crowd_level] || reviewAgg.common_crowd_level}</p>
                      <p className="text-[10px] text-on-surface-variant">Crowd</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedDest && !reviewsLoading && reviews.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-on-surface">No experiences shared yet</p>
                <p className="text-sm text-on-surface-variant">Be the first to share what it's really like</p>
              </div>
            )}

            {reviews.map((r) => {
              const safe = r.felt_safe ? SAFE_CONFIG[r.felt_safe] : null
              const SafeIcon = safe?.icon
              return (
                <div key={r.id} className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-on-surface text-sm">{r.tourist_name}</p>
                      <p className="text-xs text-on-surface-variant">
                        {r.visited_date ? `Visited ${r.visited_date}` : formatTimeAgo(r.created_at)}
                      </p>
                    </div>
                    <StarRating value={r.rating} readOnly size="sm" />
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {r.actual_cost_inr != null && (
                      <span className="text-[10px] bg-surface-container rounded-full px-2 py-1 font-semibold text-on-surface-variant flex items-center gap-1">
                        <IndianRupee className="w-3 h-3" /> {formatINR(r.actual_cost_inr)}
                      </span>
                    )}
                    {r.time_spent_hours != null && (
                      <span className="text-[10px] bg-surface-container rounded-full px-2 py-1 font-semibold text-on-surface-variant flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {r.time_spent_hours}h
                      </span>
                    )}
                    {r.crowd_level && (
                      <span className="text-[10px] bg-surface-container rounded-full px-2 py-1 font-semibold text-on-surface-variant flex items-center gap-1">
                        <Users2 className="w-3 h-3" /> {CROWD_LABELS[r.crowd_level]} crowd
                      </span>
                    )}
                    {safe && SafeIcon && (
                      <span className={cn('text-[10px] rounded-full px-2 py-1 font-semibold flex items-center gap-1', safe.color)}>
                        <SafeIcon className="w-3 h-3" /> {safe.label}
                      </span>
                    )}
                  </div>

                  {r.review_text && <p className="text-sm text-on-surface mb-3">{r.review_text}</p>}

                  {r.photo_urls.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto">
                      {r.photo_urls.map((url, i) => (
                        <img key={i} src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${url}`} alt=""
                          className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-outline-variant" />
                      ))}
                    </div>
                  )}

                  {r.liked_text && (
                    <p className="text-xs text-on-surface-variant flex items-start gap-1.5 mb-1">
                      <ThumbsUp className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" /> {r.liked_text}
                    </p>
                  )}
                  {r.disliked_text && (
                    <p className="text-xs text-on-surface-variant flex items-start gap-1.5 mb-1">
                      <ThumbsDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" /> {r.disliked_text}
                    </p>
                  )}
                  {r.tips_text && (
                    <p className="text-xs text-primary flex items-start gap-1.5 bg-primary/10 rounded-lg p-2 mt-2">
                      <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {r.tips_text}
                    </p>
                  )}
                </div>
              )
            })}
          </>
        )}
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

      {/* Review Modal */}
      {showReviewForm && selectedDest && (
        <ReviewFormSheet destinationId={selectedDest} onClose={() => setShowReviewForm(false)} />
      )}
    </div>
  )
}

function ReviewFormSheet({ destinationId, onClose }: { destinationId: string; onClose: () => void }) {
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [visitedDate, setVisitedDate] = useState('')
  const [actualCostInr, setActualCostInr] = useState('')
  const [timeSpentHours, setTimeSpentHours] = useState('')
  const [crowdLevel, setCrowdLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH' | ''>('')
  const [feltSafe, setFeltSafe] = useState<'YES' | 'NO' | 'SOMEWHAT' | ''>('')
  const [cleanlinessRating, setCleanlinessRating] = useState(0)
  const [transportRating, setTransportRating] = useState(0)
  const [foodAvailabilityRating, setFoodAvailabilityRating] = useState(0)
  const [accessibilityRating, setAccessibilityRating] = useState(0)
  const [likedText, setLikedText] = useState('')
  const [dislikedText, setDislikedText] = useState('')
  const [tipsText, setTipsText] = useState('')
  const [photos, setPhotos] = useState<File[]>([])

  const { mutate: submitReview, isPending } = useMutation({
    mutationFn: () => {
      const payload: CreateReviewPayload = {
        rating,
        reviewText: reviewText || undefined,
        visitedDate: visitedDate || undefined,
        actualCostInr: actualCostInr ? Number(actualCostInr) : undefined,
        timeSpentHours: timeSpentHours ? Number(timeSpentHours) : undefined,
        crowdLevel: crowdLevel || undefined,
        feltSafe: feltSafe || undefined,
        cleanlinessRating: cleanlinessRating || undefined,
        transportRating: transportRating || undefined,
        foodAvailabilityRating: foodAvailabilityRating || undefined,
        accessibilityRating: accessibilityRating || undefined,
        likedText: likedText || undefined,
        dislikedText: dislikedText || undefined,
        tipsText: tipsText || undefined,
        photos,
      }
      return reviewApi.create(destinationId, payload)
    },
    onSuccess: () => {
      toast.success('Thanks for sharing your experience!')
      queryClient.invalidateQueries({ queryKey: ['destinations', destinationId, 'reviews'] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not submit — try again'),
  })

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4)
    setPhotos(files)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-surface-container-lowest rounded-t-3xl w-full max-h-[90vh] overflow-y-auto p-6 pb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-on-surface">Share Your Experience</h2>
          <button onClick={onClose}><X className="w-6 h-6 text-on-surface-variant" /></button>
        </div>

        <div className="space-y-5">
          <div className="text-center">
            <Label className="font-semibold text-sm block mb-2">Overall Rating *</Label>
            <div className="flex justify-center"><StarRating value={rating} onChange={setRating} size="lg" /></div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">Your Experience</Label>
            <textarea rows={3} placeholder="What was it like? e.g. 'The place was very clean and well organized. Morning is better...'"
              value={reviewText} onChange={(e) => setReviewText(e.target.value)}
              className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Visited On</Label>
              <Input type="date" className="h-11 rounded-xl" value={visitedDate} onChange={(e) => setVisitedDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Actual Cost (₹)</Label>
              <Input type="number" placeholder="1200" className="h-11 rounded-xl" value={actualCostInr} onChange={(e) => setActualCostInr(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">Time Spent (hours)</Label>
            <Input type="number" step="0.5" placeholder="5" className="h-11 rounded-xl" value={timeSpentHours} onChange={(e) => setTimeSpentHours(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">Crowd Level</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setCrowdLevel(v)}
                  className={cn('rounded-xl border-2 py-2 text-xs font-bold transition-all',
                    crowdLevel === v ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant')}>
                  {CROWD_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">Did You Feel Safe?</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['YES', 'SOMEWHAT', 'NO'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setFeltSafe(v)}
                  className={cn('rounded-xl border-2 py-2 text-xs font-bold transition-all',
                    feltSafe === v ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant')}>
                  {SAFE_CONFIG[v].label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-3 space-y-2.5">
            <MiniRating label="Cleanliness" value={cleanlinessRating} onChange={setCleanlinessRating} />
            <MiniRating label="Parking / Transport" value={transportRating} onChange={setTransportRating} />
            <MiniRating label="Food Availability" value={foodAvailabilityRating} onChange={setFoodAvailabilityRating} />
            <MiniRating label="Accessibility" value={accessibilityRating} onChange={setAccessibilityRating} />
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-sm flex items-center gap-1.5"><ThumbsUp className="w-3.5 h-3.5 text-green-600" /> What did you like?</Label>
            <Input placeholder="e.g. Clean, well organized, friendly locals" className="h-11 rounded-xl" value={likedText} onChange={(e) => setLikedText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold text-sm flex items-center gap-1.5"><ThumbsDown className="w-3.5 h-3.5 text-red-500" /> What could improve?</Label>
            <Input placeholder="e.g. Crowded in the afternoon" className="h-11 rounded-xl" value={dislikedText} onChange={(e) => setDislikedText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold text-sm flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-primary" /> Tips for future tourists</Label>
            <Input placeholder="e.g. Carry water and comfortable shoes" className="h-11 rounded-xl" value={tipsText} onChange={(e) => setTipsText(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-sm flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> Photos (up to 4)</Label>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoChange}
              className="w-full text-xs text-on-surface-variant file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0 file:bg-primary/10 file:text-primary file:text-xs file:font-bold" />
            {photos.length > 0 && <p className="text-xs text-on-surface-variant">{photos.length} photo{photos.length > 1 ? 's' : ''} selected</p>}
          </div>

          <Button onClick={() => submitReview()} disabled={isPending || rating === 0}
            className="w-full h-12 bg-on-surface text-surface rounded-full font-bold flex items-center justify-center gap-2">
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Submit Experience</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
