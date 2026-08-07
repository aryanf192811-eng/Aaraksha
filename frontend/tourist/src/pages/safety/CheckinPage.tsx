// src/pages/safety/CheckinPage.tsx
// Quick check-in: location + battery + optional message + DMS reset
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, MapPin, Battery, MessageSquare, CheckCircle2, Loader2, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { useDMS } from '../../hooks/useDMS'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useBattery } from '../../hooks/useBattery'
import checkinApi from '../../api/checkin.api'
import { queryClient } from '../../lib/queryClient'
import { formatTimeAgo, cn } from '../../lib/utils'

export default function CheckinPage() {
  const navigate = useNavigate()
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
      toast.success(`Checked in!${res.data.data.dmsReset ? ' DMS reset.' : ''}`)
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
      toast.success('Location updated')
    } catch {
      toast.error('Could not get GPS location')
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6 text-on-surface" /></button>
          <div>
            <h1 className="text-xl font-black text-on-surface">Check In</h1>
            <p className="text-xs text-on-surface-variant">Confirm you're safe · Reset DMS</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5 space-y-5">
        {/* Location card */}
        <div className={cn('bg-surface-container-lowest rounded-2xl shadow-sm p-5 border-2 transition-colors',
          locationReady ? 'border-green-200' : 'border-outline-variant'
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center',
                locationReady ? 'bg-green-100' : 'bg-surface-container-high'
              )}>
                <MapPin className={cn('w-5 h-5', locationReady ? 'text-green-600' : 'text-on-surface-variant')} />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">GPS Location</p>
                <p className={cn('text-xs', locationReady ? 'text-green-600 font-medium' : 'text-on-surface-variant')}>
                  {gpsLoading ? 'Getting GPS fix...' :
                   locationReady ? `Accuracy: ±${Math.round(coords?.accuracy || 0)}m` :
                                   'GPS unavailable'}
                </p>
              </div>
            </div>
            <button onClick={refreshLocation} className="p-1.5 rounded-lg hover:bg-surface-container-high">
              <RefreshCw className={cn('w-4 h-4 text-on-surface-variant', gpsLoading && 'animate-spin')} />
            </button>
          </div>
          {coords && (
            <p className="text-xs text-on-surface-variant font-mono bg-surface-container rounded-lg px-3 py-1.5">
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </p>
          )}
        </div>

        {/* Battery status */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
            <Battery className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-on-surface">Battery Level</p>
            {batteryPct !== null ? (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-surface-container-high rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full transition-all duration-500',
                      batteryPct > 50 ? 'bg-green-500' : batteryPct > 20 ? 'bg-primary' : 'bg-red-500'
                    )}
                    style={{ width: `${batteryPct}%` }}
                  />
                </div>
                <span className={cn('text-sm font-bold',
                  batteryPct > 50 ? 'text-green-600' : batteryPct > 20 ? 'text-primary' : 'text-red-600'
                )}>{batteryPct}%</span>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">Not available on this device</p>
            )}
          </div>
          {batteryPct !== null && batteryPct < 20 && (
            <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded-full">Low!</span>
          )}
        </div>

        {/* Optional message */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-on-surface-variant" />
            <p className="text-sm font-bold text-on-surface">Message (optional)</p>
          </div>
          <textarea
            placeholder="Everything is good! Currently at..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={2}
            className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary text-on-surface"
          />
        </div>

        {dms && dms.status === 'ACTIVE' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-700">DMS will reset</p>
              <p className="text-xs text-green-600">Your Dead Man's Switch resets automatically when you check in</p>
            </div>
          </div>
        )}

        <Button
          onClick={() => checkIn()}
          disabled={isPending || !locationReady}
          className="w-full h-14 bg-green-600 hover:bg-green-700 text-white rounded-full font-black text-lg shadow-lg shadow-green-200 flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> I'm Safe — Check In Now</>}
        </Button>

        {!locationReady && !gpsLoading && (
          <p className="text-center text-xs text-primary">
            Enable GPS location for accurate check-in. Tap the refresh icon above.
          </p>
        )}

        {recentCheckins && recentCheckins.length > 0 && (
          <div>
            <h2 className="text-base font-black text-on-surface mb-3">Recent Check-ins</h2>
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
              {recentCheckins.map((c, i) => (
                <div key={c.id} className={cn('flex items-center gap-3 px-5 py-3', i > 0 && 'border-t border-outline-variant')}>
                  <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    {c.type === 'DMS_RESET' ? <RotateCcw className="w-4 h-4 text-green-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface">
                      {c.type === 'DMS_RESET' ? 'DMS Reset' : 'Manual Check-in'}
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
