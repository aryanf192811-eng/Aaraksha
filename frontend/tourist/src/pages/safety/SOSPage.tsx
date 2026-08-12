// src/pages/safety/SOSPage.tsx
// Design: Stitch "Safety Center" — status row, big pulsing SOS button,
// icon-circle category grid, DMS card. Logic unchanged from the previous
// version: same category/DMS state, same hooks, same mutations.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft, MapPin, Battery, Loader2, Timer, CheckCircle2, Wifi, WifiOff,
  HeartPulse, Compass, Mountain, Waves, ShieldAlert, HelpCircle, PowerOff, Smartphone, Bell,
} from 'lucide-react'
import { toast } from 'sonner'
import { SOSButton } from '../../components/shared/SOSButton'
import { RescueTrackingCard } from '../../components/shared/RescueTrackingCard'
import { useSOS } from '../../hooks/useSOS'
import { useBattery } from '../../hooks/useBattery'
import { useDMS } from '../../hooks/useDMS'
import { requestPanicGesturePermission } from '../../hooks/usePanicGesture'
import { usePushNotifications, isPushSupported } from '../../hooks/usePushNotifications'
import dmsApi from '../../api/dms.api'
import { queryClient } from '../../lib/queryClient'
import { useSafetyStore } from '../../store/safety.store'
import type { SOSCategory } from '../../constants/enums'
import { cn } from '../../lib/utils'

const CATEGORY_CONFIG = [
  { value: 'MEDICAL',  Icon: HeartPulse,  label: 'Medical',  color: 'bg-sos-light text-sos-dark' },
  { value: 'LOST',     Icon: Compass,     label: 'Lost',     color: 'bg-amber-100 text-amber-700' },
  { value: 'TRAPPED',  Icon: Mountain,    label: 'Trapped',  color: 'bg-orange-100 text-orange-700' },
  { value: 'DISASTER', Icon: Waves,       label: 'Disaster', color: 'bg-blue-100 text-blue-700' },
  { value: 'CRIME',    Icon: ShieldAlert, label: 'Crime',    color: 'bg-purple-100 text-purple-700' },
  { value: 'OTHER',    Icon: HelpCircle,  label: 'Other',    color: 'bg-surface-container-high text-on-surface-variant' },
] as const

const DMS_INTERVALS = [
  { label: '30 min', value: 30 }, { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 }, { label: '3 hours', value: 180 },
]
// Judge-demo-only quick pick — bypasses the real 15-480 min minimum via the
// backend's separate demoSeconds path (see dms.validator.js) so the
// auto-SOS mechanism can be shown live without a real wait.
const DMS_DEMO_SECONDS = 20

