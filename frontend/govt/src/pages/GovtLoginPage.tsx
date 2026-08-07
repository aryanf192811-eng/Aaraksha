// src/pages/GovtLoginPage.tsx
// Design: Stitch "Command Center Secure Login" — split screen, dark emerald
// authority panel + white auth form. Logic unchanged: same schema, same
// submit handler, same auth store call.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Shield, Loader2, Eye, EyeOff, Mail, Lock, Landmark, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import authApi from '../api/auth.api'
import { getErrorMessage } from '../api/client'
import { useAuthStore } from '../store/auth.store'

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type LoginForm = z.infer<typeof LoginSchema>

export default function GovtLoginPage() {
  const navigate = useNavigate()
  const setGovtAuth = useAuthStore(s => s.setGovtAuth)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setSubmitting(true)
    try {
      const res = await authApi.loginGovt(data)
      const { token, user } = res.data.data
      setGovtAuth(token, user)
      toast.success(`Welcome back, ${user.name}`)
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-white">
      {/* ── Left Panel: Brand & Authority ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-dark relative flex-col justify-between p-10 overflow-hidden border-r border-emerald-900">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10 flex items-center gap-3">
          <ShieldAlert className="w-9 h-9 text-white" />
          <span className="font-display text-2xl font-black text-white tracking-tight">AARAKSHA</span>
        </div>

        <div className="relative z-10 flex flex-col gap-6 max-w-lg">
          <div className="flex gap-6 text-emerald-200 mb-2">
            <Landmark className="w-8 h-8" />
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="font-display text-5xl font-black text-white leading-[1.05]">
            RESTRICTED<br />ACCESS
          </h1>
          <p className="text-base text-emerald-100/90 leading-relaxed">
            Official Government Portal. Unauthorized access is strictly prohibited and subject
            to legal action under national security protocols.
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/20 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-sos animate-pulse" />
              <span className="text-xs font-bold text-white tracking-wider uppercase">Command Center Active</span>
            </span>
          </div>
        </div>

        <div className="relative z-10 font-mono text-xs text-emerald-200/50">
          SYSTEM ID: AUTH-4992-SEC<br />
          NODE: OMEGA-7
        </div>
      </div>

      {/* ── Right Panel: Authentication ───────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between bg-white relative">
        <div className="flex-grow flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-md space-y-8">
            <div className="lg:hidden flex flex-col items-center gap-3 mb-8">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="font-display text-xl font-black text-on-surface text-center">AARAKSHA<br />COMMAND CENTER</h1>
            </div>

            <div className="text-center lg:text-left space-y-1.5">
              <h2 className="font-display text-2xl font-bold text-on-surface">Command Center Authentication</h2>
              <p className="text-sm text-on-surface-variant">Please sign in with your official government credentials.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-6">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Official Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                  <Input id="email" type="email" autoComplete="email" placeholder="name@gov.in"
                    className="h-11 pl-10 bg-surface-container-low border-outline-variant focus-visible:ring-primary"
                    {...register('email')} />
                </div>
                {errors.email && <p className="text-sos text-xs">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Security Key</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                  <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                    className="h-11 pl-10 pr-10 bg-surface-container-low border-outline-variant focus-visible:ring-primary"
                    {...register('password')} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sos text-xs">{errors.password.message}</p>}
              </div>

              <Button type="submit" disabled={submitting}
                className="w-full h-12 bg-primary hover:bg-primary-dark text-primary-foreground font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Authenticate &amp; Enter</>}
              </Button>
            </form>

            <div className="flex items-center justify-center gap-2 text-outline pt-2">
              <Lock className="w-3.5 h-3.5" />
              <span className="font-mono text-xs text-on-surface-variant">Level 4 SSL Encryption Active</span>
            </div>
          </div>
        </div>

        <footer className="flex flex-col md:flex-row justify-between items-center gap-2 px-6 py-4 bg-surface border-t border-outline-variant">
          <div className="text-xs font-bold text-primary flex items-center gap-2">
            <Shield className="w-4 h-4" /> AARAKSHA
          </div>
          <div className="text-xs text-on-surface-variant text-center">
            © 2025 AARAKSHA COMMAND CENTER · RESTRICTED ACCESS SYSTEM
          </div>
        </footer>
      </div>
    </div>
  )
}
