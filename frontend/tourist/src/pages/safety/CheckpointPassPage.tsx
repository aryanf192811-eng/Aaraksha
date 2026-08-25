// src/pages/safety/CheckpointPassPage.tsx
// The Digital Tourist ID: a passport-style card (photo, name, masked govt
// ID, active-trip context) wrapping a rotating QR code a checkpoint officer
// scans to pull up this tourist's safety profile and log the pass-through —
// relevant at ILP checkposts and other government-monitored entry points in
// restricted districts.
//
// The QR itself expires 5 minutes after generation (see backend
// checkpoint.service.js) — deliberately NOT a static ID card image, since a
// permanent code showing full KYC data would be a standing privacy/spoofing
// liability. Short-lived + purpose-scoped is the stronger security model;
// the card chrome around it exists so it still *reads* as a proper ID at a
// glance instead of a bare QR code.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, QrCode, ShieldCheck, Loader2, IdCard } from 'lucide-react'
import checkpointApi from '../../api/checkpoint.api'
import tripApi from '../../api/trip.api'
import { queryClient } from '../../lib/queryClient'
import { useAuthStore } from '../../store/auth.store'
import { formatDate, cn } from '../../lib/utils'
import { TRIP_STATUSES } from '../../constants/enums'

const TSI_STYLE: Record<string, string> = {
  'Low Risk':      'bg-green-100 text-green-700',
  'Moderate Risk': 'bg-amber-100 text-amber-700',
  'High Risk':     'bg-orange-100 text-orange-700',
  'Extreme Risk':  'bg-red-100 text-red-700',
}

export default function CheckpointPassPage() {
  const navigate = useNavigate()
  const tourist = useAuthStore((s) => s.tourist)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['checkpoint-qr'],
    queryFn: () => checkpointApi.getCheckpointQR().then(r => r.data.data),
    staleTime: 0,
  })

  const { data: trips } = useQuery({
    queryKey: ['trips', { status: TRIP_STATUSES.ACTIVE }],
    queryFn: () => tripApi.getMyTrips({ status: TRIP_STATUSES.ACTIVE, limit: 1 }).then(r => r.data),
    staleTime: 60_000,
  })
  const activeTrip = trips?.data?.[0]
  const activeStop = activeTrip ? (Array.isArray(activeTrip.stops) ? activeTrip.stops[0] : null) : null

  useEffect(() => {
    if (!data) return
    setSecondsLeft(data.expiresInSeconds)
    const interval = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(interval)
  }, [data])

  const handleRefresh = () => {
    queryClient.removeQueries({ queryKey: ['checkpoint-qr'] })
    refetch()
  }

  const expired = secondsLeft <= 0 && !!data
  const mm = Math.floor(secondsLeft / 60)
  const ss = String(secondsLeft % 60).padStart(2, '0')
  const initials = (tourist?.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="min-h-screen bg-surface pb-24 font-sans">
      <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-md px-5 pt-12 pb-3 flex items-center gap-3 border-b border-outline-variant/50">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6 text-on-surface" />
        </button>
        <div>
          <h1 className="font-display text-xl font-black text-on-surface">Digital Tourist ID</h1>
          <p className="text-xs text-on-surface-variant">Show this to a checkpoint officer</p>
        </div>
      </header>

      <div className="px-5 mt-6 flex flex-col items-center">
        {/* ── ID card ─────────────────────────────────────────── */}
        <div className="w-full max-w-sm rounded-3xl shadow-glass-lg overflow-hidden bg-surface-container-lowest">
          <div className="bg-on-surface text-surface px-5 pt-4 pb-3 flex items-center gap-2">
            <IdCard className="w-4 h-4" />
            <span className="text-xs font-extrabold uppercase tracking-widest">Aaraksha · Digital Tourist ID</span>
          </div>

          <div className="p-5 flex items-center gap-4">
            {tourist?.profile_photo_url ? (
              <img src={tourist.profile_photo_url} alt={tourist.full_name}
                className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-outline-variant" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-shrink-0 text-xl font-black">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-display font-black text-on-surface text-lg truncate">{tourist?.full_name}</p>
              <p className="text-xs text-on-surface-variant font-mono">
                {tourist?.govt_id_type || 'ID'} · •••• {tourist?.govt_id_suffix || '····'}
              </p>
              {tourist?.blood_group && (
                <p className="text-xs text-on-surface-variant mt-0.5">Blood group: {tourist.blood_group}</p>
              )}
            </div>
          </div>

          <div className="px-5 pb-4">
            {activeTrip ? (
              <div className="bg-surface-container rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Currently traveling</p>
                  <p className="text-sm font-bold text-on-surface truncate">
                    {activeStop?.city || activeTrip.title} · until {formatDate(activeTrip.end_date)}
                  </p>
                </div>
                {activeTrip.tsi_label && (
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0', TSI_STYLE[activeTrip.tsi_label] || TSI_STYLE['Moderate Risk'])}>
                    {activeTrip.tsi_label}
                  </span>
                )}
              </div>
            ) : (
              <div className="bg-surface-container rounded-xl px-3 py-2.5">
                <p className="text-sm text-on-surface-variant">No active trip right now</p>
              </div>
            )}
          </div>

          {/* ── Verification QR ──────────────────────────────── */}
          <div className="border-t border-outline-variant bg-surface p-5 flex flex-col items-center">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-3">Verification code</p>
            <div className="w-48 h-48 rounded-2xl bg-white flex items-center justify-center overflow-hidden shadow-inner">
              {isLoading ? (
                <Loader2 className="w-8 h-8 text-on-surface-variant animate-spin" />
              ) : data ? (
                <img src={data.qrDataUri} alt="Checkpoint QR code" className={expired ? 'opacity-20' : ''} />
              ) : (
                <QrCode className="w-16 h-16 text-on-surface-variant opacity-30" />
              )}
            </div>

            <div className="mt-3 text-center">
              {expired ? (
                <p className="text-sm font-bold text-sos">Code expired</p>
              ) : data ? (
                <p className="text-sm text-on-surface-variant">
                  Expires in <span className="font-mono font-bold text-on-surface">{mm}:{ss}</span>
                </p>
              ) : null}
            </div>

            <button onClick={handleRefresh} disabled={isFetching}
              className="mt-3 flex items-center gap-2 text-sm font-bold text-primary bg-primary/10 px-4 py-2 rounded-full disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Refreshing...' : 'Refresh Code'}
            </button>
          </div>
        </div>

        <div className="mt-5 bg-primary/10 border border-primary/20 rounded-2xl p-4 w-full max-w-sm">
          <p className="text-xs font-bold text-primary flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Why this refreshes every 5 minutes
          </p>
          <p className="text-xs text-primary/90">
            A static ID code could be screenshotted and reused by anyone. This one expires and rotates instead, so scanning it always confirms you're the one actually present. It shares your name, blood group, medical info, government ID suffix, emergency contacts, and active trip safety score with the checkpoint officer — nothing more.
          </p>
        </div>
      </div>
    </div>
  )
}
