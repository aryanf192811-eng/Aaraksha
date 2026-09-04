// src/pages/AuthPage.tsx
import { useState, type InputHTMLAttributes, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, LocateFixed, Phone, Lock, User, IdCard, MapPin, Navigation2, Radio, Award } from 'lucide-react'
import volunteerApi from '../api/volunteer.api'
import { useAuthStore } from '../store/auth.store'
import { cn } from '../lib/utils'

const GOVT_ID_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'DRIVING_LICENSE', label: "Driving Licence" },
] as const

// Icon-prefixed input — every field in this form uses it, so the pattern
// lives once here rather than repeated six times below.
function IconField({ icon: Icon, ...props }: { icon: ComponentType<{ className?: string }> } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon className="w-4.5 h-4.5 text-on-surface-variant absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input {...props}
        className="w-full h-12 rounded-xl border border-outline-variant bg-surface-container pl-11 pr-4 text-sm transition-colors focus:outline-none focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20" />
    </div>
  )
}

const WHY_VOLUNTEER = [
  { icon: Radio, text: 'Get alerted the moment someone nearby needs help' },
  { icon: Navigation2, text: 'Live road-routed navigation straight to them' },
  { icon: Award, text: 'Build a public reputation with every response' },
]

export default function AuthPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [tab, setTab] = useState<'login' | 'register'>('login')

  // Login state
  const [loginPhone, setLoginPhone] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [govtIdType, setGovtIdType] = useState<typeof GOVT_ID_TYPES[number]['value']>('AADHAAR')
  const [govtIdNumber, setGovtIdNumber] = useState('')
  const [district, setDistrict] = useState('')
  const [state, setState] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)

  const { mutate: login, isPending: loggingIn } = useMutation({
    mutationFn: () => volunteerApi.login({ phone: loginPhone, password: loginPassword }),
    onSuccess: (res) => {
      setAuth(res.data.data.token, res.data.data.volunteer)
      toast.success(`Welcome back, ${res.data.data.volunteer.full_name.split(' ')[0]}`)
      navigate('/')
    },
  })

  const { mutate: register, isPending: registering } = useMutation({
    mutationFn: () => volunteerApi.register({
      fullName, phone, password, govtIdType, govtIdNumber, district, state,
      latitude: coords?.lat, longitude: coords?.lng,
    }),
    onSuccess: (res) => {
      setAuth(res.data.data.token, res.data.data.volunteer)
      toast.success('Registered — your account is pending verification', { duration: 6000 })
      navigate('/')
    },
  })

  // Grabs GPS so the volunteer never has to type coordinates — same
  // no-manual-effort pattern the checkpoint scanner uses.
  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported on this device'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
        toast.success('Location captured')
      },
      () => { setLocating(false); toast.error('Could not get your location — you can still register without it') },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <div className={cn(
      'min-h-[100dvh] flex flex-col items-center px-5 font-sans',
      tab === 'login' ? 'hero-mesh justify-center py-10' : 'bg-surface pt-[max(2.5rem,env(safe-area-inset-top))] pb-10'
    )}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <ShieldCheck className="w-6.5 h-6.5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display font-black text-on-surface leading-tight text-lg">Aaraksha Rescuer</p>
            <p className="text-xs text-on-surface-variant leading-tight">Verified local emergency response</p>
          </div>
        </div>

        <div className="flex bg-surface-container-high rounded-full p-1 mb-6">
          <button onClick={() => setTab('login')}
            className={cn('flex-1 h-9 rounded-full text-sm font-semibold transition-colors', tab === 'login' ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}>
            Log In
          </button>
          <button onClick={() => setTab('register')}
            className={cn('flex-1 h-9 rounded-full text-sm font-semibold transition-colors', tab === 'register' ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}>
            Register
          </button>
        </div>

        {tab === 'login' ? (
          <>
            <form onSubmit={(e) => { e.preventDefault(); login() }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">Phone Number</label>
                <IconField icon={Phone} value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} placeholder="9876543210" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">Password</label>
                <IconField icon={Lock} type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              </div>
              <button type="submit" disabled={loggingIn}
                className="w-full h-12 bg-primary text-primary-foreground rounded-full font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                {loggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log In'}
              </button>
            </form>

            <div className="mt-10 space-y-3.5">
              {WHY_VOLUNTEER.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm text-on-surface-variant leading-snug">{text}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); register() }} className="space-y-4">
            <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/15 rounded-xl p-3 mb-1">
              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-on-surface-variant leading-relaxed">
                This is an <strong className="text-on-surface">application</strong>, not an instant account — a district
                officer reviews and verifies every responder before you can be alerted to nearby emergencies.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface">Full Name</label>
              <IconField icon={User} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface">Phone Number</label>
              <IconField icon={Phone} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface">Password</label>
              <IconField icon={Lock} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">Govt ID Type</label>
                <select value={govtIdType} onChange={(e) => setGovtIdType(e.target.value as typeof govtIdType)}
                  className="w-full h-12 rounded-xl border border-outline-variant bg-surface-container px-3 text-sm transition-colors focus:outline-none focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20">
                  {GOVT_ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">ID Number</label>
                <IconField icon={IdCard} value={govtIdNumber} onChange={(e) => setGovtIdNumber(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">District</label>
                <IconField icon={MapPin} value={district} onChange={(e) => setDistrict(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">State</label>
                <IconField icon={MapPin} value={state} onChange={(e) => setState(e.target.value)} />
              </div>
            </div>

            <button type="button" onClick={detectLocation} disabled={locating}
              className={cn('w-full h-11 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-semibold transition-colors',
                coords ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant text-on-surface-variant')}>
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              {coords ? 'Location captured' : 'Use my current location'}
            </button>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Your government ID is hashed and never stored as plain text.
            </p>

            <button type="submit" disabled={registering}
              className="w-full h-12 bg-primary text-primary-foreground rounded-full font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
              {registering ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Register'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
