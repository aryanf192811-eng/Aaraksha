// src/pages/safety/CheckpointPassPage.tsx
// A rotating QR code a checkpoint officer scans to pull up this tourist's
// safety profile (blood group, medical info, govt ID, emergency contacts,
// active trip TSI) and log the pass-through — relevant at ILP checkposts
// and other government-monitored entry points in restricted districts.
// The code expires 5 minutes after generation (see backend checkpoint.service.js)
// so an old screenshot can't be reused as a standing pass.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, QrCode, ShieldCheck, Loader2 } from 'lucide-react'
import checkpointApi from '../../api/checkpoint.api'
import { queryClient } from '../../lib/queryClient'

export default function CheckpointPassPage() {
  const navigate = useNavigate()
  const [secondsLeft, setSecondsLeft] = useState(0)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['checkpoint-qr'],
    queryFn: () => checkpointApi.getCheckpointQR().then(r => r.data.data),
    staleTime: 0,
  })

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

  return (
    <div className="min-h-screen bg-surface pb-24 font-sans">
      <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-md px-5 pt-12 pb-3 flex items-center gap-3 border-b border-outline-variant/50">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6 text-on-surface" />
        </button>
        <div>
          <h1 className="font-display text-xl font-black text-on-surface">Checkpoint Pass</h1>
          <p className="text-xs text-on-surface-variant">Show this to a checkpoint officer</p>
        </div>
      </header>

      <div className="px-5 mt-6 flex flex-col items-center">
        <div className="bg-surface-container-lowest rounded-3xl shadow-glass-lg p-6 w-full max-w-sm flex flex-col items-center">
          <div className="w-64 h-64 rounded-2xl bg-white flex items-center justify-center overflow-hidden shadow-inner">
            {isLoading ? (
              <Loader2 className="w-8 h-8 text-on-surface-variant animate-spin" />
            ) : data ? (
              <img src={data.qrDataUri} alt="Checkpoint QR code" className={expired ? 'opacity-20' : ''} />
            ) : (
              <QrCode className="w-16 h-16 text-on-surface-variant opacity-30" />
            )}
          </div>

          <div className="mt-4 text-center">
            {expired ? (
              <p className="text-sm font-bold text-sos">Code expired</p>
            ) : data ? (
              <p className="text-sm text-on-surface-variant">
                Expires in <span className="font-mono font-bold text-on-surface">{mm}:{ss}</span>
              </p>
            ) : null}
          </div>

          <button onClick={handleRefresh} disabled={isFetching}
            className="mt-4 flex items-center gap-2 text-sm font-bold text-primary bg-primary/10 px-4 py-2 rounded-full disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh Code'}
          </button>
        </div>

        <div className="mt-5 bg-primary/10 border border-primary/20 rounded-2xl p-4 w-full max-w-sm">
          <p className="text-xs font-bold text-primary flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" /> What gets shared
          </p>
          <p className="text-xs text-primary/90">
            Scanning shares your name, blood group, medical info, government ID suffix, emergency contacts, and active trip safety score with the checkpoint officer — nothing more.
          </p>
        </div>
      </div>
    </div>
  )
}
