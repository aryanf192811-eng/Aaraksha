// src/pages/AuthPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, LocateFixed } from 'lucide-react'
import volunteerApi from '../api/volunteer.api'
import { useAuthStore } from '../store/auth.store'
import { cn } from '../lib/utils'

const GOVT_ID_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'DRIVING_LICENSE', label: "Driving Licence" },
] as const

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
    <div className="min-h-screen bg-surface flex flex-col items-center px-5 pt-14 pb-10 font-sans">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5.5 h-5.5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display font-black text-on-surface leading-tight">Aaraksha</p>
            <p className="text-xs text-on-surface-variant leading-tight">Rescuer</p>
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
          <form onSubmit={(e) => { e.preventDefault(); login() }} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface">Phone Number</label>
              <input value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} placeholder="9876543210"
                className="w-full h-12 rounded-xl border border-outline-variant px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface">Password</label>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full h-12 rounded-xl border border-outline-variant px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <button type="submit" disabled={loggingIn}
              className="w-full h-12 bg-primary text-primary-foreground rounded-full font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
              {loggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log In'}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); register() }} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface">Full Name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full h-12 rounded-xl border border-outline-variant px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface">Phone Number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile"
                className="w-full h-12 rounded-xl border border-outline-variant px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 rounded-xl border border-outline-variant px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">Govt ID Type</label>
                <select value={govtIdType} onChange={(e) => setGovtIdType(e.target.value as typeof govtIdType)}
                  className="w-full h-12 rounded-xl border border-outline-variant px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                  {GOVT_ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">ID Number</label>
                <input value={govtIdNumber} onChange={(e) => setGovtIdNumber(e.target.value)}
                  className="w-full h-12 rounded-xl border border-outline-variant px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">District</label>
                <input value={district} onChange={(e) => setDistrict(e.target.value)}
                  className="w-full h-12 rounded-xl border border-outline-variant px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">State</label>
                <input value={state} onChange={(e) => setState(e.target.value)}
                  className="w-full h-12 rounded-xl border border-outline-variant px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
            </div>

            <button type="button" onClick={detectLocation} disabled={locating}
              className={cn('w-full h-11 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-semibold transition-colors',
                coords ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant text-on-surface-variant')}>
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              {coords ? 'Location captured' : 'Use my current location'}
            </button>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Your government ID is hashed, never stored as plain text. A district officer verifies your account before you can be alerted to nearby emergencies.
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
