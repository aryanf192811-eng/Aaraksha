// src/pages/auth/components/RegisterForm.tsx
// Multi-step registration: Step 1 (basic info) -> Step 2 (govt ID) -> Step 3 (emergency contacts)
import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { User, Lock, CreditCard, Plus, Trash2, Loader2, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { PasswordInput } from '../../../components/ui/password-input'
import { Label } from '../../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'
import authApi, { type RegisterPayload } from '../../../api/auth.api'
import { useAuthStore } from '../../../store/auth.store'
import type { GovtIdType } from '../../../constants/enums'

// Zod schemas verified against backend src/validators/auth.validator.js —
// RegisterTouristSchema, EmergencyContactSchema, and the govtIdNumberRefinement
// patterns (AADHAAR/PASSPORT/VOTER_ID/DRIVING_LICENSE regexes match exactly).
const AADHAAR_PATTERN  = /^\d{12}$/
const PASSPORT_PATTERN = /^[A-Z]\d{7}$/
const VOTER_PATTERN    = /^[A-Z]{3}\d{7}$/
const DL_PATTERN       = /^[A-Z0-9]{8,20}$/

const Step1Schema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(255),
  phone:    z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  email:    z.string().email('Invalid email').optional().or(z.literal('')),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword']
})

const Step2Schema = z.object({
  govtIdType:   z.enum(['AADHAAR', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE']),
  govtIdNumber: z.string().min(8, 'Invalid ID number'),
  bloodGroup:   z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  medicalInfo:  z.string().max(1000).optional(), // backend cap is 1000, not 500
}).superRefine((d, ctx) => {
  const num = d.govtIdNumber.toUpperCase().replace(/[\s-]/g, '')
  const patterns: Record<string, RegExp> = {
    AADHAAR: AADHAAR_PATTERN, PASSPORT: PASSPORT_PATTERN, VOTER_ID: VOTER_PATTERN, DRIVING_LICENSE: DL_PATTERN,
  }
  if (patterns[d.govtIdType] && !patterns[d.govtIdType].test(num)) {
    ctx.addIssue({ code: 'custom', message: `Invalid ${d.govtIdType.replace('_', ' ')} format`, path: ['govtIdNumber'] })
  }
})

const Step3Schema = z.object({
  emergencyContacts: z.array(z.object({
    name:     z.string().min(2, 'Name required').max(100),   // matches backend max(100)
    phone:    z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit mobile number required'),
    relation: z.string().min(2, 'Relation required').max(50), // matches backend max(50)
  })).min(1, 'Add at least one emergency contact').max(3),
})

type Step1 = z.infer<typeof Step1Schema>
type Step2 = z.infer<typeof Step2Schema>
type Step3 = z.infer<typeof Step3Schema>

const STEP_TITLES = ['Basic Info', 'Government ID', 'Emergency Contacts']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

export function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<Partial<RegisterPayload>>({})

  const step1 = useForm<Step1>({ resolver: zodResolver(Step1Schema), defaultValues: { fullName: '', phone: '', email: '', password: '', confirmPassword: '' } })
  const step2 = useForm<Step2>({ resolver: zodResolver(Step2Schema), defaultValues: { govtIdType: 'AADHAAR', govtIdNumber: '', bloodGroup: undefined } })
  const step3 = useForm<Step3>({ resolver: zodResolver(Step3Schema), defaultValues: { emergencyContacts: [{ name: '', phone: '', relation: '' }] } })
  const { fields, append, remove } = useFieldArray({ control: step3.control, name: 'emergencyContacts' })

  const { mutate: registerTourist, isPending } = useMutation({
    mutationFn: (data: RegisterPayload) => authApi.register(data),
    onSuccess: (res) => {
      setAuth(res.data.data.token, res.data.data.tourist)
      toast.success('Account created! Welcome to Aaraksha.')
      navigate('/dashboard')
    },
  })

  const handleStep1 = step1.handleSubmit((d) => {
    setFormData(prev => ({ ...prev, fullName: d.fullName, phone: d.phone, email: d.email || undefined, password: d.password }))
    setStep(2)
  })

  const handleStep2 = step2.handleSubmit((d) => {
    setFormData(prev => ({ ...prev, govtIdType: d.govtIdType, govtIdNumber: d.govtIdNumber.toUpperCase().replace(/[\s-]/g, ''), bloodGroup: d.bloodGroup, medicalInfo: d.medicalInfo }))
    setStep(3)
  })

  const handleStep3 = step3.handleSubmit((d) => {
    const payload: RegisterPayload = {
      fullName:          formData.fullName!,
      phone:             formData.phone!,
      email:             formData.email,
      password:          formData.password!,
      govtIdType:        formData.govtIdType!,
      govtIdNumber:      formData.govtIdNumber!,
      bloodGroup:        formData.bloodGroup,
      medicalInfo:       formData.medicalInfo,
      emergencyContacts: d.emergencyContacts.map((c, i) => ({
        ...c, tier: i === 0 ? 1 : 2, notifyOnSOS: true,
      })),
    }
    registerTourist(payload)
  })

  const GOVTID_PLACEHOLDERS: Record<string, string> = {
    AADHAAR: '1234 5678 9012', PASSPORT: 'A1234567', VOTER_ID: 'ABC1234567', DRIVING_LICENSE: 'DL1420110012345',
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-black text-on-surface mb-1">Create account</h2>
        <p className="text-sm text-on-surface-variant">Step {step} of 3 — {STEP_TITLES[step - 1]}</p>
        {/* Step indicator */}
        <div className="flex gap-1.5 mt-3">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-primary' : 'bg-surface-container-high'}`} />
          ))}
        </div>
      </div>

      {/* ── Step 1: Basic Info ─────────────────────────────────── */}
      {step === 1 && (
        <form onSubmit={handleStep1} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <Input placeholder="Aryan Kumar" className="pl-10 h-12 rounded-xl" {...step1.register('fullName')} />
            </div>
            {step1.formState.errors.fullName && <p className="text-xs text-sos-dark">{step1.formState.errors.fullName.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Mobile Number</Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">+91</span>
              <Input placeholder="9876543210" className="pl-12 h-12 rounded-xl" type="tel" {...step1.register('phone')} />
            </div>
            {step1.formState.errors.phone && <p className="text-xs text-sos-dark">{step1.formState.errors.phone.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Email (optional)</Label>
            <Input placeholder="you@email.com" type="email" className="h-12 rounded-xl" {...step1.register('email')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Password</Label>
              <PasswordInput placeholder="Min 8 chars" className="h-12 rounded-xl" {...step1.register('password')} />
              {step1.formState.errors.password && <p className="text-xs text-sos-dark">{step1.formState.errors.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Confirm</Label>
              <PasswordInput showLockIcon={false} placeholder="Repeat" className="h-12 rounded-xl" {...step1.register('confirmPassword')} />
              {step1.formState.errors.confirmPassword && <p className="text-xs text-sos-dark">{step1.formState.errors.confirmPassword.message}</p>}
            </div>
          </div>

          <Button type="submit" className="w-full h-12 bg-primary hover:brightness-95 text-primary-foreground rounded-full font-bold">
            Continue <ChevronRight className="ml-2 w-4 h-4" />
          </Button>

          <p className="text-center text-sm text-on-surface-variant">
            Already registered?{' '}
            <button type="button" onClick={onSwitch} className="text-primary font-semibold hover:underline">Log in</button>
          </p>
        </form>
      )}

      {/* ── Step 2: Government ID ──────────────────────────────── */}
      {step === 2 && (
        <form onSubmit={handleStep2} className="space-y-4">
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-start gap-2 text-xs text-primary">
            <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Your ID is stored as an encrypted hash. The actual number is never stored.</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">ID Type</Label>
            <Select
              onValueChange={(v) => step2.setValue('govtIdType', v as GovtIdType)}
              defaultValue="AADHAAR"
            >
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue placeholder="Select ID type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AADHAAR">Aadhaar Card (12 digits)</SelectItem>
                <SelectItem value="PASSPORT">Passport</SelectItem>
                <SelectItem value="VOTER_ID">Voter ID</SelectItem>
                <SelectItem value="DRIVING_LICENSE">Driving License</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">ID Number</Label>
            <div className="relative">
              <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <Input
                className="pl-10 h-12 rounded-xl"
                placeholder={GOVTID_PLACEHOLDERS[step2.watch('govtIdType')] || 'Enter ID number'}
                {...step2.register('govtIdNumber')}
              />
            </div>
            {step2.formState.errors.govtIdNumber && <p className="text-xs text-sos-dark">{step2.formState.errors.govtIdNumber.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Blood Group (recommended)</Label>
              <Select
                onValueChange={(v) => step2.setValue('bloodGroup', v as Step2['bloodGroup'])}
              >
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Medical Info</Label>
              <Input className="h-12 rounded-xl" placeholder="Allergies, conditions..." {...step2.register('medicalInfo')} />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-full">
              <ChevronLeft className="mr-2 w-4 h-4" /> Back
            </Button>
            <Button type="submit" className="flex-1 h-12 bg-primary hover:brightness-95 text-primary-foreground rounded-full font-bold">
              Continue <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </form>
      )}

      {/* ── Step 3: Emergency Contacts ─────────────────────────── */}
      {step === 3 && (
        <form onSubmit={handleStep3} className="space-y-4">
          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div key={field.id} className="bg-surface-container rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                    <span className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-tsi-low' : 'bg-primary'}`} />
                    {idx === 0 ? 'Primary Contact — notified immediately' : 'Secondary Contact — notified after 60s'}
                  </span>
                  {idx > 0 && (
                    <button type="button" onClick={() => remove(idx)}>
                      <Trash2 className="w-4 h-4 text-sos/60 hover:text-sos-dark transition-colors" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Name" className="h-10 rounded-lg text-sm" {...step3.register(`emergencyContacts.${idx}.name`)} />
                  <Input placeholder="10-digit mobile (starts 6-9)" type="tel" className="h-10 rounded-lg text-sm" {...step3.register(`emergencyContacts.${idx}.phone`)} />
                  <Input placeholder="Relation (Parent, Friend...)" className="h-10 rounded-lg text-sm col-span-2" {...step3.register(`emergencyContacts.${idx}.relation`)} />
                </div>
                {(() => {
                  const err = step3.formState.errors.emergencyContacts?.[idx]
                  const message = err?.name?.message || err?.phone?.message || err?.relation?.message
                  return message ? <p className="text-xs text-sos-dark">{message}</p> : null
                })()}
              </div>
            ))}

            {fields.length < 3 && (
              <Button type="button" variant="outline" className="w-full rounded-xl border-dashed h-10"
                onClick={() => append({ name: '', phone: '', relation: '' })}>
                <Plus className="w-4 h-4 mr-2" /> Add Another Contact
              </Button>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 h-12 rounded-full">
              <ChevronLeft className="mr-2 w-4 h-4" /> Back
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1 h-12 bg-on-surface hover:bg-on-surface/90 text-surface rounded-full font-bold">
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Create Account</>}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
