// src/pages/auth/AuthPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Shield, Lock, Satellite, ShieldCheck } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { LoginForm } from './components/LoginForm'
import { RegisterForm } from './components/RegisterForm'
import { useAuthStore } from '../../store/auth.store'

const TRUST_BADGES = [
  { Icon: Lock,        label: 'Govt ID\nVerified' },
  { Icon: Satellite,   label: 'Offline\nCapable' },
  { Icon: ShieldCheck, label: 'SOS\nReady' },
]

export default function AuthPage() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') === 'register' ? 'register' : 'login')
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-10 font-sans relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-surface to-surface" />

      {/* Brand */}
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <Shield className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <p className="font-display text-xl font-black text-on-surface">Aaraksha</p>
          <p className="text-xs text-on-surface-variant">Smart Tourism · Safe Journey</p>
        </div>
      </Link>

      {/* Auth card */}
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden">
        <div className="p-8">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 w-full rounded-full bg-surface-container p-1 mb-8">
              <TabsTrigger value="login" className="rounded-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                Log In
              </TabsTrigger>
              <TabsTrigger value="register" className="rounded-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                Register
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <LoginForm onSwitch={() => setTab('register')} />
            </TabsContent>

            <TabsContent value="register">
              <RegisterForm onSwitch={() => setTab('login')} />
            </TabsContent>
          </Tabs>

          {/* Trust badges */}
          <div className="mt-6 pt-6 border-t border-outline-variant/40 grid grid-cols-3 gap-3">
            {TRUST_BADGES.map(({ Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-1.5">
                <Icon className="w-4 h-4 text-on-surface-variant" />
                <p className="text-xs text-on-surface-variant whitespace-pre-line leading-relaxed font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-on-surface-variant text-center max-w-xs">
        Your government ID is stored as an encrypted hash. We never store the actual number.
      </p>
    </div>
  )
}
