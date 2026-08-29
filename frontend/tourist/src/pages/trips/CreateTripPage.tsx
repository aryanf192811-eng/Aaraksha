// src/pages/trips/CreateTripPage.tsx
// Multi-step: Step1 (basics) -> Step2 (stops) -> Step3 (review + create)
// FIELD NAMES: title, travelType, startDate, endDate, budgetInr, stops[]
// Zod schema verified against backend src/validators/trip.validator.js
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Plus, Trash2, Loader2, ChevronRight, ChevronLeft,
  User, Users, Mountain, Landmark, Briefcase, Rocket, Check, Calendar, Wallet, Sparkles, Route,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { DestinationSearchField } from '../../components/shared'
import tripApi, { type CreateTripPayload } from '../../api/trip.api'
import { getErrorMessage } from '../../api/client'
import destinationApi from '../../api/destination.api'
import { queryClient } from '../../lib/queryClient'
import { tEnum } from '../../lib/i18nEnums'
import { getDestinationImage } from '../../lib/destinationImages'
import { cn } from '../../lib/utils'
import type { TravelType } from '../../constants/enums'
import type { Destination } from '../../types/api.types'

const CreateTripSchema = z.object({
  title:      z.string().min(1, 'Trip name required').max(255),
  travelType: z.enum(['SOLO', 'FAMILY', 'FRIENDS', 'ADVENTURE', 'PILGRIMAGE', 'BUSINESS']),
  startDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date'),
  endDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date'),
  // An untouched number input holds '' (not undefined) in react-hook-form,
  // and z.coerce.number() turns '' into 0 before .optional() ever sees it —
  // silently failing .positive() and blocking submit with no visible error
  // (step 3 renders no error UI). Preprocess '' to undefined first so an
  // empty budget is actually treated as "not provided".
  budgetInr: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.coerce.number().positive().optional()
  ),
  isPublic:   z.boolean().optional().default(false),
  stops: z.array(z.object({
    city:          z.string().min(1, 'City required'),
    state:         z.string().min(1, 'State required'),
    destinationId: z.string().optional().nullable(),
    // Populated by DestinationSearchField's real Nominatim lookup — without
    // these, TripDetailPage's map tab silently drops the stop, since it
    // filters to stops.filter(s => s.lat != null && s.lng != null).
    // z.coerce (not plain z.number()) to match every other numeric field
    // here — pg returns NUMERIC columns as strings (see addQuickStop's
    // comment), and a plain z.number() rejects those silently with no
    // visible form error. Zod short-circuits null/undefined before the
    // coerce step, so real "no coordinates yet" stays null, not 0.
    lat:           z.coerce.number().optional().nullable(),
    lng:           z.coerce.number().optional().nullable(),
    days:          z.coerce.number().int().min(1).max(30),
    connectivity:  z.string().optional().default('MODERATE'),
    difficulty:    z.string().optional().default('EASY'),
    altitude_m:    z.coerce.number().optional().default(0),
    zone_type:     z.string().optional().default('SAFE'),
    hospital_km:   z.coerce.number().optional().default(0),
  })).optional().default([]),
}).refine(d => d.startDate < d.endDate, {
  message: 'End date must be after start date', path: ['endDate']
})

// The schema's .default() fields (stops, isPublic) make the OUTPUT type
// required but the INPUT type (what the form actually holds pre-submit)
// keeps them optional — useForm must be typed with the input shape, and
// the submit handler receives the parsed output shape. Mixing these up is
// what produces an unresolvable Resolver<...> generic mismatch.
type FormInput = z.input<typeof CreateTripSchema>
type FormOutput = z.infer<typeof CreateTripSchema>

