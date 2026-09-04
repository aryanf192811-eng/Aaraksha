// src/pages/TrackingPage.tsx — Guardian Portal's only screen.
// Shows: status banner (safe/warning/SOS) -> map -> last checkin time -> TSI -> medical info
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import axios from 'axios'
import { Shield, MapPin, Battery, Clock, RefreshCw, CheckCircle2, Siren, WifiOff, Stethoscope, Link2Off, LocateFixed, Truck, MessageCircle, X, KeyRound, Loader2, Languages } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n/config'
import touristApi from '../api/tourist.api'
import { connectSocket, disconnectSocket } from '../lib/socket'
import { getErrorMessage } from '../api/client'
import { getRoute, haversineMeters, ROUTE_REFETCH_MIN_INTERVAL_MS, ROUTE_REFETCH_MIN_DISTANCE_M, type Route } from '../lib/osrm'
import { MessageThread } from '../components/MessageThread'
import { useDragSheet } from '../hooks/useDragSheet'
import type { GuardianView, Message } from '../types/api.types'

// Fix Leaflet's default marker icon — its bundled asset paths break under
// Vite's bundling, so point at the CDN copies instead (standard workaround).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Straight-line-distance ETAs can land far from the tourist's real access
// road (mountain terrain, or a team based hours away) — collapsing raw
// minutes into d/h/m keeps a large-but-real estimate legible instead of
// reading as a bug ("~5988 min" vs "~4d 3h").
function formatEta(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const totalHours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  if (totalHours < 24) return remMinutes > 0 ? `${totalHours}h ${remMinutes}m` : `${totalHours}h`
  const days = Math.floor(totalHours / 24)
  const remHours = totalHours % 24
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`
}

type StatusType = 'SAFE' | 'SOS' | 'ASSIGNED' | 'WARNING' | 'NO_SIGNAL'

const STATUS_CONFIG: Record<StatusType, {
  banner: string; Icon: typeof CheckCircle2; statusKey: 'safe' | 'sos' | 'assigned' | 'warning' | 'noSignal'; dotColor: string
}> = {
  SAFE: {
    banner:   'bg-green-50 border-b-4 border-green-500',
    Icon:     CheckCircle2,
    statusKey: 'safe',
    dotColor: 'bg-green-500',
  },
  SOS: {
    banner:   'bg-red-500 text-white',
    Icon:     Siren,
    statusKey: 'sos',
    dotColor: 'bg-surface-container-lowest animate-pulse',
  },
  ASSIGNED: {
    banner:   'bg-amber-500 text-white',
    Icon:     Truck,
    statusKey: 'assigned',
    dotColor: 'bg-surface-container-lowest animate-pulse',
  },
  WARNING: {
    banner:   'bg-amber-50 border-b-4 border-amber-500',
    Icon:     Clock,
    statusKey: 'warning',
    dotColor: 'bg-primary',
  },
  NO_SIGNAL: {
    banner:   'bg-surface-container-high border-b-4 border-outline-variant',
    Icon:     WifiOff,
    statusKey: 'noSignal',
    dotColor: 'bg-outline',
  },
}

// Recenter control — the map has no default zoom controls (zoomControl is
// off for this single-purpose view), so this is the only way to return to
// the tourist's location after panning around to look at the area.
function RecenterControl({ center, title }: { center: [number, number]; title: string }) {
  const map = useMap()
  return (
    <button onClick={() => map.flyTo(center, 14)} title={title} aria-label={title}
      className="absolute bottom-14 right-3 z-[1000] w-10 h-10 rounded-full bg-surface-container-lowest shadow-md flex items-center justify-center hover:bg-surface-container active:scale-95 transition-all">
      <LocateFixed className="w-5 h-5 text-on-surface" />
    </button>
  )
}

function getStatus(view: GuardianView | null): StatusType {
  if (!view) return 'NO_SIGNAL'
  if (view.activeSOS) return view.activeSOS.status === 'ASSIGNED' ? 'ASSIGNED' : 'SOS'
  if (!view.location) return 'NO_SIGNAL'
  const lastSeen = new Date(view.location.updatedAt).getTime()
  const ageMin = (Date.now() - lastSeen) / 60000
  if (ageMin > 240) return 'NO_SIGNAL'  // 4 hours no signal
  if (ageMin > 120) return 'WARNING'    // 2 hours warning
  return 'SAFE'
}

// divIcon marker-badge factory for the rescuer — same pattern as the
// checkpoint scanner / Rescuer app, a colored circular badge instead of
// the default pin, distinct from the tourist's own default-icon marker.
const RESCUER_ICON = L.divIcon({
  className: '',
  html: `<div style="background:#0f766e;width:30px;height:30px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid white"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

export default function TrackingPage() {
  const { t, i18n } = useTranslation()
  const { token } = useParams<{ token: string }>()
  // The PIN gates every guardian call now (see migration 028) — entered
  // once per browser tab and cached in sessionStorage so the 30s
  // auto-refresh poll doesn't re-prompt. Cleared the moment the backend
  // rejects it (wrong PIN, or a token whose owner rotated their PIN).
  const [pin, setPin] = useState<string | null>(() => (token ? sessionStorage.getItem(`guardian_pin_${token}`) : null))
  const [pinInput, setPinInput] = useState('')
  const [pinSubmitting, setPinSubmitting] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [view, setView] = useState<GuardianView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [rescuerLivePos, setRescuerLivePos] = useState<[number, number] | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [rescuerNavigating, setRescuerNavigating] = useState(false)
  const [delayed, setDelayed] = useState(false)
  const originalEtaMinRef = useRef<number | null>(null)
  const [showChat, setShowChat] = useState(false)
  const { handleProps: dragHandleProps, sheetStyle: dragSheetStyle } = useDragSheet({ onClose: () => setShowChat(false) })
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)

  // A 401 here always means the cached PIN no longer works (wrong from the
  // start, or the traveler rotated it) — drop it back to the entry screen
  // rather than showing the generic tracking-error state, which otherwise
  // reads as "this link is dead" instead of "re-enter the PIN".
  const isPinRejected = (err: unknown) => axios.isAxiosError(err) && err.response?.status === 401

  const fetchTracking = async (activePin: string) => {
    if (!token) return
    try {
      const res = await touristApi.getGuardianView(token, activePin)
      setView(res.data.data)
      setLastRefresh(new Date())
      setError(null)
    } catch (err) {
      if (isPinRejected(err)) {
        sessionStorage.removeItem(`guardian_pin_${token}`)
        setPin(null)
        setPinError(getErrorMessage(err))
      } else {
        setError(getErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  // Tourist <-> Guardian messaging — always available, not gated on an
  // active SOS. Fetched on-demand when the chat panel opens rather than
  // alongside the 30s tracking poll, since most visits never open it.
  const fetchMessages = async () => {
    if (!token || !pin) return
    setLoadingMessages(true)
    try {
      const res = await touristApi.getGuardianMessages(token, pin)
      setMessages(res.data.data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoadingMessages(false)
    }
  }
  useEffect(() => {
    if (showChat) fetchMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChat])

  const sendMessage = async (body: string) => {
    if (!token || !pin) return
    setSendingMessage(true)
    try {
      const res = await touristApi.sendGuardianMessage(token, pin, body)
      setMessages((prev) => {
        const next = prev ?? []
        return next.some((m) => m.id === res.data.data.id) ? next : [...next, res.data.data]
      })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSendingMessage(false)
    }
  }

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || pinInput.length !== 4) return
    setPinSubmitting(true)
    setPinError(null)
    try {
      const res = await touristApi.getGuardianView(token, pinInput)
      sessionStorage.setItem(`guardian_pin_${token}`, pinInput)
      setView(res.data.data)
      setLastRefresh(new Date())
      setError(null)
      setPin(pinInput)
    } catch (err) {
      if (isPinRejected(err)) {
        setPinError(getErrorMessage(err))
      } else {
        setError(getErrorMessage(err))
      }
    } finally {
      setPinSubmitting(false)
      setLoading(false)
    }
  }

  // Auto-refresh every 30 seconds — only once a verified PIN is cached.
  useEffect(() => {
    if (!pin) { setLoading(false); return }
    fetchTracking(pin)
    const interval = setInterval(() => fetchTracking(pin), 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pin])

  useEffect(() => {
    if (!token) return
    const socket = connectSocket('guardian', token)
    socket.on('GUARDIAN_LOCATION_UPDATE', (data) => {
      setView(prev => prev ? { ...prev, location: { latitude: data.latitude, longitude: data.longitude, batteryPct: data.batteryPct, updatedAt: data.updatedAt } } : prev)
      setLastRefresh(new Date())
    })
    socket.on('GUARDIAN_SOS_ALERT', (data) => {
      setView(prev => prev ? { ...prev, activeSOS: { id: data.sosId, category: data.category, status: 'ACTIVE', createdAt: data.createdAt, handoffVerifiedAt: null, rescueTeam: null, rescuer: null } } : prev)
    })
    socket.on('GUARDIAN_ETA_UPDATE', (data) => {
      setView(prev => (prev && prev.activeSOS) ? {
        ...prev,
        activeSOS: {
          ...prev.activeSOS,
          status: data.status,
          rescueTeam: { name: data.teamName, type: data.teamType, etaMinutes: data.etaMinutes },
        },
      } : prev)
    })
    socket.on('RESCUER_LOCATION_UPDATE', (data: { latitude: number; longitude: number }) => {
      setRescuerLivePos([data.latitude, data.longitude])
    })
    socket.on('RESCUER_NAVIGATING_STATE', (data: { navigating: boolean }) => {
      setRescuerNavigating(data.navigating)
    })
    socket.on('HANDOFF_VERIFIED', (data: { sosId: string; verifiedAt: string }) => {
      setView(prev => (prev && prev.activeSOS && prev.activeSOS.id === data.sosId)
        ? { ...prev, activeSOS: { ...prev.activeSOS, handoffVerifiedAt: data.verifiedAt } }
        : prev)
    })
    socket.on('RESCUER_ASSIGNMENT_CANCELLED', (data: { sosId: string; reason?: string }) => {
      setView(prev => (prev && prev.activeSOS && prev.activeSOS.id === data.sosId)
        ? { ...prev, activeSOS: { ...prev.activeSOS, status: 'ACTIVE', rescueTeam: null, rescuer: null } }
        : prev)
      setRescuerLivePos(null)
      toast.info(t('assigned.rescuerCancelled'), {
        description: data.reason || undefined,
        duration: 10000,
      })
    })
    socket.on('MESSAGE_RECEIVED', (data: Message) => {
      if (data.conversation_type === 'TOURIST_GUARDIAN') {
        setMessages((prev) => (prev && !prev.some((m) => m.id === data.id) ? [...prev, data] : prev))
      }
    })
    return () => { disconnectSocket() }
  }, [token, t])

  const rescuer = view?.activeSOS?.rescuer
  const rescuerPos: [number, number] | null = rescuer
    ? (rescuerLivePos ?? [rescuer.latitude, rescuer.longitude])
    : null
  const touristPos: [number, number] | null = view?.location
    ? [view.location.latitude, view.location.longitude]
    : null

  const lastRouteFetchRef = useRef<{ time: number; lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (!rescuerPos || !touristPos) { setRoute(null); return }
    const now = Date.now()
    const last = lastRouteFetchRef.current
    if (last
      && now - last.time < ROUTE_REFETCH_MIN_INTERVAL_MS
      && haversineMeters(last.lat, last.lng, rescuerPos[0], rescuerPos[1]) < ROUTE_REFETCH_MIN_DISTANCE_M) {
      return
    }
    lastRouteFetchRef.current = { time: now, lat: rescuerPos[0], lng: rescuerPos[1] }
    getRoute(rescuerPos[0], rescuerPos[1], touristPos[0], touristPos[1]).then(setRoute)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescuerPos?.[0], rescuerPos?.[1], touristPos?.[0], touristPos?.[1]])

  const currentEtaMin = route?.durationMin ?? view?.activeSOS?.rescueTeam?.etaMinutes ?? null
  useEffect(() => {
    if (currentEtaMin != null && originalEtaMinRef.current == null) {
      originalEtaMinRef.current = currentEtaMin
    }
    if (!view?.activeSOS) {
      originalEtaMinRef.current = null
      setDelayed(false)
    }
  }, [currentEtaMin, view?.activeSOS])

  useEffect(() => {
    const check = () => {
      if (!view?.activeSOS || view.activeSOS.status !== 'ASSIGNED' || view.activeSOS.handoffVerifiedAt) {
        setDelayed(false)
        return
      }
      const orig = originalEtaMinRef.current
      if (orig == null) return
      if (currentEtaMin != null && currentEtaMin - orig >= 15) {
        setDelayed(true)
        return
      }
      const assignedAt = new Date(view.activeSOS.createdAt).getTime()
      const elapsedMin = (Date.now() - assignedAt) / 60000
      if (elapsedMin > orig + 15) {
        setDelayed(true)
        return
      }
      setDelayed(false)
    }
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [view?.activeSOS?.createdAt, view?.activeSOS?.handoffVerifiedAt, currentEtaMin, view?.activeSOS])

  const status = getStatus(view)
  const statusConfig = STATUS_CONFIG[status]
  const StatusIcon = statusConfig.Icon
  const name = view?.firstName || t('common.defaultTraveler')
  const isUrgent = status === 'SOS' || status === 'ASSIGNED'
  const isSOSActive = status === 'SOS'
  const isAssigned = status === 'ASSIGNED'
  const isVerified = isAssigned && !!view?.activeSOS?.handoffVerifiedAt

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-container-lowest">
        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mb-4 animate-pulse">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <p className="text-on-surface-variant font-medium">{t('common.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-container-lowest px-6 text-center">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-md border border-outline-variant p-8">
          <div className="w-16 h-16 rounded-2xl bg-warning/15 flex items-center justify-center mx-auto mb-5">
            <Link2Off className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-xl font-black text-on-surface mb-2">{error}</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">{t('error.shareNewLink')}</p>
        </div>
      </div>
    )
  }

  if (!pin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-container-lowest px-6 text-center">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-md border border-outline-variant p-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/12 flex items-center justify-center mx-auto mb-5">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-black text-on-surface mb-2">{t('pin.title')}</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
            {t('pin.desc')}
          </p>
          <form onSubmit={submitPin} className="space-y-3">
            <input
              inputMode="numeric" maxLength={4} placeholder={t('pin.placeholder')} autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full h-14 rounded-2xl border border-outline-variant bg-surface-container px-4 text-center text-2xl font-black tracking-[0.5em] tabular-nums focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {pinError && <p className="text-sm text-sos font-semibold">{pinError}</p>}
            <button type="submit" disabled={pinSubmitting || pinInput.length !== 4}
              className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform">
              {pinSubmitting ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : t('pin.unlock')}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      {/* ── Brand header ──────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border-b border-outline-variant px-5 py-3 flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <span className="font-black text-on-surface">{t('brand.title')}</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-on-surface-variant hidden sm:inline">{t('brand.portal')}</span>
          <div className="flex items-center gap-1.5 bg-surface-container rounded-xl px-2.5 py-1 border border-outline-variant text-xs">
            <Languages className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <select
              value={i18n.language ? i18n.language.slice(0, 2) : 'en'}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="bg-transparent text-xs font-bold text-on-surface focus:outline-none cursor-pointer"
              aria-label={t('common.language')}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-surface-container-lowest text-on-surface">
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Status Banner ─────────────────────────────────────── */}
      <div className={`${isVerified ? 'bg-emerald-600 text-white' : statusConfig.banner} ${isUrgent ? 'min-h-[180px]' : 'min-h-[100px]'} px-6 py-6 flex flex-col justify-center`}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${isVerified ? 'bg-white' : statusConfig.dotColor}`} />
          <span className={`text-xs font-bold uppercase tracking-widest ${isUrgent ? 'text-white/80' : 'text-on-surface-variant'}`}>
            {isVerified ? t('status.confirmed.badge') : t(`status.${statusConfig.statusKey}.badge`)}
          </span>
        </div>
        <h1 className={`flex items-center gap-2.5 text-3xl font-black leading-tight ${isUrgent ? 'text-white' : 'text-on-surface'}`}>
          {isVerified ? <CheckCircle2 className="w-7 h-7 flex-shrink-0" /> : <StatusIcon className="w-7 h-7 flex-shrink-0" />}
          {isVerified ? t('status.confirmed.headline', { name }) : t(`status.${statusConfig.statusKey}.headline`, { name })}
        </h1>
        <p className={`text-sm mt-1 ${isUrgent ? 'text-white/80' : 'text-on-surface-variant'}`}>
          {isVerified ? t('status.confirmed.sub') : t(`status.${statusConfig.statusKey}.sub`)}
        </p>
        {isSOSActive && view?.activeSOS && (
          <div className="mt-3 bg-red-600 rounded-xl px-4 py-2">
            <p className="text-white text-sm font-bold">
              {t('sos.category', { category: t(`enums.sosCategory.${view.activeSOS.category}`, { defaultValue: view.activeSOS.category }) })}
            </p>
            <p className="text-red-100 text-xs">
              {t('sos.triggeredAt', { time: new Date(view.activeSOS.createdAt).toLocaleTimeString('en-IN') })}
            </p>
          </div>
        )}
        {isAssigned && view?.activeSOS && (
          <div className={`mt-3 rounded-xl px-4 py-2 ${isVerified ? 'bg-emerald-700' : 'bg-amber-600'}`}>
            <p className="text-white text-sm font-bold flex items-center gap-1.5">
              {isVerified ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <Truck className="w-4 h-4 flex-shrink-0" />}
              {isVerified
                ? t('assigned.verifiedBy', { name: rescuer?.name ?? view.activeSOS.rescueTeam?.name ?? t('assigned.defaultTeam') })
                : t('assigned.dispatched', { name: rescuer?.name ?? view.activeSOS.rescueTeam?.name ?? t('assigned.defaultTeam') })}
            </p>
            <p className={`text-xs ${isVerified ? 'text-emerald-100' : 'text-amber-100'}`}>
              {rescuer?.kind === 'VOLUNTEER' ? t('assigned.volunteerPrefix') : view.activeSOS.rescueTeam?.type ? `${view.activeSOS.rescueTeam.type} · ` : ''}
              {isVerified
                ? (view.activeSOS.handoffVerifiedAt
                    ? t('assigned.confirmedAt', { time: new Date(view.activeSOS.handoffVerifiedAt).toLocaleTimeString('en-IN') })
                    : t('assigned.confirmed'))
                : route ? t('assigned.eta', { eta: formatEta(Math.round(route.durationMin)) })
                : view.activeSOS.rescueTeam?.etaMinutes != null ? t('assigned.eta', { eta: formatEta(view.activeSOS.rescueTeam.etaMinutes) }) : t('assigned.onTheWay')}
              {!isVerified && rescuerNavigating && t('assigned.navigating')}
            </p>
          </div>
        )}
        {isAssigned && !isVerified && delayed && (
          <div className="mt-2 bg-white/15 rounded-xl px-4 py-2">
            <p className="text-white text-xs leading-snug">
              {t('assigned.delayedTitle')}{' '}
              <button onClick={() => setShowChat(true)} className="font-bold underline">
                {t('assigned.delayedAction')}
              </button>
            </p>
          </div>
        )}
      </div>

      {/* ── Live Map ──────────────────────────────────────────── */}
      {view?.location ? (
        <div className="h-[40vh] relative">
          <MapContainer
            center={[view.location.latitude, view.location.longitude]}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
            />
            {isUrgent && (
              <Circle
                center={[view.location.latitude, view.location.longitude]}
                radius={500}
                color={isVerified ? '#059669' : isAssigned ? '#f59e0b' : '#ef4444'}
                fillColor={isVerified ? '#059669' : isAssigned ? '#f59e0b' : '#ef4444'} fillOpacity={0.15}
              />
            )}
            <Marker position={[view.location.latitude, view.location.longitude]}>
              <Popup>
                <div className="text-center">
                  <p className="font-bold">{name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {t('map.lastSeen', { time: new Date(view.location.updatedAt).toLocaleTimeString('en-IN') })}
                  </p>
                </div>
              </Popup>
            </Marker>
            {isAssigned && rescuerPos && (
              <>
                <Polyline
                  positions={route?.coordinates ?? [rescuerPos, [view.location.latitude, view.location.longitude]]}
                  pathOptions={route ? { color: '#0f766e', weight: 4, opacity: 0.9 } : { color: '#94a3b8', weight: 3, opacity: 0.6, dashArray: '2 6' }}
                />
                <Marker position={rescuerPos} icon={RESCUER_ICON}>
                  <Popup>
                    <div className="text-center">
                      <p className="font-bold">{rescuer?.name}</p>
                      <p className="text-xs text-on-surface-variant">{rescuer?.isLive ? t('map.livePosition') : t('map.dispatchBase')}</p>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}
            <RecenterControl center={[view.location.latitude, view.location.longitude]} title={t('map.recenter')} />
          </MapContainer>
          <a
            href={`https://maps.google.com/?q=${view.location.latitude},${view.location.longitude}`}
            target="_blank" rel="noopener noreferrer"
            className="absolute bottom-3 right-3 bg-surface-container-lowest rounded-lg shadow-md px-3 py-1.5 text-xs font-semibold text-on-surface flex items-center gap-1"
          >
            <MapPin className="w-3 h-3 text-red-500" /> {t('map.openInMaps')}
          </a>
        </div>
      ) : (
        <div className="h-[200px] bg-surface-container-high flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-outline-variant/60 flex items-center justify-center mx-auto mb-2">
              <MapPin className="w-6 h-6 text-on-surface-variant" />
            </div>
            <p className="text-sm text-on-surface-variant">{t('map.locationNotAvailable')}</p>
          </div>
        </div>
      )}

      {/* ── Info Cards ────────────────────────────────────────── */}
      <div className="px-5 py-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: <Clock className="w-5 h-5 text-amber-500" />,
              label: t('cards.lastSeen'),
              value: view?.location?.updatedAt
                ? new Date(view.location.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                : t('cards.unknown'),
            },
            {
              icon: <Battery className={`w-5 h-5 ${(view?.location?.batteryPct ?? 100) < 20 ? 'text-red-500' : 'text-green-500'}`} />,
              label: t('cards.battery'),
              value: view?.location?.batteryPct !== null && view?.location?.batteryPct !== undefined
                ? `${view.location.batteryPct}%` : '—',
            },
            {
              icon: <MapPin className="w-5 h-5 text-blue-500" />,
              label: t('cards.destination'),
              value: view?.activeTripCity || '—',
            },
          ].map(({ icon, label, value }) => (
            <div key={label} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm text-center border border-outline-variant">
              <div className="flex justify-center mb-1">{icon}</div>
              <p className="text-xs text-on-surface-variant font-medium">{label}</p>
              <p className="font-bold text-on-surface text-sm mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>

        {view?.tsiScore !== null && view?.tsiScore !== undefined && (
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant flex items-center gap-4">
            <div>
              <p className="text-xs text-on-surface-variant font-medium mb-1">{t('cards.tsi')}</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-on-surface">{view.tsiScore}/100</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  view.tsiScore >= 80 ? 'bg-green-100 text-green-700' :
                  view.tsiScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  view.tsiScore >= 40 ? 'bg-orange-100 text-orange-700' :
                                         'bg-red-100 text-red-700'
                }`}>{t(`enums.tsiLabel.${view.tsiLabel}`, { defaultValue: view.tsiLabel })}</span>
              </div>
            </div>
          </div>
        )}

        {(view?.bloodGroup || view?.medicalInfo) && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
            <p className="flex items-center gap-1.5 text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
              <Stethoscope className="w-3.5 h-3.5" /> {t('cards.medicalInfo')}
            </p>
            {view?.bloodGroup && <p className="text-sm text-on-surface">{t('cards.bloodGroup')} <strong>{view.bloodGroup}</strong></p>}
            {view?.medicalInfo && <p className="text-sm text-on-surface-variant mt-1">{view.medicalInfo}</p>}
          </div>
        )}

        <button onClick={() => setShowChat(true)}
          className="w-full h-12 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform">
          <MessageCircle className="w-4.5 h-4.5" /> {t('cards.messageTraveler', { name })}
        </button>

        <div className="flex items-center justify-center gap-2 py-4">
          <RefreshCw className="w-3.5 h-3.5 text-on-surface-variant" />
          <p className="text-xs text-on-surface-variant">
            {t('cards.autoRefresh', { time: lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-10 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm text-on-surface-variant">{t('brand.tagline')}</span>
        </div>
      </div>

      {showChat && (
        <div className="fixed inset-0 z-[1100] flex items-end sm:items-center sm:justify-center bg-black/40" onClick={() => setShowChat(false)}>
          <div onClick={(e) => e.stopPropagation()} style={dragSheetStyle}
            className="w-full sm:w-[420px] sm:rounded-3xl bg-white rounded-t-3xl shadow-2xl h-[70vh] max-h-[560px] flex flex-col overflow-hidden">
            <div {...dragHandleProps} className="flex-shrink-0 pt-2.5 pb-1 flex justify-center">
              <div className="w-10 h-1 bg-outline-variant rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 border-b border-outline-variant flex-shrink-0">
              <p className="flex items-center gap-2 font-bold text-on-surface">
                <span className="w-2 h-2 rounded-full bg-safe flex-shrink-0" />
                {name}
              </p>
              <button onClick={() => setShowChat(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container">
                <X className="w-4 h-4 text-on-surface-variant" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <MessageThread messages={messages ?? undefined} isLoading={loadingMessages} onSend={sendMessage} sending={sendingMessage} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
