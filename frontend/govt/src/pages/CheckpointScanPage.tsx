// src/pages/CheckpointScanPage.tsx
// Deliberately NOT rendered inside GovtLayout's desktop sidebar shell — a
// checkpoint officer standing at an ILP post uses this from a phone
// browser, not a 256px-sidebar ops dashboard meant for a desk. This page
// gets its own compact mobile-first header instead, and is reachable
// standalone at /checkpoint so it can be bookmarked or added to a phone's
// home screen. Access is gated to the roles that actually staff a
// checkpoint (see ALLOWED_CHECKPOINT_ROLES) — the real enforcement is
// server-side (requireGovtRole on POST /govt/checkpoint/scan); this check
// is just so a DISTRICT_ADMIN/MEDICAL account sees a clear explanation
// instead of a scan form that would fail with 403 on submit.
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { QrCode, Loader2, Droplet, Phone, ShieldCheck, MapPin, Clock, AlertTriangle, ScanLine, LogOut, Lock, Camera, Keyboard, LocateFixed, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { QRScanner } from '../components/QRScanner'
import govtApi, { type CheckpointScanResult } from '../api/govt.api'
import { useAuthStore } from '../store/auth.store'
import { formatTimeAgo, cn } from '../lib/utils'

export const ALLOWED_CHECKPOINT_ROLES = ['SUPER_ADMIN', 'POLICE', 'TOURISM_OFFICER', 'CHECKPOINT_OFFICER']

const TSI_COLOR: Record<string, string> = {
  SAFE: 'text-emerald-600 bg-emerald-100', MODERATE: 'text-amber-600 bg-amber-100',
  RISKY: 'text-orange-600 bg-orange-100', EXTREME: 'text-red-600 bg-red-100',
}

type GeoStatus = 'locating' | 'found' | 'denied' | 'unavailable'

export default function CheckpointScanPage() {
  const navigate = useNavigate()
  const { govtUser, logout } = useAuthStore()
  const [token, setToken] = useState('')
  const [checkpointName, setCheckpointName] = useState('')
  const [district, setDistrict] = useState('')
  const [result, setResult] = useState<CheckpointScanResult | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('locating')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  const authorized = !!govtUser && ALLOWED_CHECKPOINT_ROLES.includes(govtUser.role)

  // The whole point: an officer opens this page and it's already ready to
  // scan — no typing a checkpoint name or district by hand. GPS gives the
  // coordinates; Nominatim (OpenStreetMap's free reverse-geocoder, same
  // provider the live map already uses) turns that into a readable name.
  // Reverse geocoding is best-effort — a failure there still leaves the raw
  // coordinates usable, and the fields stay editable either way.
  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('unavailable')
      return
    }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCoords({ lat, lng })
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14`)
          const data = await res.json()
          const addr = data.address || {}
          const place = addr.village || addr.town || addr.suburb || addr.city || addr.county
            || (typeof data.display_name === 'string' ? data.display_name.split(',')[0] : null)
          setCheckpointName(place ? `${place} Checkpoint` : `Checkpoint @ ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
          setDistrict(addr.state_district || addr.county || addr.city_district || '')
        } catch {
          setCheckpointName(`Checkpoint @ ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        }
        setGeoStatus('found')
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    )
  }, [])

  useEffect(() => {
    if (authorized) locate()
  }, [authorized, locate])

  const { data: recentScans } = useQuery({
    queryKey: ['govt', 'checkpoint', 'recent'],
    queryFn: () => govtApi.getRecentCheckpointScans(15).then(r => r.data.data),
    refetchInterval: 20_000,
    enabled: authorized,
  })

  // Takes the token explicitly rather than reading it from state — the
  // camera scanner detects a code and needs to submit it immediately in
  // the same tick, before a setState from onDetected would have flushed.
  const { mutate: scan, isPending: scanning } = useMutation({
    mutationFn: (scannedToken: string) =>
      govtApi.scanCheckpoint({
        token: scannedToken,
        checkpointName: checkpointName.trim(),
        district: district.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
      }),
    onSuccess: (res) => {
      setResult(res.data.data)
      setToken('')
      toast.success(`${res.data.data.tourist.fullName} checked in at ${checkpointName}`)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Scan failed — check the code and try again'),
  })

  const checkpointNameValid = checkpointName.trim().length >= 2
  const canScan = token.trim().length > 0 && checkpointNameValid && !scanning

  const handleOpenScanner = () => {
    if (!checkpointNameValid) {
      toast.error('Enter the checkpoint name first')
      return
    }
    setShowScanner(true)
  }

  const handleDetected = (data: string) => {
    setShowScanner(false)
    scan(data)
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Compact mobile-first header — no sidebar, big tap targets, safe-area-aware */}
      <header className="sticky top-0 z-30 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <ScanLine className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-on-surface leading-tight">Checkpoint Scan</h1>
            <p className="text-xs text-on-surface-variant truncate">{govtUser?.name} · {govtUser?.role.replace('_', ' ')}</p>
          </div>
        </div>
        <button onClick={handleLogout} aria-label="Sign out"
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container flex-shrink-0">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {!authorized ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center">
            <Lock className="w-6 h-6 text-on-surface-variant" />
          </div>
          <h2 className="font-bold text-on-surface">Not available for your role</h2>
          <p className="text-sm text-on-surface-variant max-w-xs">
            Checkpoint scanning is limited to on-ground staff (Police, Tourism Officer) and Super Admins.
            {govtUser ? ` Your role is ${govtUser.role.replace('_', ' ')}.` : ''}
          </p>
          <Button variant="outline" onClick={() => navigate('/')} className="mt-2 rounded-full">Back to Dashboard</Button>
        </div>
      ) : (
        <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
          {/* Scan form */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 border border-outline-variant">
            <h2 className="font-bold text-on-surface mb-3 flex items-center gap-2 text-sm">
              <QrCode className="w-4 h-4" /> Scan Tourist
            </h2>
            <div className="space-y-3">
              {/* Auto-detect status — this is the whole point: an officer
                  shouldn't have to type anything to start scanning. */}
              <div className={cn(
                'flex items-center gap-2 text-xs font-semibold rounded-lg px-3 py-2',
                geoStatus === 'found' && 'bg-emerald-50 text-emerald-700',
                geoStatus === 'locating' && 'bg-surface-container text-on-surface-variant',
                (geoStatus === 'denied' || geoStatus === 'unavailable') && 'bg-amber-50 text-amber-700'
              )}>
                {geoStatus === 'locating' && <><Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /> Detecting checkpoint location…</>}
                {geoStatus === 'found' && <><LocateFixed className="w-3.5 h-3.5 flex-shrink-0" /> Location auto-filled from GPS</>}
                {geoStatus === 'denied' && <><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Location permission denied — enter manually</>}
                {geoStatus === 'unavailable' && <><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Location not supported — enter manually</>}
                {geoStatus !== 'locating' && (
                  <button type="button" onClick={locate} className="ml-auto flex items-center gap-1 hover:underline flex-shrink-0">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Checkpoint Name *</label>
                <Input value={checkpointName} onChange={(e) => setCheckpointName(e.target.value)} placeholder="e.g. Dimapur ILP Checkpost" className="h-12 text-base" />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant mb-1 block">District</label>
                <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Dimapur" className="h-12 text-base" />
              </div>

              <Button onClick={handleOpenScanner} disabled={scanning}
                className="w-full h-14 bg-primary hover:brightness-95 text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 text-base">
                {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                {scanning ? 'Verifying...' : 'Scan with Camera'}
              </Button>

              {!showManualEntry ? (
                <button type="button" onClick={() => setShowManualEntry(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface py-2">
                  <Keyboard className="w-3.5 h-3.5" /> Enter code manually instead
                </button>
              ) : (
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Scanned Code</label>
                  <Input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste the tourist's QR token"
                    className="font-mono text-xs h-12"
                  />
                  <Button onClick={() => scan(token.trim())} disabled={!canScan} variant="outline"
                    className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                    {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {scanning ? 'Verifying...' : 'Submit Code'}
                  </Button>
                </div>
              )}

              <p className="text-xs text-on-surface-variant">Codes expire 5 minutes after the tourist generates them — ask them to refresh if the scan fails.</p>
            </div>
          </div>

          {showScanner && (
            <QRScanner onDetected={handleDetected} onClose={() => setShowScanner(false)} />
          )}

          {/* Result card */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 border border-outline-variant">
            <h2 className="font-bold text-on-surface mb-3 flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4" /> Tourist Profile
            </h2>
            {!result ? (
              <div className="h-40 flex flex-col items-center justify-center text-on-surface-variant gap-2">
                <QrCode className="w-9 h-9 opacity-30" />
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
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-between gap-2">
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

          {/* Recent scans log */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 border border-outline-variant">
            <h2 className="font-bold text-on-surface mb-3 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" /> Recent Checkpoint Activity
            </h2>
            {!recentScans || recentScans.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-6">No checkpoint scans yet</p>
            ) : (
              <div className="space-y-2">
                {recentScans.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-outline-variant last:border-0 gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-on-surface truncate">{s.tourist_name}</span>
                      <span className="text-on-surface-variant text-xs truncate">{s.checkpoint_name}{s.district ? ` · ${s.district}` : ''}</span>
                    </div>
                    <span className="text-xs text-on-surface-variant flex-shrink-0">{formatTimeAgo(s.scanned_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