const TRAVEL_TYPE_CONFIG = [
  { value: 'SOLO',       Icon: User,     color: 'bg-primary/10 text-primary-dark' },
  { value: 'FAMILY',     Icon: Users,    color: 'bg-trust/10 text-trust-dark' },
  { value: 'FRIENDS',    Icon: Users,    color: 'bg-purple-50 text-purple-700' },
  { value: 'ADVENTURE',  Icon: Mountain, color: 'bg-tsi-high/10 text-tsi-high' },
  { value: 'PILGRIMAGE', Icon: Landmark, color: 'bg-tsi-low/10 text-tsi-low' },
  { value: 'BUSINESS',   Icon: Briefcase, color: 'bg-surface-container-high text-on-surface-variant' },
] as const

// Cycled per stop-card index so a multi-stop itinerary reads as a colorful
// sequence rather than identical gray boxes — same semantic tokens used
// elsewhere in the app (trust, primary, tsi-*), not new colors invented
// just for this screen.
const STOP_ACCENTS = [
  { border: 'border-l-primary', badge: 'bg-primary/15 text-primary-dark' },
  { border: 'border-l-trust', badge: 'bg-trust/15 text-trust-dark' },
  { border: 'border-l-tsi-low', badge: 'bg-tsi-low/15 text-tsi-low' },
  { border: 'border-l-purple-400', badge: 'bg-purple-100 text-purple-700' },
  { border: 'border-l-tsi-high', badge: 'bg-tsi-high/15 text-tsi-high' },
] as const

