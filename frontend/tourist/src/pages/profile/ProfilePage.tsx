// src/pages/profile/ProfilePage.tsx
// Profile: personal info, govt ID suffix, guardian link, emergency contacts
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Copy, ExternalLink, Shield, LogOut, User, Phone, Droplet, Lock, Eye, Siren, CheckCircle2, Pencil, ShieldCheck, Loader2, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog'
import { PageSkeleton } from '../../components/shared'
import { useAuthStore } from '../../store/auth.store'
import { queryClient } from '../../lib/queryClient'
import touristApi from '../../api/tourist.api'
import { cn } from '../../lib/utils'
import type { EmergencyContact } from '../../types/api.types'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { tourist, logout } = useAuthStore()
  const [showGuardianLink, setShowGuardianLink] = useState(false)
  const [verifyingContact, setVerifyingContact] = useState<EmergencyContact | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [debugOtp, setDebugOtp] = useState<string | null>(null)

  const { data: profile } = useQuery({
    queryKey: ['tourists', 'me'],
    queryFn: () => touristApi.getMe().then(r => r.data.data),
    initialData: tourist || undefined,
  })

  const { mutate: sendContactOTP, isPending: sendingOTP } = useMutation({
    mutationFn: (phone: string) => touristApi.sendEmergencyContactOTP(phone),
    onSuccess: (res) => {
      setOtpSent(true)
      setDebugOtp(res.data.data.debugOtp ?? null)
      toast.success(res.data.data.message)
    },
    onError: () => toast.error('Could not send verification code'),
  })

  const { mutate: confirmContactOTP, isPending: confirmingOTP } = useMutation({
    mutationFn: () => touristApi.verifyEmergencyContactOTP(verifyingContact!.phone, otpCode.trim()),
    onSuccess: () => {
      toast.success(`${verifyingContact?.name} verified!`)
      queryClient.invalidateQueries({ queryKey: ['tourists', 'me'] })
      closeVerifyDialog()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Incorrect or expired code'),
  })

  const openVerifyDialog = (contact: EmergencyContact) => {
    setVerifyingContact(contact)
    setOtpSent(false)
    setOtpCode('')
    setDebugOtp(null)
  }
  const closeVerifyDialog = () => {
    setVerifyingContact(null)
    setOtpSent(false)
    setOtpCode('')
    setDebugOtp(null)
  }

  // Deriving this from window.location.origin by string-replacing the port
  // only worked for plain localhost dev — through a tunnel (or any deployed
  // origin) there's no ":5173" in the origin to replace, so the guardian
  // link silently pointed back at the tourist app's own domain with a
  // /track path it doesn't have. Explicit env var, same pattern already
  // used for the govt portal link on the landing page.
  const GUARDIAN_PORTAL_URL = import.meta.env.VITE_GUARDIAN_PORTAL_URL || 'http://localhost:5175'
  const guardianUrl = `${GUARDIAN_PORTAL_URL}/track/${profile?.guardian_token}`

  const handleCopyGuardianLink = async () => {
    await navigator.clipboard.writeText(guardianUrl)
    toast.success('Guardian tracking link copied! Share with family.')
  }

  const handleLogout = () => {
    logout()
    navigate('/')
    toast.success('Logged out successfully')
  }

  if (!profile) return <div className="min-h-screen bg-surface"><PageSkeleton /></div>

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6 text-on-surface" /></button>
          <h1 className="text-xl font-black text-on-surface flex-1">Profile</h1>
          <button onClick={() => navigate('/profile/edit')}
            className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      </div>

      <div className="px-5 mt-5 space-y-4">
        {/* Avatar + name */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-2xl shadow-lg">
            {profile.full_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-black text-on-surface">{profile.full_name}</h2>
            <p className="text-sm text-on-surface-variant">{profile.phone}</p>
            {profile.email && <p className="text-xs text-on-surface-variant">{profile.email}</p>}
          </div>
        </div>

        {/* Rescue readiness */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-bold text-on-surface">Rescue Readiness</span>
            </div>
            <span className={cn('font-black text-lg',
              profile.rescue_readiness_score >= 80 ? 'text-green-600' :
              profile.rescue_readiness_score >= 50 ? 'text-primary' : 'text-red-600'
            )}>{profile.rescue_readiness_score}%</span>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-3">
            <div className={cn('h-3 rounded-full transition-all duration-700',
              profile.rescue_readiness_score >= 80 ? 'bg-green-500' :
              profile.rescue_readiness_score >= 50 ? 'bg-primary' : 'bg-red-500'
            )} style={{ width: `${profile.rescue_readiness_score}%` }} />
          </div>
          <p className="text-xs text-on-surface-variant mt-2">
            {profile.rescue_readiness_score < 100 ? 'Add blood group and emergency contacts to improve your rescue readiness.' : 'All safety info complete!'}
          </p>
        </div>

        {/* Health info */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-on-surface flex items-center gap-2">
            <Droplet className="w-4 h-4 text-red-500" /> Health Information
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-red-600">{profile.blood_group || '—'}</p>
              <p className="text-xs text-red-600 font-semibold mt-0.5">Blood Group</p>
            </div>
            <div className="bg-surface-container rounded-xl p-3">
              <p className="text-xs text-on-surface-variant font-semibold mb-1">Medical Info</p>
              <p className="text-sm text-on-surface">{profile.medical_info || 'Not set'}</p>
            </div>
          </div>
        </div>

        {/* Govt ID */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-on-surface-variant" />
            <span className="font-bold text-on-surface">Government ID</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-surface-container-high text-on-surface-variant px-3 py-1.5 rounded-full font-semibold">{profile.govt_id_type}</span>
            <span className="text-on-surface font-mono font-bold">•••• •••• {profile.govt_id_suffix}</span>
            <span className="text-xs text-green-600 ml-auto flex items-center gap-1 font-semibold">
              <Lock className="w-3 h-3" /> Encrypted
            </span>
          </div>
        </div>

        {/* Emergency contacts */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-on-surface-variant" />
              <span className="font-bold text-on-surface">Emergency Contacts</span>
            </div>
            <span className="text-xs text-on-surface-variant">{(profile.emergency_contacts || []).length} contacts</span>
          </div>
          <div className="space-y-2">
            {(profile.emergency_contacts || []).map((c, i) => (
              <div key={c.id || i} className="flex items-center gap-3 py-2 border-b border-outline-variant last:border-0">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white',
                  c.tier === 1 ? 'bg-green-500' : 'bg-primary'
                )}>T{c.tier}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-on-surface">{c.name}</p>
                  <p className="text-xs text-on-surface-variant">{c.relation} · {c.phone}</p>
                </div>
                {c.notifyOnSOS && (
                  <span className="text-xs text-green-600 font-semibold flex items-center gap-0.5">
                    <Siren className="w-3 h-3" /> SOS
                  </span>
                )}
                {c.verified ? (
                  <span className="text-xs text-green-600 font-semibold flex items-center gap-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <button onClick={() => openVerifyDialog(c)}
                    className="text-xs text-primary font-semibold underline flex-shrink-0">
                    Verify
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Guardian Portal Link */}
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-on-surface">Guardian Tracking Link</h3>
              <p className="text-xs text-on-surface-variant">Share with family to track your journey</p>
            </div>
          </div>
          <button onClick={() => setShowGuardianLink(v => !v)}
            className="text-xs text-primary font-semibold underline mb-2">
            {showGuardianLink ? 'Hide link' : 'Show link'}
          </button>
          {showGuardianLink && (
            <div className="bg-surface-container-lowest rounded-xl p-3 font-mono text-xs text-on-surface-variant break-all mb-2">
              {guardianUrl}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCopyGuardianLink}
              className="flex-1 bg-primary hover:brightness-95 text-on-surface rounded-full text-xs font-bold">
              <Copy className="w-3 h-3 mr-1" /> Copy Link
            </Button>
            {typeof navigator.share === 'function' && (
              <Button size="sm" variant="outline"
                onClick={() => navigator.share({ title: 'Track my journey — Aaraksha', url: guardianUrl })}
                className="flex-1 rounded-full text-xs">
                <ExternalLink className="w-3 h-3 mr-1" /> Share
              </Button>
            )}
          </div>
          <p className="text-xs text-primary mt-2">Valid for 90 days · Renews automatically</p>
        </div>

        {/* Digital Tourist ID */}
        <button onClick={() => navigate('/checkpoint-pass')}
          className="w-full bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex items-center gap-3 text-left hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-on-surface">Digital Tourist ID</p>
            <p className="text-xs text-on-surface-variant">Show your verified ID at govt checkpoints and ILP posts</p>
          </div>
        </button>

        {/* Logout */}
        <Button variant="outline" onClick={handleLogout}
          className="w-full h-12 rounded-full border-red-200 text-red-600 hover:bg-red-50 font-bold">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>

        <p className="text-center text-xs text-on-surface-variant pb-4 flex items-center justify-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Aaraksha v1.0.0 · SIH 2025 · Smart Tourism · Safe Journey
        </p>
      </div>

      <Dialog open={!!verifyingContact} onOpenChange={(open) => !open && closeVerifyDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify {verifyingContact?.name}</DialogTitle>
            <DialogDescription>
              {otpSent
                ? `Enter the 6-digit code sent to ${verifyingContact?.phone}.`
                : `Confirm this is a real, reachable number before it's relied on during an SOS.`}
            </DialogDescription>
          </DialogHeader>

          {!otpSent ? (
            <Button onClick={() => sendContactOTP(verifyingContact!.phone)} disabled={sendingOTP}
              className="w-full bg-primary hover:brightness-95 text-on-surface font-bold rounded-full">
              {sendingOTP ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {sendingOTP ? 'Sending...' : 'Send Code'}
            </Button>
          ) : (
            <>
              {debugOtp && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Demo mode — SMS delivery is unavailable on this Twilio trial account. Code: <span className="font-mono font-bold">{debugOtp}</span>
                </p>
              )}
              <Input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="text-center text-lg font-mono font-bold tracking-widest"
                autoFocus
              />
              <DialogFooter>
                <Button onClick={() => confirmContactOTP()} disabled={confirmingOTP || otpCode.length !== 6}
                  className="bg-primary hover:brightness-95 text-on-surface font-bold rounded-full">
                  {confirmingOTP ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {confirmingOTP ? 'Verifying...' : 'Verify'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
