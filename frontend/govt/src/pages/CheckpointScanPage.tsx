// src/pages/CheckpointScanPage.tsx
// A checkpoint officer pastes/scans the short-lived QR token shown on a
// tourist's phone (public/push-style device camera QR scanning isn't wired
// up here — text entry mirrors how a handheld barcode scanner or camera app
// would feed a decoded string into a focused input) to pull up their safety
// profile and log the pass-through.
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { QrCode, Loader2, Droplet, Phone, ShieldCheck, MapPin, Clock, AlertTriangle, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import govtApi, { type CheckpointScanResult } from '../api/govt.api'
import { formatTimeAgo, cn } from '../lib/utils'

const TSI_COLOR: Record<string, string> = {
  SAFE: 'text-emerald-600 bg-emerald-100', MODERATE: 'text-amber-600 bg-amber-100',
  RISKY: 'text-orange-600 bg-orange-100', EXTREME: 'text-red-600 bg-red-100',
}

export default function CheckpointScanPage() {
  const [token, setToken] = useState('')
  const [checkpointName, setCheckpointName] = useState('')
  const [district, setDistrict] = useState('')
  const [result, setResult] = useState<CheckpointScanResult | null>(null)

  const { data: recentScans } = useQuery({
    queryKey: ['govt', 'checkpoint', 'recent'],
    queryFn: () => govtApi.getRecentCheckpointScans(15).then(r => r.data.data),
    refetchInterval: 20_000,
  })

  const { mutate: scan, isPending: scanning } = useMutation({
    mutationFn: () => govtApi.scanCheckpoint({ token: token.trim(), checkpointName: checkpointName.trim(), district: district.trim() || undefined }),
    onSuccess: (res) => {
      setResult(res.data.data)
      setToken('')
      toast.success(`${res.data.data.tourist.fullName} checked in at ${checkpointName}`)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Scan failed — check the code and try again'),
  })

  const canScan = token.trim().length > 0 && checkpointName.trim().length >= 2 && !scanning

  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <ScanLine className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-on-surface">Checkpoint Scan</h1>
          <p className="text-sm text-on-surface-variant">Verify a tourist's identity and safety profile at an entry/ILP checkpoint</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan form */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant h-fit">
          <h2 className="font-bold text-on-surface mb-4 flex items-center gap-2">
            <QrCode className="w-4 h-4" /> Scan or Enter Code
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Checkpoint Name *</label>
              <Input value={checkpointName} onChange={(e) => setCheckpointName(e.target.value)} placeholder="e.g. Dimapur ILP Checkpost" />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant mb-1 block">District</label>
              <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Dimapur" />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Scanned Code *</label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste or scan the tourist's QR token"
                className="font-mono text-xs"
                autoFocus
              />
            </div>
            <Button onClick={() => scan()} disabled={!canScan}
              className="w-full h-11 bg-primary hover:brightness-95 text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              {scanning ? 'Verifying...' : 'Scan'}
            </Button>
            <p className="text-xs text-on-surface-variant">Codes expire 5 minutes after the tourist generates them — ask them to refresh if the scan fails.</p>
          </div>
        </div>

        {/* Result card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant">
          <h2 className="font-bold text-on-surface mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Tourist Profile
          </h2>
          {!result ? (
            <div className="h-64 flex flex-col items-center justify-center text-on-surface-variant gap-2">
              <QrCode className="w-10 h-10 opacity-30" />
              <p className="text-sm">Scan a code to see the tourist's profile</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-xl flex-shrink-0">
                  {result.tourist.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-on-surface text-lg truncate">{result.tourist.fullName}</p>
                  <p className="text-sm text-on-surface-variant flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {result.tourist.phone}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-red-600 flex items-center justify-center gap-1">
                    <Droplet className="w-4 h-4" /> {result.tourist.bloodGroup || '—'}
                  </p>
                  <p className="text-xs text-red-600 font-semibold mt-0.5">Blood Group</p>
                </div>
                <div className="bg-surface-container rounded-xl p-3 text-center">
                  <p className="text-sm font-bold text-on-surface">{result.tourist.govtIdType}</p>
                  <p className="text-xs text-on-surface-variant font-mono">•••• {result.tourist.govtIdSuffix}</p>
                </div>
              </div>

              {result.tourist.medicalInfo && (
                <div className="bg-surface-container rounded-xl p-3">
                  <p className="text-xs font-semibold text-on-surface-variant mb-1">Medical Info</p>
                  <p className="text-sm text-on-surface">{result.tourist.medicalInfo}</p>
                </div>
              )}

              {result.activeTrip ? (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-semibold text-on-surface truncate">{result.activeTrip.city || 'Active trip'}</span>
                  </div>
                  {result.activeTrip.tsiLabel && (
                    <span className={cn('text-xs font-bold px-2 py-1 rounded-full flex-shrink-0', TSI_COLOR[result.activeTrip.tsiLabel] || 'bg-slate-100 text-slate-600')}>
                      TSI {result.activeTrip.tsiScore} · {result.activeTrip.tsiLabel}
                    </span>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="text-sm text-amber-700">No active trip on record</span>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-on-surface-variant mb-2">Emergency Contacts ({result.tourist.emergencyContacts.length})</p>
                <div className="space-y-1.5">
                  {result.tourist.emergencyContacts.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-surface-container rounded-lg px-3 py-2">
                      <span className="text-on-surface">{c.name} <span className="text-on-surface-variant">· {c.relation}</span></span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-on-surface-variant font-mono text-xs">{c.phone}</span>
                        {c.verified && <ShieldCheck className="w-3.5 h-3.5 text-green-600" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent scans log */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant mt-6">
        <h2 className="font-bold text-on-surface mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Recent Checkpoint Activity
        </h2>
        {!recentScans || recentScans.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6">No checkpoint scans yet</p>
        ) : (
          <div className="space-y-2">
            {recentScans.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-outline-variant last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-semibold text-on-surface">{s.tourist_name}</span>
                  <span className="text-on-surface-variant">{s.checkpoint_name}{s.district ? ` · ${s.district}` : ''}</span>
                </div>
                <span className="text-xs text-on-surface-variant flex-shrink-0">{formatTimeAgo(s.scanned_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
