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
import {
  ArrowLeft, Plus, Trash2, Loader2, ChevronRight, ChevronLeft, MapPin,
  User, Users, Mountain, Landmark, Briefcase, Rocket,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import tripApi, { type CreateTripPayload } from '../../api/trip.api'
import destinationApi from '../../api/destination.api'
import { queryClient } from '../../lib/queryClient'
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
  { value: 'SOLO',       Icon: User,     label: 'Solo' },
  { value: 'FAMILY',     Icon: Users,    label: 'Family' },
  { value: 'FRIENDS',    Icon: Users,    label: 'Friends' },
  { value: 'ADVENTURE',  Icon: Mountain, label: 'Adventure' },
  { value: 'PILGRIMAGE', Icon: Landmark, label: 'Pilgrimage' },
  { value: 'BUSINESS',   Icon: Briefcase,label: 'Business' },
] as const

export default function CreateTripPage() {
  const navigate = useNavigate()
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

  const { mutate: createTrip, isPending } = useMutation({
    mutationFn: (data: CreateTripPayload) => tripApi.createTrip(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      toast.success('Trip created successfully!')
      navigate(`/trips/${res.data.data.id}`)
    },
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

  const addQuickStop = (dest: Destination) => {
    append({
      city: dest.name, state: dest.state, destinationId: dest.id, days: 2,
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
          <h1 className="text-xl font-black text-on-surface">Plan New Trip</h1>
          <p className="text-xs text-on-surface-variant">Step {step} of 3</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex px-5 pt-4 gap-1.5">
        {[1, 2, 3].map(s => <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-surface-container-highest'}`} />)}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="px-5 mt-5 space-y-5">
        {/* ── Step 1: Basics ──────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5 animate-slide-up">
            <div className="space-y-1.5">
              <Label className="font-semibold">Trip Name *</Label>
              <Input placeholder="e.g. Meghalaya Adventure 2025" className="h-12 rounded-xl" {...register('title')} />
              {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Travel Type *</Label>
              <div className="grid grid-cols-3 gap-2">
                {TRAVEL_TYPE_CONFIG.map(({ value, Icon, label }) => (
                  <button key={value} type="button"
                    onClick={() => setValue('travelType', value as TravelType)}
                    className={`rounded-xl border-2 p-3 flex flex-col items-center gap-1 transition-all ${watchedData.travelType === value ? 'border-amber-500 bg-primary/10' : 'border-outline-variant bg-surface-container-lowest'}`}>
                    <Icon className="w-5 h-5 text-on-surface" />
                    <span className="text-xs font-semibold text-on-surface">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold">Start Date *</Label>
                <Input type="date" className="h-12 rounded-xl" {...register('startDate')}
                  min={new Date().toISOString().split('T')[0]} />
                {errors.startDate && <p className="text-xs text-red-500">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold">End Date *</Label>
                <Input type="date" className="h-12 rounded-xl" {...register('endDate')}
                  min={watchedData.startDate || new Date().toISOString().split('T')[0]} />
                {errors.endDate && <p className="text-xs text-red-500">{errors.endDate.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Budget (₹)</Label>
              <Input type="number" placeholder="e.g. 25000" className="h-12 rounded-xl" {...register('budgetInr')} />
            </div>

            <Button type="button" onClick={() => setStep(2)}
              className="w-full h-12 bg-primary hover:brightness-95 text-on-surface rounded-full font-bold">
              Add Destinations <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        {/* ── Step 2: Stops ───────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <h2 className="font-black text-on-surface text-lg">Add Destinations</h2>
              <p className="text-sm text-on-surface-variant">Pick from popular NE India destinations or add your own.</p>
            </div>

            {/* Quick add popular destinations */}
            <div className="flex flex-wrap gap-2">
              {destinations.map(dest => (
                <button key={dest.id} type="button"
                  onClick={() => addQuickStop(dest)}
                  className="flex items-center gap-1.5 bg-surface-container-lowest border border-outline-variant rounded-full px-3 py-1.5 text-sm font-medium text-on-surface hover:border-amber-400 hover:bg-primary/10 transition-colors">
                  <MapPin className="w-3 h-3 text-primary" /> {dest.name}
                </button>
              ))}
            </div>

            {/* Added stops */}
            {stops.map((field, idx) => (
              <div key={field.id} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-on-surface">Stop {idx + 1}</span>
                  <button type="button" onClick={() => remove(idx)}>
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="City" className="h-10 rounded-lg text-sm" {...register(`stops.${idx}.city`)} />
                  <Input placeholder="State" className="h-10 rounded-lg text-sm" {...register(`stops.${idx}.state`)} />
                  <div className="flex items-center gap-2 col-span-2">
                    <span className="text-xs text-on-surface-variant whitespace-nowrap">Days:</span>
                    <Input type="number" min={1} className="h-10 rounded-lg text-sm w-20" {...register(`stops.${idx}.days`)} />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline"
              onClick={() => append({ city: '', state: '', destinationId: null, days: 2, connectivity: 'MODERATE', difficulty: 'EASY', altitude_m: 0, zone_type: 'SAFE', hospital_km: 0 })}
              className="w-full rounded-xl border-dashed h-11">
              <Plus className="w-4 h-4 mr-2" /> Add Custom Destination
            </Button>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-full">
                <ChevronLeft className="mr-2 w-4 h-4" /> Back
              </Button>
              <Button type="button" onClick={() => setStep(3)} className="flex-1 h-12 bg-primary text-on-surface rounded-full font-bold">
                Review <ChevronRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review ─────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <h2 className="font-black text-on-surface text-lg">Review Trip</h2>
              <p className="text-sm text-on-surface-variant">Your Travel Safety Index will be calculated upon creation.</p>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-on-surface">{watchedData.title}</span>
                <span className="text-xs bg-amber-100 text-primary px-2 py-0.5 rounded-full font-semibold">{watchedData.travelType}</span>
              </div>
              <p className="text-sm text-on-surface-variant">{watchedData.startDate} → {watchedData.endDate}</p>
              {watchedData.budgetInr != null && watchedData.budgetInr !== '' && (
                <p className="text-sm text-on-surface-variant">Budget: ₹{Number(watchedData.budgetInr).toLocaleString('en-IN')}</p>
              )}
              {stops.length > 0 && (
                <div className="pt-2 border-t border-outline-variant space-y-1">
                  <p className="text-xs font-bold text-on-surface mb-1">Stops:</p>
                  {stops.map((s, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                      <MapPin className="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0" /> {s.city}, {s.state} ({String(s.days)} days)
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 h-12 rounded-full">
                <ChevronLeft className="mr-2 w-4 h-4" /> Back
              </Button>
              <Button type="submit" disabled={isPending} className="flex-1 h-12 bg-on-surface text-surface rounded-full font-bold">
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Rocket className="w-4 h-4 mr-2" /> Create Trip</>}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