export default function SOSPage() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<SOSCategory>('OTHER')
  const [message, setMessage] = useState('')
  const [showDMSSetup, setShowDMSSetup] = useState(false)
  const [dmsInterval, setDmsInterval] = useState<number | 'demo'>(60)
  const [confirmingDisable, setConfirmingDisable] = useState(false)
  const { sendSOS, sending } = useSOS()
  const { batteryPct } = useBattery()
  const { dms, disableDMS, disabling } = useDMS()
  const panicGestureEnabled = useSafetyStore((s) => s.panicGestureEnabled)
  const setPanicGestureEnabled = useSafetyStore((s) => s.setPanicGestureEnabled)
  const [requestingPermission, setRequestingPermission] = useState(false)
  const { subscribe: subscribePush, unsubscribe: unsubscribePush, subscribing: subscribingPush } = usePushNotifications()
  const [pushEnabled, setPushEnabled] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    navigator.serviceWorker.getRegistration('/push/')
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setPushEnabled(!!sub))
      .catch(() => {})
  }, [])

  const { mutate: createDMS, isPending: creatingDMS } = useMutation({
    mutationFn: () => dmsInterval === 'demo'
      ? dmsApi.createDMS({ demoSeconds: DMS_DEMO_SECONDS })
      : dmsApi.createDMS({ intervalMinutes: dmsInterval }),
    onSuccess: () => {
      toast.success(dmsInterval === 'demo'
        ? `Dead Man's Switch activated — demo mode, ${DMS_DEMO_SECONDS}s`
        : `Dead Man's Switch activated — check in every ${dmsInterval} min`)
      queryClient.invalidateQueries({ queryKey: ['dms', 'active'] })
      setShowDMSSetup(false)
    },
  })

  const handleSOS = async () => {
    await sendSOS(category, message || undefined)
  }

  const handleTogglePanicGesture = async () => {
    if (panicGestureEnabled) {
      setPanicGestureEnabled(false)
      toast('Panic shake gesture disabled')
      return
    }
    setRequestingPermission(true)
    const granted = await requestPanicGesturePermission()
    setRequestingPermission(false)
    if (granted) {
      setPanicGestureEnabled(true)
      toast.success('Panic shake gesture enabled — shake your phone hard 3x to trigger SOS')
    } else {
      toast.error('Motion access denied — enable it in your browser/device settings to use this')
    }
  }

  const handleTogglePush = async () => {
    if (pushEnabled) {
      await unsubscribePush()
      setPushEnabled(false)
      toast('Push notifications disabled')
      return
    }
    const ok = await subscribePush()
    setPushEnabled(ok)
    if (ok) toast.success('Push notifications enabled — you\'ll get alerts even when the app is closed')
    else toast.error('Could not enable push notifications — check browser notification permissions')
  }

  // pb-40, not the usual pb-24 — this page's last section (DMS setup)
  // expands in place when the interval picker opens, and pb-24 wasn't
  // enough clearance to keep the Activate button from landing under the
  // fixed bottom nav and becoming unclickable.
  return (
    <div className="min-h-screen bg-surface pb-40 font-sans">
      {/* TopAppBar */}
      <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-md px-5 pt-12 pb-3 flex items-center justify-between border-b border-outline-variant/50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6 text-on-surface" />
          </button>
          <div>
            <h1 className="font-display text-xl font-black text-on-surface">Safety Center</h1>
            <p className="text-xs text-on-surface-variant">SOS · Dead Man's Switch</p>
          </div>
        </div>
        {navigator.onLine ? <Wifi className="w-5 h-5 text-tsi-low" /> : <WifiOff className="w-5 h-5 text-sos" />}
      </header>

      <div className="px-5 mt-5 space-y-5">
        {/* Status row */}
        <div className="flex gap-2">
          <div className="flex-1 bg-surface-container-lowest shadow-sm border border-outline-variant rounded-lg px-3 py-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-tsi-low flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-on-surface-variant">GPS Sync</span>
              <span className="font-mono text-xs font-bold text-on-surface">Active</span>
            </div>
          </div>
          <div className="flex-1 bg-surface-container-lowest shadow-sm border border-outline-variant rounded-lg px-3 py-2 flex items-center gap-2">
            <Battery className="w-4 h-4 text-tsi-low flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-on-surface-variant">Power</span>
              <span className="font-mono text-xs font-bold text-on-surface">{batteryPct ?? '—'}%</span>
            </div>
          </div>
        </div>

        <RescueTrackingCard />

        {/* Big SOS Section */}
        <div className="flex flex-col items-center gap-5 py-4">
          <SOSButton onTrigger={handleSOS} loading={sending} size="default" />
          <p className="text-center text-xs text-on-surface-variant max-w-[260px]">
            Activating SOS shares your live location with emergency services and emergency contacts.
          </p>
        </div>

        {/* Category selector */}
        <div>
          <p className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wide mb-3 px-0.5">Specific Emergency</p>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_CONFIG.map(({ value, Icon, label, color }) => (
              <button key={value} type="button"
                onClick={() => setCategory(value)}
                className={cn(
                  'bg-surface-container-lowest shadow-sm border rounded-xl p-3 flex flex-col items-center gap-2 transition-all',
                  category === value ? 'border-primary ring-2 ring-primary/30 -translate-y-0.5 shadow-md' : 'border-outline-variant'
                )}>
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center', color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-on-surface">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Optional message */}
        <textarea
          placeholder="Additional details (optional)..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface"
        />

        {/* DMS Section */}
        <div className="bg-surface-container-lowest shadow-sm border border-outline-variant rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <Timer className="w-6 h-6 text-primary" />
            <div>
              <h2 className="font-display font-black text-on-surface">Dead Man's Switch</h2>
              <p className="text-xs text-on-surface-variant">Auto-SOS if you stop checking in</p>
            </div>
          </div>

          {dms && dms.status === 'TRIGGERED' ? (
            <div className="space-y-2">
              <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-center">
                <p className="font-bold text-red-700">Missed check-in — auto-SOS was sent</p>
                <p className="text-xs text-red-600/80 mt-1">Dismiss to re-arm a new switch</p>
              </div>
              <button
                onClick={() => disableDMS(dms.id)}
                disabled={disabling}
                className="w-full rounded-full h-11 text-sm font-bold border-2 border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                {disabling ? 'Dismissing...' : 'Dismiss'}
              </button>
            </div>
          ) : dms && dms.status === 'ACTIVE' ? (
            <div className="space-y-2">
              <div className="bg-tsi-low/10 border border-tsi-low/30 rounded-xl p-4 text-center">
                <p className="flex items-center justify-center gap-1.5 font-bold text-tsi-low">
                  <CheckCircle2 className="w-4 h-4" /> Active — Check-in every {dms.interval_minutes} min
                </p>
                <p className="text-xs text-tsi-low/80 mt-1">Tap "Check In" from the bottom nav to reset</p>
              </div>

              {confirmingDisable ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { disableDMS(dms.id); setConfirmingDisable(false) }}
                    disabled={disabling}
                    className="flex-1 rounded-full h-10 text-xs font-bold border-2 border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    {disabling ? 'Disabling...' : 'Confirm disable'}
                  </button>
                  <button
                    onClick={() => setConfirmingDisable(false)}
                    className="flex-1 rounded-full h-10 text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDisable(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-red-600 py-2 transition-colors"
                >
                  <PowerOff className="w-3.5 h-3.5" /> Disable Dead Man's Switch
                </button>
              )}
            </div>
          ) : (
            <>
              {!showDMSSetup ? (
                <button onClick={() => setShowDMSSetup(true)}
                  className="w-full bg-primary hover:brightness-95 text-primary-foreground font-bold rounded-full h-12 transition-all active:scale-95">
                  Activate Dead Man's Switch
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-on-surface-variant">Check-in interval:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {DMS_INTERVALS.map(({ label, value }) => (
                      <button key={value} type="button" onClick={() => setDmsInterval(value)}
                        className={cn('rounded-xl border-2 py-2 text-center text-xs font-bold transition-all',
                          dmsInterval === value ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant'
                        )}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setDmsInterval('demo')}
                    className={cn('w-full rounded-xl border-2 border-dashed py-2 text-center text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                      dmsInterval === 'demo' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant'
                    )}>
                    <Timer className="w-3.5 h-3.5" /> {DMS_DEMO_SECONDS} sec (Demo for judges)
                  </button>
                  <button onClick={() => createDMS()} disabled={creatingDMS}
                    className="w-full bg-on-surface text-surface font-bold rounded-full h-12 flex items-center justify-center active:scale-95 transition-all">
                    {creatingDMS
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : dmsInterval === 'demo' ? `Activate — ${DMS_DEMO_SECONDS}s demo` : `Activate — ${dmsInterval} min intervals`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Panic gesture Section */}
        <div className="bg-surface-container-lowest shadow-sm border border-outline-variant rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Smartphone className="w-6 h-6 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="font-display font-black text-on-surface">Panic Shake Gesture</h2>
                <p className="text-xs text-on-surface-variant">Shake your phone hard 3x to trigger SOS — for when it's in your pocket</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={panicGestureEnabled}
              onClick={handleTogglePanicGesture}
              disabled={requestingPermission}
              className={cn(
                'relative flex-shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-60',
                panicGestureEnabled ? 'bg-primary' : 'bg-outline-variant'
              )}
            >
              <span className={cn(
                'absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform',
                panicGestureEnabled && 'translate-x-5'
              )} />
            </button>
          </div>
        </div>

        {/* Push notifications Section */}
        {isPushSupported() && (
          <div className="bg-surface-container-lowest shadow-sm border border-outline-variant rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Bell className="w-6 h-6 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-display font-black text-on-surface">Push Notifications</h2>
                  <p className="text-xs text-on-surface-variant">Get SOS, weather, and group alerts even when the app is closed</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pushEnabled}
                onClick={handleTogglePush}
                disabled={subscribingPush}
                className={cn(
                  'relative flex-shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-60',
                  pushEnabled ? 'bg-primary' : 'bg-outline-variant'
                )}
              >
                <span className={cn(
                  'absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  pushEnabled && 'translate-x-5'
                )} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
