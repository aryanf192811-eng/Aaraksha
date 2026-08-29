// src/pages/safety/SOSPage.tsx
// Design: Stitch "Safety Center" — status row, big pulsing SOS button,
// icon-circle category grid, DMS card. Logic unchanged from the previous
// version: same category/DMS state, same hooks, same mutations.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Battery, Loader2, Timer, CheckCircle2, Wifi, WifiOff,
  PowerOff, Smartphone, Bell, FileWarning,
  Check, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { SOSButton } from '../../components/shared/SOSButton'
import { RescueTrackingCard } from '../../components/shared/RescueTrackingCard'
import { ActiveSOSBanner } from '../../components/shared/ActiveSOSBanner'
import { SafetyTimeline } from '../../components/shared/SafetyTimeline'
import { useSOS } from '../../hooks/useSOS'
import { useBattery } from '../../hooks/useBattery'
import { useDMS } from '../../hooks/useDMS'
import { requestPanicGesturePermission } from '../../hooks/usePanicGesture'
import { usePushNotifications, isPushSupported } from '../../hooks/usePushNotifications'
import dmsApi, { withSecondsRemaining } from '../../api/dms.api'
import { queryClient } from '../../lib/queryClient'
import { useSafetyStore } from '../../store/safety.store'
import { tEnum } from '../../lib/i18nEnums'
import type { SOSCategory } from '../../constants/enums'
import { SOS_CATEGORY_CONFIG as CATEGORY_CONFIG } from '../../constants/sosCategories'
import { cn } from '../../lib/utils'

const DMS_INTERVALS = [
  { labelKey: 'sos.interval30', value: 30 }, { labelKey: 'sos.interval60', value: 60 },
  { labelKey: 'sos.interval120', value: 120 }, { labelKey: 'sos.interval180', value: 180 },
]
// Judge-demo-only quick pick — bypasses the real 15-480 min minimum via the
// backend's separate demoSeconds path (see dms.validator.js) so the
// auto-SOS mechanism can be shown live without a real wait.
const DMS_DEMO_SECONDS = 20

