// src/pages/safety/CheckinPage.tsx
// Quick check-in: location + battery + optional message + DMS reset
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MapPin, Battery, MessageSquare, CheckCircle2, Loader2, RefreshCw, RotateCcw, Smartphone } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { useDMS } from '../../hooks/useDMS'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useBattery } from '../../hooks/useBattery'
import checkinApi from '../../api/checkin.api'
import { queryClient } from '../../lib/queryClient'
import { formatTimeAgo, cn } from '../../lib/utils'

// Same env var the offline-SOS sms: link already uses (useSOS.ts) — one
// number, one inbound Twilio webhook, two message patterns it understands.
const EMERGENCY_NUMBER = import.meta.env.VITE_EMERGENCY_NUMBERS || ''

export default function CheckinPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const [locationReady, setLocationReady] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null)
  const { getPosition, loading: gpsLoading } = useGeolocation()
  const { batteryPct } = useBattery()
  const { dms } = useDMS()

  useEffect(() => {
    getPosition()
      .then(pos => { setCoords({ lat: pos.latitude, lng: pos.longitude, accuracy: pos.accuracy }); setLocationReady(true) })
      .catch(() => setLocationReady(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: recentCheckins } = useQuery({
    queryKey: ['checkins', 'recent'],
    queryFn: () => checkinApi.getRecentCheckins({ limit: 5 }).then(r => r.data.data),
  })

  const { mutate: checkIn, isPending } = useMutation({
    mutationFn: () => checkinApi.createCheckin({
      latitude: coords?.lat ?? 0,
      longitude: coords?.lng ?? 0,
      batteryPct,
      message: message || null,
      tripId: null,
      dmsId: dms?.id || null,
      accuracyM: coords?.accuracy || null,
    }),
    onSuccess: (res) => {
      toast.success(`${t('checkin.toastCheckedIn')}${res.data.data.dmsReset ? t('checkin.toastDmsResetSuffix') : ''}`)
      queryClient.invalidateQueries({ queryKey: ['checkins'] })
      queryClient.invalidateQueries({ queryKey: ['dms', 'active'] })
      setMessage('')
    },
  })

  const refreshLocation = async () => {
    try {
      const pos = await getPosition()
      setCoords({ lat: pos.latitude, lng: pos.longitude, accuracy: pos.accuracy })
      setLocationReady(true)
      toast.success(t('checkin.toastLocationUpdated'))
    } catch {
      toast.error(t('checkin.toastGpsFailed'))
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm border-b border-outline-variant/30 sticky top-0 z-10 backdrop-blur-md bg-surface-container-lowest/90">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container active:scale-95 transition-all text-on-surface"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-black text-on-surface font-display">{t('checkin.title')}</h1>
            <p className="text-xs text-on-surface-variant font-medium">{t('checkin.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5 space-y-5">
        {/* No signal at all? A plain text message works too — same inbound
            SMS pipeline that already handles offline SOS, just a lighter
            "SAFE" keyword instead of the app-generated structured message. */}
        {EMERGENCY_NUMBER && (
          <div className="bg-trust/10 border border-trust/25 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-trust/20 flex items-center justify-center flex-shrink-0 text-trust-dark">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-trust-dark">{t('checkin.smsFallbackTitle')}</p>
              <p className="text-xs text-trust-dark/85 mt-0.5 leading-relaxed">
                {t('checkin.smsFallbackDesc', { number: EMERGENCY_NUMBER })}
              </p>
            </div>
          </div>
        )}

        {/* Check-in readiness — unified instrument card */}
        <div className={cn(
          'bg-surface-container-lowest rounded-3xl shadow-sm border transition-all duration-300 overflow-hidden',
          locationReady ? 'border-safe/30 ring-1 ring-safe/10' : 'border-outline-variant'
        )}>
          {/* GPS Instrument */}
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  'w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors',
                  locationReady ? 'bg-safe/15 text-safe' : 'bg-surface-container-high text-on-surface-variant'
                )}>
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-on-surface">{t('checkin.gpsLocation')}</p>
                    {locationReady && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-safe bg-safe/10 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-safe animate-ping" />
                        {t('checkin.accuracy', { m: Math.round(coords?.accuracy || 0) })}
                      </span>
                    )}
                  </div>
                  <p className={cn('text-xs mt-0.5', locationReady ? 'text-safe font-medium' : 'text-on-surface-variant')}>
                    {gpsLoading ? t('checkin.gettingGpsFix') :
                     locationReady ? 'Signal Locked' :
                                     t('checkin.gpsUnavailable')}
                  </p>
                </div>
              </div>
              <button
                onClick={refreshLocation}
                title="Refresh GPS location"
                className="w-9 h-9 rounded-xl border border-outline-variant hover:bg-surface-container flex items-center justify-center flex-shrink-0 active:scale-95 transition-all text-on-surface-variant"
              >
                <RefreshCw className={cn('w-4 h-4', gpsLoading && 'animate-spin text-primary')} />
              </button>
            </div>

            {coords && (
              <div className="mt-3 flex items-center gap-2 bg-surface-container/70 rounded-xl px-3.5 py-2 border border-outline-variant/40">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Coords:</span>
                <span className="text-xs font-mono font-semibold text-on-surface truncate">
                  {coords.lat.toFixed(6)}° N, {coords.lng.toFixed(6)}° E
                </span>
              </div>
            )}
          </div>

          <div className="h-px bg-outline-variant/50 mx-5" />

          {/* Battery Instrument */}
          <div className="p-5 flex items-center gap-3.5">
            <div className={cn(
              'w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors',
              batteryPct !== null && batteryPct < 20 ? 'bg-sos/15 text-sos' : 'bg-primary/15 text-primary'
            )}>
              <Battery className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-sm font-bold text-on-surface">{t('checkin.batteryLevel')}</p>
                {batteryPct !== null ? (
                  <span className={cn('text-sm font-black tabular-nums',
                    batteryPct > 50 ? 'text-safe' : batteryPct > 20 ? 'text-primary' : 'text-sos'
                  )}>
                    {batteryPct}%
                  </span>
                ) : (
                  <span className="text-xs text-on-surface-variant">{t('checkin.notAvailableDevice')}</span>
                )}
              </div>
              {batteryPct !== null && (
                <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden">
                  <div
                    className={cn('h-2.5 rounded-full transition-all duration-500',
                      batteryPct > 50 ? 'bg-safe' : batteryPct > 20 ? 'bg-primary' : 'bg-sos'
                    )}
                    style={{ width: `${batteryPct}%` }}
                  />
                </div>
              )}
            </div>
            {batteryPct !== null && batteryPct < 20 && (
              <span className="text-[11px] text-sos font-bold bg-sos/15 px-2.5 py-1 rounded-full flex-shrink-0">
                {t('checkin.low')}
              </span>
            )}
          </div>
        </div>

        {/* Optional message with 1-tap quick preset chips */}
        <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold text-on-surface">{t('checkin.messageOptional')}</p>
          </div>
          <textarea
            placeholder={t('checkin.messagePlaceholder')}
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={2}
            className="w-full border border-outline-variant bg-surface-container rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 text-on-surface transition-all placeholder:text-on-surface-variant/60"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {['📍 At Hotel', '🚶 Trek Going Well', '☕ Taking a Break'].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setMessage(prev => prev ? `${prev} · ${preset}` : preset)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/50 text-on-surface active:scale-95 transition-transform"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {dms && dms.status === 'ACTIVE' && (
          <div className="bg-safe/10 border border-safe/30 rounded-3xl p-4.5 flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-2xl bg-safe/20 flex items-center justify-center flex-shrink-0 text-safe">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-safe">{t('checkin.dmsWillReset')}</p>
              <p className="text-xs text-safe/80 mt-0.5 leading-relaxed">{t('checkin.dmsResetDesc')}</p>
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <Button
          onClick={() => checkIn()}
          disabled={isPending || !locationReady}
          className="w-full h-14 bg-safe hover:bg-safe/90 active:scale-[0.98] text-white rounded-full font-bold text-base shadow-lg shadow-safe/25 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>{t('checkin.imSafeButton')}</span>
            </>
          )}
        </Button>

        {!locationReady && !gpsLoading && (
          <p className="text-center text-xs text-primary font-medium">
            {t('checkin.enableGpsHint')}
          </p>
        )}

        {/* Recent Check-in Timeline Feed */}
        {recentCheckins && recentCheckins.length > 0 && (
          <div className="pt-2">
            <h2 className="text-base font-black text-on-surface mb-3 px-1">{t('checkin.recentCheckins')}</h2>
            <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/40 p-4 divide-y divide-outline-variant/40">
              {recentCheckins.map((c) => (
                <div key={c.id} className="flex items-start gap-3.5 py-3 first:pt-1 last:pb-1">
                  <div className="w-8 h-8 rounded-xl bg-safe/10 text-safe flex items-center justify-center flex-shrink-0 mt-0.5">
                    {c.type === 'DMS_RESET' ? <RotateCcw className="w-4 h-4" />
                      : c.type === 'SMS' ? <Smartphone className="w-4 h-4" />
                      : <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-on-surface">
                        {c.type === 'DMS_RESET' ? t('checkin.dmsResetLabel')
                          : c.type === 'SMS' ? t('checkin.smsCheckinLabel')
                          : t('checkin.manualCheckin')}
                      </p>
                      <span className="text-[11px] text-on-surface-variant font-medium whitespace-nowrap">
                        {formatTimeAgo(c.created_at)}
                      </span>
                    </div>
                    {c.message && (
                      <p className="text-xs text-on-surface-variant mt-1 bg-surface-container/60 rounded-lg px-2.5 py-1 inline-block">
                        "{c.message}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