export default function CreateTripPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [step, setStep] = useState(1)

  // Real destination rows (id, connectivity, difficulty, altitude_m,
  // zone_type, hospital_km) — quick-add stops must carry this, not
  // placeholder defaults, since the TSI engine and destination-linked
  // features (news, hospital lookups) key off it.
  const { data: destinations = [] } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => destinationApi.getAll().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  })

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(CreateTripSchema),
    defaultValues: { travelType: 'SOLO', stops: [], isPublic: false }
  })
  const { fields: stops, append, remove } = useFieldArray({ control, name: 'stops' })
  const watchedData = watch()

  // Live, derived — no submit required to see it. Trip length recomputes
  // on every date keystroke; the stops summary recomputes on every
  // add/remove/day-count edit, so Step 2 always shows real running totals
  // instead of only surfacing them after creation.
  const tripDays = watchedData.startDate && watchedData.endDate && watchedData.startDate < watchedData.endDate
    ? Math.round((new Date(watchedData.endDate).getTime() - new Date(watchedData.startDate).getTime()) / 86_400_000)
    : null
  const totalStopDays = (watchedData.stops || []).reduce((sum, s) => sum + (Number(s?.days) || 0), 0)

  const { mutate: createTrip, isPending } = useMutation({
    mutationFn: (data: CreateTripPayload) => tripApi.createTrip(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      toast.success(t('createTrip.toastCreated'))
      navigate(`/trips/${res.data.data.id}`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const onSubmit = (data: FormOutput) => {
    createTrip({
      title:      data.title,
      travelType: data.travelType,
      startDate:  data.startDate,
      endDate:    data.endDate,
      budgetInr:  data.budgetInr || null,
      isPublic:   data.isPublic,
      stops:      data.stops || [],
    })
  }

  // Every Step 1 field already renders its own inline error (see
  // `errors.title`/`errors.startDate`/`errors.endDate` below) -- but only
  // if the tourist is actually looking at Step 1. Reaching Review (Step 3)
  // never validated anything on the way there (Next/Review are plain
  // setStep() calls, not per-step handleSubmit), so clicking "Create Trip"
  // with an empty name or date used to fail validation completely
  // silently: no toast, no navigation, no visible reason the button did
  // nothing. This surfaces the real error and jumps back to whichever step
  // actually holds the invalid field, so the inline error the tourist
  // never got to see becomes visible immediately.
  const onInvalid = (formErrors: typeof errors) => {
    const firstMessage = formErrors.title?.message || formErrors.travelType?.message
      || formErrors.startDate?.message || formErrors.endDate?.message
      || (Array.isArray(formErrors.stops) ? formErrors.stops.find(Boolean) : formErrors.stops)?.city?.message
      || 'Please check the highlighted fields before creating your trip'
    toast.error(firstMessage)
    if (formErrors.title || formErrors.travelType || formErrors.startDate || formErrors.endDate) setStep(1)
    else if (formErrors.stops) setStep(2)
  }

  const addQuickStop = (dest: Destination) => {
    // pg returns NUMERIC/DECIMAL columns as strings, not numbers (same
    // gotcha documented in the volunteer app's ActiveJobPage.tsx) — the
    // Destination type claims `number | null` but the real /destinations
    // response hands back a numeric string, which z.number() rejects
    // silently (no visible error, Create Trip just never fires). Coerce
    // explicitly rather than loosening the schema, since every other
    // lat/lng source (DestinationSearchField) already provides real numbers.
    const lat = dest.latitude != null ? Number(dest.latitude) : null
    const lng = dest.longitude != null ? Number(dest.longitude) : null
    append({
      city: dest.name, state: dest.state, destinationId: dest.id,
      lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null, days: 2,
      connectivity: dest.connectivity, difficulty: dest.difficulty,
      altitude_m: dest.altitude_m, zone_type: dest.zone_type,
      hospital_km: dest.nearest_hospital_km ?? 0,
    })
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Header */}
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}>
          <ArrowLeft className="w-6 h-6 text-on-surface" />
        </button>
        <div>
          <h1 className="text-xl font-black text-on-surface">{t('createTrip.planNewTrip')}</h1>
          <p className="text-xs text-on-surface-variant">{t('createTrip.stepOf', { step })}</p>
        </div>
      </div>

      {/* Progress — numbered nodes + connecting line, matching the "How it
          works" stepper motif used on Landing, not a generic flat bar. */}
      <div className="flex items-center px-6 pt-5 pb-1">
        {[
          { n: 1, labelKey: 'createTrip.tripNameLabel' },
          { n: 2, labelKey: 'createTrip.addDestinations' },
          { n: 3, labelKey: 'createTrip.review' },
        ].map(({ n }, i, arr) => (
          <div key={n} className={cn('flex items-center', i < arr.length - 1 && 'flex-1')}>
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black transition-colors',
              n < step ? 'bg-primary text-primary-foreground' :
              n === step ? 'bg-primary/15 text-primary border-2 border-primary' :
              'bg-surface-container-high text-on-surface-variant'
            )}>
              {n < step ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : n}
            </div>
            {i < arr.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-1.5 rounded-full transition-colors', n < step ? 'bg-primary' : 'bg-surface-container-highest')} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="px-5 mt-5 space-y-5">
        {/* ── Step 1: Basics ──────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5 animate-slide-up">
            <div className="space-y-1.5">
              <Label className="font-semibold">{t('createTrip.tripNameLabel')}</Label>
              <Input placeholder={t('createTrip.tripNamePlaceholder')} className="h-12 rounded-xl" {...register('title')} />
              {errors.title && <p className="text-xs text-sos-dark">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">{t('createTrip.travelTypeLabel')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {TRAVEL_TYPE_CONFIG.map(({ value, Icon, color }) => (
                  <button key={value} type="button"
                    onClick={() => setValue('travelType', value as TravelType)}
                    className={cn('relative rounded-2xl border-2 p-3 flex flex-col items-center gap-1.5 transition-all',
                      watchedData.travelType === value ? 'border-primary bg-primary/10' : 'border-outline-variant bg-surface-container-lowest'
                    )}>
                    {watchedData.travelType === value && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
                      </span>
                    )}
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center', color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-on-surface">{tEnum(t, 'travelType', value)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-trust/5 border border-trust/15 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-trust-dark">
                  <span className="w-7 h-7 rounded-full bg-trust/15 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-trust-dark" />
                  </span>
                  {t('createTrip.datesSectionLabel')}
                </span>
                {tripDays != null && (
                  <span className="text-[11px] font-bold bg-trust/15 text-trust-dark px-2.5 py-1 rounded-full animate-slide-up">
                    {t('createTrip.tripLength', { count: tripDays })}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-semibold">{t('createTrip.startDateLabel')}</Label>
                  <Input type="date" className="h-12 rounded-xl bg-surface-container-lowest" {...register('startDate')}
                    min={new Date().toISOString().split('T')[0]} />
                  {errors.startDate && <p className="text-xs text-sos-dark">{errors.startDate.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold">{t('createTrip.endDateLabel')}</Label>
                  <Input type="date" className="h-12 rounded-xl bg-surface-container-lowest" {...register('endDate')}
                    min={watchedData.startDate || new Date().toISOString().split('T')[0]} />
                  {errors.endDate && <p className="text-xs text-sos-dark">{errors.endDate.message}</p>}
                </div>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 space-y-1.5">
              <span className="flex items-center gap-2 text-sm font-bold text-primary-dark mb-1">
                <span className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-3.5 h-3.5 text-primary-dark" />
                </span>
                {t('createTrip.budgetLabel')}
              </span>
              <Input type="number" placeholder={t('createTrip.budgetPlaceholder')} className="h-12 rounded-xl bg-surface-container-lowest" {...register('budgetInr')} />
            </div>

            <Button type="button" onClick={() => setStep(2)}
              className="w-full h-12 bg-primary hover:brightness-95 text-on-surface rounded-full font-bold">
              {t('createTrip.addDestinations')} <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        {/* ── Step 2: Stops ───────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-on-surface text-lg">{t('createTrip.addDestinations')}</h2>
                <p className="text-sm text-on-surface-variant">{t('createTrip.addDestinationsSubtitle')}</p>
              </div>
              {/* Live running total — updates on every add/remove/day edit,
                  no need to reach Step 3 to see it. */}
              {stops.length > 0 && (
                <span className="flex-shrink-0 flex items-center gap-1.5 bg-primary/10 text-primary-dark text-xs font-bold px-3 py-1.5 rounded-full">
                  <Route className="w-3.5 h-3.5" />
                  {t('createTrip.stopsAndDaysSummary', { stops: stops.length, days: totalStopDays })}
                </span>
              )}
            </div>

            {/* Quick add popular destinations — photo chips, not plain pills */}
            {destinations.length > 0 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-5 px-5">
                {destinations.map(dest => (
                  <button key={dest.id} type="button"
                    onClick={() => addQuickStop(dest)}
                    className="relative flex-shrink-0 w-24 h-20 rounded-2xl overflow-hidden shadow-sm border border-outline-variant hover:border-primary/60 hover:shadow-md transition-all group">
                    <img src={getDestinationImage(dest.name, { w: 200, q: 70 })} alt=""
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center">
                      <Plus className="w-3 h-3 text-white" strokeWidth={3} />
                    </span>
                    <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[11px] font-bold text-white leading-tight truncate text-left">
                      {dest.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Added stops — colored accent + live city thumbnail */}
            {stops.map((field, idx) => {
              const accent = STOP_ACCENTS[idx % STOP_ACCENTS.length]
              const cityNow = watchedData.stops?.[idx]?.city || ''
              return (
                <div key={field.id} className={cn('bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex border-l-4', accent.border)}>
                  {cityNow.length >= 3 && (
                    <img src={getDestinationImage(cityNow, { w: 200, q: 70 })} alt=""
                      className="w-16 sm:w-20 flex-shrink-0 object-cover" />
                  )}
                  <div className="p-4 flex-1 min-w-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-on-surface">
                        <span className={cn('w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center flex-shrink-0', accent.badge)}>{idx + 1}</span>
                        {t('createTrip.stopLabel', { n: idx + 1 })}
                      </span>
                      <button type="button" onClick={() => remove(idx)}>
                        <Trash2 className="w-4 h-4 text-sos/60 hover:text-sos-dark transition-colors" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <DestinationSearchField
                        city={cityNow}
                        onCityChange={(city) => setValue(`stops.${idx}.city`, city)}
                        onSelect={(result) => {
                          setValue(`stops.${idx}.city`, result.city)
                          setValue(`stops.${idx}.state`, result.state)
                          setValue(`stops.${idx}.lat`, result.lat)
                          setValue(`stops.${idx}.lng`, result.lng)
                        }}
                        cityPlaceholder={t('createTrip.cityPlaceholder')}
                      />
                      <Input placeholder={t('createTrip.statePlaceholder')} className="h-10 rounded-lg text-sm" {...register(`stops.${idx}.state`)} />
                      <div className="flex items-center gap-2 col-span-2">
                        <span className="text-xs text-on-surface-variant whitespace-nowrap">{t('createTrip.daysLabel')}</span>
                        <Input type="number" min={1} className="h-10 rounded-lg text-sm w-20" {...register(`stops.${idx}.days`)} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            <Button type="button" variant="outline"
              onClick={() => append({ city: '', state: '', destinationId: null, lat: null, lng: null, days: 2, connectivity: 'MODERATE', difficulty: 'EASY', altitude_m: 0, zone_type: 'SAFE', hospital_km: 0 })}
              className="w-full rounded-xl border-dashed h-11">
              <Plus className="w-4 h-4 mr-2" /> {t('createTrip.addCustomDestination')}
            </Button>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-full">
                <ChevronLeft className="mr-2 w-4 h-4" /> {t('common.back')}
              </Button>
              <Button type="button" onClick={() => setStep(3)} className="flex-1 h-12 bg-primary text-on-surface rounded-full font-bold">
                {t('createTrip.review')} <ChevronRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review ─────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <h2 className="font-black text-on-surface text-lg">{t('createTrip.reviewTrip')}</h2>
              <p className="text-sm text-on-surface-variant">{t('createTrip.reviewTripSubtitle')}</p>
            </div>

            <div className="bg-surface-container-lowest rounded-3xl shadow-sm overflow-hidden">
              {/* Photo header — the review reads as a trip preview, not a
                  form-data dump */}
              <div className="relative h-32">
                <img src={getDestinationImage(stops[0]?.city, { w: 800, q: 80 })} alt=""
                  className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  {tripDays != null && (
                    <span className="flex items-center gap-1 text-xs bg-primary/80 backdrop-blur-md text-on-surface px-2.5 py-1 rounded-full font-bold">
                      <Sparkles className="w-3 h-3" /> {t('createTrip.tripLength', { count: tripDays })}
                    </span>
                  )}
                  <span className="text-xs bg-white/15 backdrop-blur-md text-white px-2.5 py-1 rounded-full font-semibold border border-white/20">
                    {tEnum(t, 'travelType', watchedData.travelType)}
                  </span>
                </div>
                <p className="absolute bottom-3 left-4 right-4 font-display font-black text-lg text-white leading-tight truncate">{watchedData.title}</p>
              </div>

              <div className="p-5 space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm text-on-surface font-medium">{watchedData.startDate} → {watchedData.endDate}</p>
                </div>

                {watchedData.budgetInr != null && watchedData.budgetInr !== '' && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Wallet className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-sm text-on-surface font-medium">{t('createTrip.budgetSummary', { amount: Number(watchedData.budgetInr).toLocaleString('en-IN') })}</p>
                  </div>
                )}

                {stops.length > 0 && (
                  <div className="pt-3.5 border-t border-outline-variant space-y-2.5">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">{t('createTrip.stopsLabel')}</p>
                    {stops.map((s, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <img src={getDestinationImage(s.city, { w: 100, q: 60 })} alt=""
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ring-surface-container-lowest" />
                        <p className="text-sm text-on-surface font-medium">{t('createTrip.stopSummary', { city: s.city, state: s.state, days: String(s.days) })}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 h-12 rounded-full">
                <ChevronLeft className="mr-2 w-4 h-4" /> {t('common.back')}
              </Button>
              <Button type="submit" disabled={isPending} className="flex-1 h-12 bg-on-surface text-surface rounded-full font-bold">
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Rocket className="w-4 h-4 mr-2" /> {t('createTrip.createTripButton')}</>}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
