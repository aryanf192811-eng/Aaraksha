// src/pages/profile/ProfileEditPage.tsx
// Edit profile: full name, email, blood group, medical info, emergency
// contacts. Backend PATCH /tourists/me already supported this — the gap was
// purely a missing UI, which is why blood group / medical info looked
// "missing" once someone skipped them at registration.
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Trash2, Loader2, Save } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { useAuthStore } from '../../store/auth.store'
import touristApi from '../../api/tourist.api'
import { cn } from '../../lib/utils'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

const EditSchema = z.object({
  fullName:    z.string().min(2, 'Name must be at least 2 characters').max(255),
  email:       z.string().email('Invalid email').optional().or(z.literal('')),
  bloodGroup:  z.enum(BLOOD_GROUPS).optional(),
  medicalInfo: z.string().max(1000, 'Max 1000 characters').optional().or(z.literal('')),
  emergencyContacts: z.array(z.object({
    id:       z.string().optional(),
    name:     z.string().min(2, 'Name required').max(100),
    phone:    z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit mobile number required'),
    relation: z.string().min(2, 'Relation required').max(50),
  })).max(3, 'Maximum 3 emergency contacts'),
})

type EditForm = z.infer<typeof EditSchema>

export default function ProfileEditPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { tourist, updateTourist } = useAuthStore()

  const form = useForm<EditForm>({
    resolver: zodResolver(EditSchema),
    defaultValues: {
      fullName:    tourist?.full_name || '',
      email:       tourist?.email || '',
      bloodGroup:  (tourist?.blood_group as EditForm['bloodGroup']) || undefined,
      medicalInfo: tourist?.medical_info || '',
      emergencyContacts: (tourist?.emergency_contacts || []).map(c => ({
        id: c.id, name: c.name, phone: c.phone, relation: c.relation,
      })),
    },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'emergencyContacts' })

  const { mutate: saveProfile, isPending } = useMutation({
    mutationFn: (data: EditForm) => touristApi.updateMe({
      fullName:    data.fullName,
      email:       data.email || undefined,
      bloodGroup:  data.bloodGroup,
      medicalInfo: data.medicalInfo || undefined,
      emergencyContacts: data.emergencyContacts.map((c, i) => ({
        ...c, tier: (i === 0 ? 1 : 2) as 1 | 2, notifyOnSOS: true,
      })),
    }),
    onSuccess: (res) => {
      updateTourist(res.data.data)
      queryClient.setQueryData(['tourists', 'me'], res.data.data)
      toast.success(t('profileEdit.toastUpdated'))
      navigate('/profile')
    },
  })

  const onSubmit = form.handleSubmit((d) => saveProfile(d))

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6 text-on-surface" /></button>
          <h1 className="text-xl font-black text-on-surface">{t('profileEdit.title')}</h1>
        </div>
      </div>

      <form onSubmit={onSubmit} className="px-5 mt-5 space-y-4">
        {/* Basic info */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-on-surface">{t('profileEdit.basicInfo')}</h3>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('profileEdit.fullName')}</Label>
            <Input className="h-12 rounded-xl" {...form.register('fullName')} />
            {form.formState.errors.fullName && <p className="text-xs text-red-500">{form.formState.errors.fullName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('profileEdit.emailOptional')}</Label>
            <Input type="email" className="h-12 rounded-xl" {...form.register('email')} />
            {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
          </div>
        </div>

        {/* Health info */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-on-surface">{t('profile.healthInformation')}</h3>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('profile.bloodGroup')}</Label>
            <Select
              value={form.watch('bloodGroup')}
              onValueChange={(v) => form.setValue('bloodGroup', v as EditForm['bloodGroup'], { shouldDirty: true })}
            >
              <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder={t('profileEdit.selectBloodGroup')} /></SelectTrigger>
              <SelectContent>
                {BLOOD_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('profile.medicalInfo')}</Label>
            <textarea
              rows={3}
              placeholder={t('profileEdit.medicalInfoPlaceholder')}
              className={cn(
                "w-full min-w-0 rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm transition-colors outline-none resize-none",
                "placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-surface-container-lowest focus-visible:ring-3 focus-visible:ring-primary/20",
                "dark:bg-input/30"
              )}
              {...form.register('medicalInfo')}
            />
            {form.formState.errors.medicalInfo && <p className="text-xs text-red-500">{form.formState.errors.medicalInfo.message}</p>}
            <p className="text-xs text-on-surface-variant">{t('profileEdit.medicalInfoHint')}</p>
          </div>
        </div>

        {/* Emergency contacts */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-on-surface">{t('profile.emergencyContacts')}</h3>
          {fields.map((field, idx) => (
            <div key={field.id} className="bg-surface-container rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-on-surface uppercase tracking-wide">
                  <span className={cn('w-2 h-2 rounded-full', idx === 0 ? 'bg-green-500' : 'bg-primary')} />
                  {idx === 0 ? t('profileEdit.primaryContact') : t('profileEdit.secondaryContact')}
                </span>
                <button type="button" onClick={() => remove(idx)}>
                  <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t('profileEdit.namePlaceholder')} className="h-10 rounded-lg text-sm" {...form.register(`emergencyContacts.${idx}.name`)} />
                <Input placeholder={t('profileEdit.phonePlaceholder')} type="tel" className="h-10 rounded-lg text-sm" {...form.register(`emergencyContacts.${idx}.phone`)} />
                <Input placeholder={t('profileEdit.relationPlaceholder')} className="h-10 rounded-lg text-sm col-span-2" {...form.register(`emergencyContacts.${idx}.relation`)} />
              </div>
              {form.formState.errors.emergencyContacts?.[idx] && (
                <p className="text-xs text-red-500">{t('profileEdit.fillAllFields')}</p>
              )}
            </div>
          ))}
          {fields.length < 3 && (
            <Button type="button" variant="outline" className="w-full rounded-xl border-dashed h-10"
              onClick={() => append({ name: '', phone: '', relation: '' })}>
              <Plus className="w-4 h-4 mr-2" /> {t('profileEdit.addAnotherContact')}
            </Button>
          )}
        </div>

        <Button type="submit" disabled={isPending} className="w-full h-12 bg-primary hover:brightness-95 text-primary-foreground rounded-full font-bold">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> {t('profileEdit.saveChanges')}</>}
        </Button>
      </form>
    </div>
  )
}
