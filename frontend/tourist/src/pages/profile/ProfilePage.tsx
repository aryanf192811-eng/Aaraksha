// src/pages/profile/ProfilePage.tsx
// Profile: personal info, govt ID suffix, guardian link, emergency contacts
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Copy, ExternalLink, LogOut, User, Phone, Droplet, Lock, Eye, Siren, CheckCircle2, Pencil, ShieldCheck, Loader2, QrCode, Languages, FileLock2, HelpCircle, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { PageSkeleton, MessageThread } from '../../components/shared'
import { RescueReadinessChecklist } from '../../components/shared/RescueReadinessChecklist'
import { useAuthStore } from '../../store/auth.store'
import { useDMS } from '../../hooks/useDMS'
import { queryClient } from '../../lib/queryClient'
import touristApi from '../../api/tourist.api'
import tripApi from '../../api/trip.api'
import { getSocket } from '../../lib/socket'
import { SOCKET_EVENTS } from '../../constants/enums'
import { getErrorMessage } from '../../api/client'
import { cn } from '../../lib/utils'
import { SUPPORTED_LANGUAGES } from '../../i18n/config'
import { TRIP_STATUSES } from '../../constants/enums'
import type { EmergencyContact } from '../../types/api.types'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { tourist, logout } = useAuthStore()
  const [showGuardianLink, setShowGuardianLink] = useState(false)
  const [showGuardianChat, setShowGuardianChat] = useState(false)
  const [verifyingContact, setVerifyingContact] = useState<EmergencyContact | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [debugOtp, setDebugOtp] = useState<string | null>(null)

  const { data: profile } = useQuery({
    queryKey: ['tourists', 'me'],
    queryFn: () => touristApi.getMe().then(r => r.data.data),
    initialData: tourist || undefined,
  })

  // Same query key/shape as DashboardPage's Rescue Readiness widget so the
  // two screens share one cache entry and, more importantly, one number —
  // this used to read the narrower, backend-computed profile.rescue_readiness_score
  // (contact/medical-info completeness only) while the Dashboard showed a
  // richer 6-item client-side score (also checking DMS/TSI/offline), so the
  // same "Rescue Readiness" label could show two different percentages for
  // the same tourist depending which screen you were on.
  const { dms } = useDMS()
  const { data: tripsData } = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripApi.getMyTrips({ limit: 10 }).then(r => r.data),
    staleTime: 60_000,
  })
  const activeTrip = (tripsData?.data || []).find(t => t.status === TRIP_STATUSES.ACTIVE)

  const { mutate: sendContactOTP, isPending: sendingOTP } = useMutation({
    mutationFn: (phone: string) => touristApi.sendEmergencyContactOTP(phone),
    onSuccess: (res) => {
      setOtpSent(true)
      setDebugOtp(res.data.data.debugOtp ?? null)
      toast.success(res.data.data.message)
    },
    onError: () => toast.error(t('profile.toastOtpFailed')),
  })

  const { mutate: confirmContactOTP, isPending: confirmingOTP } = useMutation({
    mutationFn: () => touristApi.verifyEmergencyContactOTP(verifyingContact!.phone, otpCode.trim()),
    onSuccess: () => {
      toast.success(t('profile.toastContactVerified', { name: verifyingContact?.name }))
      queryClient.invalidateQueries({ queryKey: ['tourists', 'me'] })
      closeVerifyDialog()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || t('profile.toastOtpWrong')),
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
    toast.success(t('profile.toastLinkCopied'))
  }

  // Tourist <-> Guardian messaging — always available (not gated on an
  // active SOS), reused from the same MessageThread the rescue thread on
  // RescueTrackingCard.tsx uses.
  const { data: guardianMessages, isLoading: loadingGuardianMessages } = useQuery({
    queryKey: ['messages', 'guardian'],
    queryFn: () => touristApi.getGuardianMessages().then(r => r.data.data),
    enabled: showGuardianChat,
    staleTime: 5_000,
  })
  const { mutate: sendGuardianMessage, isPending: sendingGuardianMessage } = useMutation({
    mutationFn: (body: string) => touristApi.sendGuardianMessage(body),
    onSuccess: (res) => {
      queryClient.setQueryData(['messages', 'guardian'], (prev: typeof guardianMessages) => [...(prev ?? []), res.data.data])
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    // MESSAGE_RECEIVED fans out for both threads this tourist has (guardian
    // + any active rescue) -- only touch this query for a guardian-thread
    // message, or a reply arriving on the rescue thread would trigger a
    // pointless refetch here.
    const onMessage = (payload: { conversation_type: string }) => {
      if (payload.conversation_type === 'TOURIST_GUARDIAN') {
        queryClient.invalidateQueries({ queryKey: ['messages', 'guardian'] })
      }
    }
    socket.on(SOCKET_EVENTS.MESSAGE_RECEIVED, onMessage)
    return () => { socket.off(SOCKET_EVENTS.MESSAGE_RECEIVED, onMessage) }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
    toast.success(t('profile.toastLoggedOut'))
  }

  if (!profile) return <div className="min-h-screen bg-surface"><PageSkeleton /></div>

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6 text-on-surface" /></button>
          <h1 className="text-xl font-black text-on-surface flex-1">{t('profile.title')}</h1>
          <button onClick={() => navigate('/profile/edit')}
            className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
            <Pencil className="w-3.5 h-3.5" /> {t('common.edit')}
          </button>
        </div>
      </div>

      <div className="px-5 mt-5 space-y-4">
        {/* Avatar + name */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl">
            {profile.full_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-black text-on-surface">{profile.full_name}</h2>
            <p className="text-sm text-on-surface-variant">{profile.phone}</p>
            {profile.email && <p className="text-xs text-on-surface-variant">{profile.email}</p>}
          </div>
        </div>

        {/* Language */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            <span className="font-bold text-on-surface">{t('common.language')}</span>
          </div>
          <Select value={i18n.language} onValueChange={(v) => i18n.changeLanguage(v)}>
            <SelectTrigger className="w-36 h-10 rounded-xl bg-surface-container">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rescue readiness — same component and inputs as the Dashboard's,
            so this is the same number wherever a tourist sees it. */}
        <RescueReadinessChecklist tourist={profile} activeTrip={activeTrip} dms={dms} />

        {/* Health info */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-on-surface flex items-center gap-2">
            <Droplet className="w-4 h-4 text-sos" /> {t('profile.healthInformation')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-sos/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-sos-dark">{profile.blood_group || '—'}</p>
              <p className="text-xs text-sos-dark font-semibold mt-0.5">{t('profile.bloodGroup')}</p>
            </div>
            <div className="bg-surface-container rounded-xl p-3">
              <p className="text-xs text-on-surface-variant font-semibold mb-1">{t('profile.medicalInfo')}</p>
              <p className="text-sm text-on-surface">{profile.medical_info || t('profile.notSet')}</p>
            </div>
          </div>
        </div>

        {/* Govt ID */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-on-surface-variant" />
            <span className="font-bold text-on-surface">{t('profile.governmentId')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-surface-container-high text-on-surface-variant px-3 py-1.5 rounded-full font-semibold">{profile.govt_id_type}</span>
            <span className="text-on-surface font-mono font-bold">•••• •••• {profile.govt_id_suffix}</span>
            <span className="text-xs text-tsi-low ml-auto flex items-center gap-1 font-semibold">
              <Lock className="w-3 h-3" /> {t('profile.encrypted')}
            </span>
          </div>
        </div>

        {/* Emergency contacts */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-on-surface-variant" />
              <span className="font-bold text-on-surface">{t('profile.emergencyContacts')}</span>
            </div>
            <span className="text-xs text-on-surface-variant">{t('profile.contactsCount', { count: (profile.emergency_contacts || []).length })}</span>
          </div>
          <div className="space-y-2">
            {(profile.emergency_contacts || []).map((c, i) => (
              <div key={c.id || i} className="flex items-center gap-3 py-2 border-b border-outline-variant last:border-0">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white',
                  c.tier === 1 ? 'bg-tsi-low' : 'bg-primary'
                )}>T{c.tier}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-on-surface">{c.name}</p>
                  <p className="text-xs text-on-surface-variant">{c.relation} · {c.phone}</p>
                </div>
                {c.notifyOnSOS && (
                  <span className="text-xs text-sos-dark font-semibold flex items-center gap-0.5">
                    <Siren className="w-3 h-3" /> SOS
                  </span>
                )}
                {c.verified ? (
                  <span className="text-xs text-tsi-low font-semibold flex items-center gap-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> {t('profile.verified')}
                  </span>
                ) : (
                  <button onClick={() => openVerifyDialog(c)}
                    className="text-xs text-primary font-semibold underline flex-shrink-0">
                    {t('profile.verify')}
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
              <h3 className="font-bold text-on-surface">{t('profile.guardianLinkTitle')}</h3>
              <p className="text-xs text-on-surface-variant">{t('profile.guardianLinkSubtitle')}</p>
            </div>
          </div>
          <button onClick={() => setShowGuardianLink(v => !v)}
            className="text-xs text-primary font-semibold underline mb-2">
            {showGuardianLink ? t('profile.hideLink') : t('profile.showLink')}
          </button>
          {showGuardianLink && (
            <div className="bg-surface-container-lowest rounded-xl p-3 font-mono text-xs text-on-surface-variant break-all mb-2">
              {guardianUrl}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCopyGuardianLink}
              className="flex-1 bg-primary hover:brightness-95 text-on-surface rounded-full text-xs font-bold">
              <Copy className="w-3 h-3 mr-1" /> {t('profile.copyLink')}
            </Button>
            {typeof navigator.share === 'function' && (
              <Button size="sm" variant="outline"
                onClick={() => navigator.share({ title: 'Track my journey — Aaraksha', url: guardianUrl })}
                className="flex-1 rounded-full text-xs">
                <ExternalLink className="w-3 h-3 mr-1" /> {t('profile.shareLink')}
              </Button>
            )}
          </div>
          <p className="text-xs text-primary mt-2 mb-3">{t('profile.guardianLinkValidity')}</p>
          <button onClick={() => setShowGuardianChat(true)}
            className="w-full h-10 rounded-full bg-surface-container-lowest text-primary text-xs font-bold flex items-center justify-center gap-1.5 border border-primary/20">
            <MessageCircle className="w-3.5 h-3.5" /> Message your guardian
          </button>
        </div>

        {/* Digital Tourist ID */}
        <button onClick={() => navigate('/checkpoint-pass')}
          className="w-full bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex items-center gap-3 text-left hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-on-surface">{t('profile.digitalId')}</p>
            <p className="text-xs text-on-surface-variant">{t('profile.digitalIdDescription')}</p>
          </div>
        </button>

        {/* Privacy & Data Rights */}
        <button onClick={() => navigate('/profile/privacy')}
          className="w-full bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex items-center gap-3 text-left hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileLock2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-on-surface">{t('profile.privacyTitle')}</p>
            <p className="text-xs text-on-surface-variant">{t('profile.privacyDescription')}</p>
          </div>
        </button>

        {/* Help & FAQ */}
        <button onClick={() => navigate('/help')}
          className="w-full bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex items-center gap-3 text-left hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-on-surface">{t('profile.helpTitle')}</p>
            <p className="text-xs text-on-surface-variant">{t('profile.helpDescription')}</p>
          </div>
        </button>

        {/* Logout */}
        <Button variant="outline" onClick={handleLogout}
          className="w-full h-12 rounded-full border-sos/30 text-sos-dark hover:bg-sos/10 font-bold">
          <LogOut className="w-4 h-4 mr-2" /> {t('common.signOut')}
        </Button>

        <p className="text-center text-xs text-on-surface-variant pb-4 flex items-center justify-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> {t('profile.footer')}
        </p>
      </div>

      <Dialog open={showGuardianChat} onOpenChange={setShowGuardianChat}>
        <DialogContent className="p-0 gap-0 h-[70vh] max-h-[560px] flex flex-col overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-outline-variant flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="w-4.5 h-4.5 text-primary" /> Your guardian
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <MessageThread
              messages={guardianMessages}
              isLoading={loadingGuardianMessages}
              mine="TOURIST"
              onSend={sendGuardianMessage}
              sending={sendingGuardianMessage}
              emptyHint="No messages yet — send a quick update to reassure whoever's tracking your journey."
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!verifyingContact} onOpenChange={(open) => !open && closeVerifyDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.verifyDialogTitle', { name: verifyingContact?.name })}</DialogTitle>
            <DialogDescription>
              {otpSent
                ? t('profile.verifyDialogSentCode', { phone: verifyingContact?.phone })
                : t('profile.verifyDialogConfirm')}
            </DialogDescription>
          </DialogHeader>

          {!otpSent ? (
            <Button onClick={() => sendContactOTP(verifyingContact!.phone)} disabled={sendingOTP}
              className="w-full bg-primary hover:brightness-95 text-on-surface font-bold rounded-full">
              {sendingOTP ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {sendingOTP ? t('profile.sending') : t('profile.sendCode')}
            </Button>
          ) : (
            <>
              {debugOtp && (
                <p className="text-xs text-primary-dark bg-primary/10 border border-primary/25 rounded-lg px-3 py-2">
                  {t('profile.demoOtpNotice')} <span className="font-mono font-bold">{debugOtp}</span>
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
                  {confirmingOTP ? t('profile.verifying') : t('profile.verify')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
