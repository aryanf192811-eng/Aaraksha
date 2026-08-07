// src/pages/auth/components/LoginForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate, Link } from 'react-router-dom'
import { Phone, Lock, Loader2 } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import authApi from '../../../api/auth.api'
import { useAuthStore } from '../../../store/auth.store'

// Client-side validation is intentionally loose (length only) — the backend's
// PhoneSchema does the real format check via normalizePhone() and is the
// source of truth; this just catches obviously-empty/short input early.
const LoginSchema = z.object({
  phone:    z.string().min(10, 'Enter a valid 10-digit phone number').max(15),
  password: z.string().min(1, 'Password is required'),
})
type LoginFormValues = z.infer<typeof LoginSchema>

export function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
  })

  const { mutate: login, isPending } = useMutation({
    mutationFn: (data: LoginFormValues) => authApi.login(data),
    onSuccess: (res) => {
      setAuth(res.data.data.token, res.data.data.tourist)
      toast.success(`Welcome back, ${res.data.data.tourist.full_name.split(' ')[0]}!`)
      navigate('/dashboard')
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => login(d))} className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-on-surface mb-1">Welcome back</h2>
        <p className="text-sm text-on-surface-variant">Log in to continue your safe journey</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-sm font-semibold text-on-surface">Phone Number</Label>
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <Input
            id="phone" type="tel" placeholder="9876543210"
            className="pl-10 h-12 rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20"
            {...register('phone')}
          />
        </div>
        {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-sm font-semibold text-on-surface">Password</Label>
          <Link to="/auth/forgot-password" className="text-xs text-primary hover:brightness-90 font-medium">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <Input
            id="password" type="password" placeholder="Enter your password"
            className="pl-10 h-12 rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20"
            {...register('password')}
          />
        </div>
        {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
      </div>

      <Button type="submit" disabled={isPending}
        className="w-full h-12 bg-on-surface hover:bg-on-surface/90 text-surface rounded-full font-bold text-base">
        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log In'}
      </Button>

      <p className="text-center text-sm text-on-surface-variant">
        Don't have an account?{' '}
        <button type="button" onClick={onSwitch} className="text-primary font-semibold hover:underline">
          Register here
        </button>
      </p>
    </form>
  )
}
