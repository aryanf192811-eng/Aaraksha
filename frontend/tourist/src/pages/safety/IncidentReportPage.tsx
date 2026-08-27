// src/pages/safety/IncidentReportPage.tsx
// E-FIR-style filing — an after-the-fact report (theft, harassment...)
// routed to a govt officer, distinct from both the SOS button (a live
// emergency) and Community's scam reports (a crowd-sourced warning to
// other travellers with no officer or case number attached).
import { useRef, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ArrowLeft, Loader2, Send, FileWarning, Wallet, UserX, HandFist, Landmark, FileX, Car, Hammer, HelpCircle, MapPin, Clock, Camera, X, ScanEye, Sparkles, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import incidentApi, { type IncidentCategory, type IncidentReport, type DetectedTag } from '../../api/incident.api'
import tripApi from '../../api/trip.api'
import { detectIncidentTags, loadImageFromFile } from '../../lib/incidentVision'
import { queryClient } from '../../lib/queryClient'
import { formatTimeAgo, cn } from '../../lib/utils'
import { tEnum } from '../../lib/i18nEnums'

const API_ORIGIN = (import.meta.env.VITE_API_URL as string || '').replace(/\/api\/?$/, '')

const CATEGORY_VALUES: IncidentCategory[] = ['THEFT', 'HARASSMENT', 'ASSAULT', 'FRAUD', 'LOST_DOCUMENT', 'VEHICLE_ACCIDENT', 'PROPERTY_DAMAGE', 'OTHER']
const CATEGORY_ICONS: Record<IncidentCategory, ComponentType<{ className?: string }>> = {
  THEFT: Wallet, HARASSMENT: UserX, ASSAULT: HandFist, FRAUD: Landmark,
  LOST_DOCUMENT: FileX, VEHICLE_ACCIDENT: Car, PROPERTY_DAMAGE: Hammer, OTHER: HelpCircle,
}
// Every tile gets a real color identity at rest, not just on selection —
// matches the SOS category grid's always-colored icon badges.
const CATEGORY_COLORS: Record<IncidentCategory, string> = {
  THEFT: 'bg-primary/10 text-primary-dark',
  HARASSMENT: 'bg-sos/10 text-sos-dark',
  ASSAULT: 'bg-sos/10 text-sos-dark',
  FRAUD: 'bg-purple-50 text-purple-700',
  LOST_DOCUMENT: 'bg-trust/10 text-trust-dark',
  VEHICLE_ACCIDENT: 'bg-tsi-high/10 text-tsi-high',
  PROPERTY_DAMAGE: 'bg-tsi-high/10 text-tsi-high',
  OTHER: 'bg-surface-container-high text-on-surface-variant',
}
const categoryLabel = (t: TFunction, value: string) => tEnum(t, 'incidentCategory', value)
const statusLabel = (t: TFunction, value: string) => tEnum(t, 'incidentStatus', value)

const STATUS_STYLE: Record<string, string> = {
  FILED:                'bg-sos/10 text-sos-dark',
  ASSIGNED:              'bg-primary/10 text-primary-dark',
  UNDER_INVESTIGATION:   'bg-trust/10 text-trust-dark',
  RESOLVED:              'bg-tsi-low/10 text-tsi-low',
  CLOSED:                'bg-surface-container-high text-on-surface-variant',
}

export default function IncidentReportPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [category, setCategory] = useState<IncidentCategory | ''>('')
  const [categoryAutoSuggested, setCategoryAutoSuggested] = useState(false)
  const [description, setDescription] = useState('')
  const [locationText, setLocationText] = useState('')
  const [occurredDate, setOccurredDate] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false)
  const [detectedTags, setDetectedTags] = useState<DetectedTag[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Runs entirely on-device (see lib/incidentVision.ts) — the photo never
  // leaves the browser for this step, only the resulting tag list travels
  // with the filed report. A suggestion only pre-fills the category if the
  // tourist hasn't already picked one themselves; it never overrides a
  // manual choice.
  const handlePhotoChange = async (file: File | null) => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setDetectedTags([])
    setCategoryAutoSuggested(false)
    if (!file) { setPhoto(null); setPhotoPreviewUrl(null); return }

    setPhoto(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
    setAnalyzingPhoto(true)
    try {
      const img = await loadImageFromFile(file)
      const { tags, suggestedCategory } = await detectIncidentTags(img)
      setDetectedTags(tags)
      if (suggestedCategory && !category) {
        setCategory(suggestedCategory as IncidentCategory)
        setCategoryAutoSuggested(true)
      }
    } finally {
      setAnalyzingPhoto(false)
    }
  }

  const { data: activeTrips } = useQuery({
    queryKey: ['trips', 'active-for-incident'],
    queryFn: () => tripApi.getMyTrips({ status: 'ACTIVE', limit: 1 }).then(r => r.data.data),
  })
  const activeTripId = activeTrips?.[0]?.id

  const { data: myReports, isLoading: loadingReports } = useQuery({
    queryKey: ['incidents', 'me'],
    queryFn: () => incidentApi.getMyIncidents().then(r => r.data.data),
  })

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => incidentApi.fileIncident({
      tripId: activeTripId ?? null,
      category: category as IncidentCategory,
      description: description.trim(),
      locationText: locationText.trim() || null,
      incidentOccurredAt: occurredDate ? new Date(occurredDate).toISOString() : null,
      photo,
      detectedTagsJson: detectedTags.length > 0 ? JSON.stringify(detectedTags) : null,
    }),
    onSuccess: (res) => {
      toast.success(t('incidentReport.toastFiled', { caseNumber: res.data.data.case_number }))
      queryClient.invalidateQueries({ queryKey: ['incidents', 'me'] })
      setCategory(''); setDescription(''); setLocationText(''); setOccurredDate('')
      handlePhotoChange(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: () => toast.error(t('incidentReport.toastFailed')),
  })

  const reports = myReports || []
  const canSubmit = category !== '' && description.trim().length >= 10

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6 text-on-surface" /></button>
          <div>
            <h1 className="text-xl font-black text-on-surface">{t('incidentReport.title')}</h1>
            <p className="text-xs text-on-surface-variant">{t('incidentReport.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-5">
        <p className="text-xs text-on-surface-variant bg-primary/10 border border-primary/20 rounded-xl p-3">
          {t('incidentReport.disclaimer')}
        </p>

        <div className="space-y-1.5">
          <Label className="font-semibold text-sm flex items-center gap-1.5">
            <Camera className="w-4 h-4" /> {t('incidentReport.photoLabel')}
          </Label>
          <p className="text-[11px] text-on-surface-variant -mt-0.5">{t('incidentReport.photoHint')}</p>

          {!photoPreviewUrl && (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-primary/30 bg-primary/5 rounded-xl py-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-primary/10 transition-colors">
              <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary-dark">{t('incidentReport.attachPhoto')}</span>
            </button>
          )}

          {photoPreviewUrl && (
            <div className="relative rounded-xl overflow-hidden border border-outline-variant">
              <img src={photoPreviewUrl} alt="" className="w-full h-40 object-cover" />
              <button type="button" onClick={() => handlePhotoChange(null)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white">
                <X className="w-4 h-4" />
              </button>
              {analyzingPhoto && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 text-white text-xs font-semibold">
                  <ScanEye className="w-4 h-4 animate-pulse" /> {t('incidentReport.analyzingPhoto')}
                </div>
              )}
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)} />

          {detectedTags.length > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-2.5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-violet-700 uppercase tracking-wide mb-1.5">
                <Sparkles className="w-3 h-3" /> {t('incidentReport.detectedOnDevice')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detectedTags.map((tag) => (
                  <span key={tag.class} className="text-[10px] bg-white border border-violet-200 text-violet-700 rounded-full px-2 py-0.5 font-semibold">
                    {tag.class} · {Math.round(tag.score * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">{t('incidentReport.categoryLabel')}</Label>
          {categoryAutoSuggested && (
            <p className="text-[11px] text-violet-700 flex items-center gap-1 -mt-0.5">
              <Sparkles className="w-3 h-3" /> {t('incidentReport.categorySuggested')}
            </p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {CATEGORY_VALUES.map((value) => {
              const Icon = CATEGORY_ICONS[value]
              return (
                <button key={value} type="button" onClick={() => { setCategory(value); setCategoryAutoSuggested(false) }}
                  className={cn('relative border-2 rounded-xl p-2.5 text-center transition-colors',
                    category === value ? 'border-primary bg-primary/10' : 'border-outline-variant hover:border-primary/50')}>
                  {category === value && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2 h-2 text-primary-foreground" strokeWidth={4} />
                    </span>
                  )}
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-1.5', CATEGORY_COLORS[value])}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-on-surface leading-tight block">{categoryLabel(t, value)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">{t('incidentReport.descriptionLabel')}</Label>
          <textarea rows={4} placeholder={t('incidentReport.descriptionPlaceholder')} value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-outline-variant bg-surface-container rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-colors" />
        </div>

        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">{t('incidentReport.locationLabel')}</Label>
          <Input placeholder={t('incidentReport.locationPlaceholder')} className="h-11 rounded-xl"
            value={locationText} onChange={(e) => setLocationText(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">{t('incidentReport.occurredLabel')}</Label>
          <Input type="date" className="h-11 rounded-xl" value={occurredDate} onChange={(e) => setOccurredDate(e.target.value)} />
        </div>

        <Button onClick={() => submit()} disabled={!canSubmit || isPending}
          className="w-full h-12 bg-on-surface text-surface rounded-full font-bold flex items-center justify-center gap-2">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> {t('incidentReport.submitButton')}</>}
        </Button>

        {/* ── My Reports ─────────────────────────────────────── */}
        <div className="pt-2">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-2 px-0.5">
            {t('incidentReport.myReportsTitle')}
          </p>

          {loadingReports && <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 bg-surface-container-lowest rounded-2xl animate-pulse" />)}</div>}

          {!loadingReports && reports.length === 0 && (
            <div className="text-center py-10 bg-surface-container-lowest rounded-2xl shadow-sm">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2.5">
                <FileWarning className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm text-on-surface-variant">{t('incidentReport.noReports')}</p>
            </div>
          )}

          <div className="space-y-2.5">
            {reports.map((r: IncidentReport) => (
              <div key={r.id} className="bg-surface-container-lowest rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-[10px] font-bold text-on-surface-variant">{r.case_number}</span>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', STATUS_STYLE[r.status])}>
                    {statusLabel(t, r.status)}
                  </span>
                </div>
                <p className="text-sm font-bold text-on-surface mb-1">{categoryLabel(t, r.category)}</p>
                {r.photo_url && (
                  <img src={`${API_ORIGIN}${r.photo_url}`} alt="" className="w-full h-28 object-cover rounded-lg mb-2 border border-outline-variant" />
                )}
                <p className="text-xs text-on-surface-variant mb-2 line-clamp-2">{r.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-on-surface-variant">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimeAgo(r.filed_at)}</span>
                  {r.location_text && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.location_text}</span>}
                </div>
                {r.assigned_officer_name && (
                  <p className="text-[10px] text-primary-dark font-medium mt-1.5">
                    {t('incidentReport.assignedTo', { name: r.assigned_officer_name })}
                  </p>
                )}
                {r.resolution_notes && (
                  <p className="text-xs text-on-surface bg-surface-container rounded-lg p-2 mt-2">{r.resolution_notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