export default function SOSPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
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
  // Unlike the nav bar's SOS button (NavSOSButton.tsx), this one never
  // passed isActive -- so even with an SOS already live (the banner above
  // this button already says so), holding it again showed the same "SEND
  // SOS / Hold 2s to alert" idle state and, since isActive was false,
  // never even fired the "already active" warning toast SOSButton.tsx has
  // built in for exactly this case. Nothing stopped a second, overlapping
  // ACTIVE SOS row from being created silently.
  const activeSOSId = useSafetyStore((s) => s.activeSOSId)
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
    onSuccess: (res) => {
      toast.success(dmsInterval === 'demo'
        ? t('sos.toastDmsActivatedDemo', { seconds: DMS_DEMO_SECONDS })
        : t('sos.toastDmsActivatedInterval', { minutes: dmsInterval }))
      // Set the cache directly rather than only invalidating — see the
      // matching comment in useDMS.ts's resetDMSMutation for why.
      queryClient.setQueryData(['dms', 'active'], withSecondsRemaining(res.data.data))
      setShowDMSSetup(false)
    },
  })

  const handleSOS = async () => {
    await sendSOS(category, message || undefined)
  }

  const handleTogglePanicGesture = async () => {
    if (panicGestureEnabled) {
      setPanicGestureEnabled(false)
      toast(t('sos.toastPanicDisabled'))
      return
    }
    setRequestingPermission(true)
    const granted = await requestPanicGesturePermission()
    setRequestingPermission(false)
    if (granted) {
      setPanicGestureEnabled(true)
      toast.success(t('sos.toastPanicEnabled'))
    } else {
      toast.error(t('sos.toastMotionDenied'))
    }
  }

  const handleTogglePush = async () => {
    if (pushEnabled) {
      await unsubscribePush()
      setPushEnabled(false)
      toast(t('sos.toastPushDisabled'))
      return
    }
    const ok = await subscribePush()
    setPushEnabled(ok)
    if (ok) toast.success(t('sos.toastPushEnabled'))
    else toast.error(t('sos.toastPushFailed'))
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
            <h1 className="font-display text-xl font-black text-on-surface">{t('sos.title')}</h1>
            <p className="text-xs text-on-surface-variant">{t('sos.subtitle')}</p>
          </div>
        </div>
        {navigator.onLine ? <Wifi className="w-5 h-5 text-tsi-low" /> : <WifiOff className="w-5 h-5 text-sos" />}
      </header>

      <div className="px-5 mt-5 space-y-5">
        {/* Status strip — one instrument cluster, not two duplicate cards */}
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-outline-variant">
            <div className="flex items-center gap-2.5 px-4 py-3">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-tsi-low opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-tsi-low" />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">{t('sos.gpsSync')}</span>
                <span className="font-mono text-sm font-bold text-on-surface leading-tight">{t('sos.active')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3">
              <Battery className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">{t('sos.power')}</span>
                <span className="font-mono text-sm font-bold text-on-surface leading-tight">{batteryPct ?? '—'}%</span>
              </div>
            </div>
          </div>
        </div>

        <SafetyTimeline dms={dms} />
        <ActiveSOSBanner />
        <RescueTrackingCard />

        {/* Big SOS Section */}
        <div className="flex flex-col items-center gap-5 py-4">
          <SOSButton onTrigger={handleSOS} loading={sending} size="default" isActive={!!activeSOSId} />
          <p className="text-center text-xs text-on-surface-variant max-w-[260px]">
            {t('sos.disclaimer')}
          </p>
        </div>

        {/* Category selector */}
        <div>
          <p className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wide mb-3 px-0.5">{t('sos.specificEmergency')}</p>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_CONFIG.map(({ value, Icon, color }) => (
              <button key={value} type="button"
                onClick={() => setCategory(value)}
                className={cn(
                  'relative bg-surface-container-lowest shadow-sm border rounded-2xl p-3.5 flex flex-col items-center gap-2 transition-all',
                  category === value ? 'border-primary ring-2 ring-primary/25 -translate-y-0.5 shadow-md bg-primary/5' : 'border-outline-variant'
                )}>
                {category === value && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
                  </span>
                )}
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', color)}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-xs font-bold text-on-surface">{tEnum(t, 'sosCategory', value)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Optional message */}
        <textarea
          placeholder={t('sos.additionalDetailsPlaceholder')}
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 text-on-surface transition-colors"
        />

        {/* DMS Section — card tint itself reflects state, not just an inner badge */}
        <div className={cn('rounded-2xl p-5 shadow-sm border transition-colors',
          dms?.status === 'ACTIVE' ? 'bg-tsi-low/5 border-tsi-low/30' :
          dms?.status === 'TRIGGERED' ? 'bg-sos/5 border-sos/30' :
          'bg-surface-container-lowest border-outline-variant'
        )}>
          <div className="flex items-center gap-3 mb-4">
            <Timer className="w-6 h-6 text-primary" />
            <div>
              <h2 className="font-display font-black text-on-surface">{t('sos.dmsTitle')}</h2>
              <p className="text-xs text-on-surface-variant">{t('sos.dmsSubtitle')}</p>
            </div>
          </div>

          {dms && dms.status === 'TRIGGERED' ? (
            <div className="space-y-2">
              <div className="bg-sos/10 border border-sos/30 rounded-xl p-4 text-center">
                <p className="font-bold text-sos-dark">{t('sos.dmsTriggeredTitle')}</p>
                <p className="text-xs text-sos-dark/80 mt-1">{t('sos.dmsTriggeredSubtitle')}</p>
              </div>
              <button
                onClick={() => disableDMS(dms.id)}
                disabled={disabling}
                className="w-full rounded-full h-11 text-sm font-bold border-2 border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                {disabling ? t('sos.dismissing') : t('sos.dismiss')}
              </button>
            </div>
          ) : dms && dms.status === 'ACTIVE' ? (
            <div className="space-y-2">
              <div className="bg-tsi-low/10 border border-tsi-low/30 rounded-xl p-4 text-center">
                <p className="flex items-center justify-center gap-1.5 font-bold text-tsi-low">
                  <CheckCircle2 className="w-4 h-4" />
                  {dms.interval_seconds != null
                    ? t('sos.dmsActiveDemo', { seconds: dms.interval_seconds })
                    : t('sos.dmsActiveInterval', { minutes: dms.interval_minutes })}
                </p>
                <p className="text-xs text-tsi-low/80 mt-1">{t('sos.dmsActiveHint')}</p>
              </div>

              {confirmingDisable ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { disableDMS(dms.id); setConfirmingDisable(false) }}
                    disabled={disabling}
                    className="flex-1 rounded-full h-10 text-xs font-bold border-2 border-sos-light text-sos-dark hover:bg-sos-light transition-colors"
                  >
                    {disabling ? t('sos.disabling') : t('sos.confirmDisable')}
                  </button>
                  <button
                    onClick={() => setConfirmingDisable(false)}
                    className="flex-1 rounded-full h-10 text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDisable(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-sos-dark py-2 transition-colors"
                >
                  <PowerOff className="w-3.5 h-3.5" /> {t('sos.disableDms')}
                </button>
              )}
            </div>
          ) : (
            <>
              {!showDMSSetup ? (
                <button onClick={() => setShowDMSSetup(true)}
                  className="w-full bg-primary hover:brightness-95 text-primary-foreground font-bold rounded-full h-12 transition-all active:scale-95">
                  {t('sos.activateDms')}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-on-surface-variant">{t('sos.checkInInterval')}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {DMS_INTERVALS.map(({ labelKey, value }) => (
                      <button key={value} type="button" onClick={() => setDmsInterval(value)}
                        className={cn('rounded-xl border-2 py-2 text-center text-xs font-bold transition-all',
                          dmsInterval === value ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant'
                        )}>
                        {t(labelKey)}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setDmsInterval('demo')}
                    className={cn('w-full rounded-xl border-2 border-dashed py-2 text-center text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                      dmsInterval === 'demo' ? 'border-primary bg-primary/10 text-primary-dark' : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant'
                    )}>
                    <Timer className="w-3.5 h-3.5" /> {t('sos.demoIntervalLabel', { seconds: DMS_DEMO_SECONDS })}
                  </button>
                  <button onClick={() => createDMS()} disabled={creatingDMS}
                    className="w-full bg-on-surface text-surface font-bold rounded-full h-12 flex items-center justify-center active:scale-95 transition-all">
                    {creatingDMS
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : dmsInterval === 'demo' ? t('sos.activateDemo', { seconds: DMS_DEMO_SECONDS }) : t('sos.activateInterval', { minutes: dmsInterval })}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Panic gesture + Push notifications — one grouped settings list
            (iOS-style rows sharing a card) instead of two duplicate cards */}
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm divide-y divide-outline-variant overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3 min-w-0">
              <Smartphone className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="font-bold text-sm text-on-surface">{t('sos.panicTitle')}</h2>
                <p className="text-xs text-on-surface-variant">{t('sos.panicSubtitle')}</p>
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

          {isPushSupported() && (
            <div className="flex items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3 min-w-0">
                <Bell className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-bold text-sm text-on-surface">{t('sos.pushTitle')}</h2>
                  <p className="text-xs text-on-surface-variant">{t('sos.pushSubtitle')}</p>
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
          )}
        </div>

        {/* E-FIR entry point — a formal, after-the-fact report (theft,
            harassment...) routed to a govt officer, not an active
            emergency. Placed last, below SOS/DMS, so it reads as "not
            urgent enough for the SOS button above" rather than competing
            with it. */}
        <button onClick={() => navigate('/incidents')}
          className="w-full bg-surface-container-lowest shadow-sm border border-outline-variant rounded-2xl p-4 flex items-center gap-3 text-left hover:shadow-md active:scale-[0.99] transition-all">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileWarning className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-sm text-on-surface">{t('sos.incidentReportTitle')}</h2>
            <p className="text-xs text-on-surface-variant">{t('sos.incidentReportSubtitle')}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
        </button>
      </div>
    </div>
  )
}
