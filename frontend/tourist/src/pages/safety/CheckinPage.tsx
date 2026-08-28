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
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6 text-on-surface" /></button>
          <div>
            <h1 className="text-xl font-black text-on-surface">{t('checkin.title')}</h1>
            <p className="text-xs text-on-surface-variant">{t('checkin.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5 space-y-5">
        {/* No signal at all? A plain text message works too — same inbound
            SMS pipeline that already handles offline SOS, just a lighter
            "SAFE" keyword instead of the app-generated structured message,
            since a person should be able to type this by hand from any
            phone, not just one running the app. */}
        {EMERGENCY_NUMBER && (
          <div className="bg-trust/5 border border-trust/20 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-trust/15 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-4.5 h-4.5 text-trust-dark" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-trust-dark">{t('checkin.smsFallbackTitle')}</p>
              <p className="text-xs text-trust-dark/80 mt-0.5">
                {t('checkin.smsFallbackDesc', { number: EMERGENCY_NUMBER })}
              </p>
            </div>
          </div>
        )}

        {/* Check-in readiness — GPS + battery as one instrument card, not
            two duplicate boxes stacked with a gap between them. */}
        <div className={cn('bg-surface-container-lowest rounded-2xl shadow-sm border transition-colors overflow-hidden',
          locationReady ? 'border-tsi-low/30' : 'border-outline-variant'
        )}>
          <div className="flex items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                locationReady ? 'bg-tsi-low/10' : 'bg-surface-container-high'
              )}>
                <MapPin className={cn('w-5 h-5', locationReady ? 'text-tsi-low' : 'text-on-surface-variant')} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-on-surface">{t('checkin.gpsLocation')}</p>
                <p className={cn('text-xs', locationReady ? 'text-tsi-low font-medium' : 'text-on-surface-variant')}>
                  {gpsLoading ? t('checkin.gettingGpsFix') :
                   locationReady ? t('checkin.accuracy', { m: Math.round(coords?.accuracy || 0) }) :
                                   t('checkin.gpsUnavailable')}
                </p>
              </div>
            </div>
            <button onClick={refreshLocation} className="p-1.5 rounded-lg hover:bg-surface-container-high flex-shrink-0">
              <RefreshCw className={cn('w-4 h-4 text-on-surface-variant', gpsLoading && 'animate-spin')} />
            </button>
          </div>
          {coords && (
            <p className="mx-5 -mt-2 mb-4 text-xs text-on-surface-variant font-mono bg-surface-container rounded-lg px-3 py-1.5">
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </p>
          )}

          <div className="h-px bg-outline-variant" />

          <div className="flex items-center gap-3 p-5">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Battery className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-on-surface">{t('checkin.batteryLevel')}</p>
              {batteryPct !== null ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-surface-container-high rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all duration-500',
                        batteryPct > 50 ? 'bg-tsi-low' : batteryPct > 20 ? 'bg-primary' : 'bg-sos'
                      )}
                      style={{ width: `${batteryPct}%` }}
                    />
                  </div>
                  <span className={cn('text-sm font-bold',
                    batteryPct > 50 ? 'text-tsi-low' : batteryPct > 20 ? 'text-primary' : 'text-sos-dark'
                  )}>{batteryPct}%</span>
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant">{t('checkin.notAvailableDevice')}</p>
              )}
            </div>
            {batteryPct !== null && batteryPct < 20 && (
              <span className="text-xs text-sos-dark font-bold bg-sos-light px-2 py-1 rounded-full flex-shrink-0">{t('checkin.low')}</span>
            )}
          </div>
        </div>

        {/* Optional message */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-on-surface-variant" />
            <p className="text-sm font-bold text-on-surface">{t('checkin.messageOptional')}</p>
          </div>
          <textarea
            placeholder={t('checkin.messagePlaceholder')}
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={2}
            className="w-full border border-outline-variant bg-surface-container rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 text-on-surface transition-colors"
          />
        </div>

        {dms && dms.status === 'ACTIVE' && (
          <div className="bg-tsi-low/10 border border-tsi-low/30 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-tsi-low flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-tsi-low">{t('checkin.dmsWillReset')}</p>
              <p className="text-xs text-tsi-low/80">{t('checkin.dmsResetDesc')}</p>
            </div>
          </div>
        )}

        <Button
          onClick={() => checkIn()}
          disabled={isPending || !locationReady}
          className="w-full h-14 bg-tsi-low hover:brightness-110 text-white rounded-full font-semibold text-lg shadow-glass flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> {t('checkin.imSafeButton')}</>}
        </Button>

        {!locationReady && !gpsLoading && (
          <p className="text-center text-xs text-primary">
            {t('checkin.enableGpsHint')}
          </p>
        )}

        {recentCheckins && recentCheckins.length > 0 && (
          <div>
            <h2 className="text-base font-black text-on-surface mb-3">{t('checkin.recentCheckins')}</h2>
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
              {recentCheckins.map((c, i) => (
                <div key={c.id} className={cn('flex items-center gap-3 px-5 py-3', i > 0 && 'border-t border-outline-variant')}>
                  <div className="w-7 h-7 bg-tsi-low/10 rounded-full flex items-center justify-center flex-shrink-0">
                    {c.type === 'DMS_RESET' ? <RotateCcw className="w-4 h-4 text-tsi-low" />
                      : c.type === 'SMS' ? <Smartphone className="w-4 h-4 text-tsi-low" />
                      : <CheckCircle2 className="w-4 h-4 text-tsi-low" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface">
                      {c.type === 'DMS_RESET' ? t('checkin.dmsResetLabel')
                        : c.type === 'SMS' ? t('checkin.smsCheckinLabel')
                        : t('checkin.manualCheckin')}
                    </p>
                    {c.message && <p className="text-xs text-on-surface-variant truncate">"{c.message}"</p>}
                  </div>
                  <span className="text-xs text-on-surface-variant whitespace-nowrap">{formatTimeAgo(c.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
