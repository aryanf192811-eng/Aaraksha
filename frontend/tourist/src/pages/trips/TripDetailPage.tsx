// src/pages/trips/TripDetailPage.tsx
// Full-bleed destination-photo hero, floating glass TSI/status badges, and
// photo-thumbnail itinerary stops — the "listing detail" language used
// across the redesigned tourist PWA.
import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Share2, Download, Map, List, Package, FileText, AlertTriangle,
  Rocket, Sparkles, RefreshCw, Loader2, Check, Lightbulb, HeartPulse, Backpack, LocateFixed,
  Users, Copy, LogOut, Clock, Newspaper, ChevronDown, Plus, Trash2, Wallet, MapPin, CheckCircle2,
  MoreVertical, Ban,
} from 'lucide-react'
import { toast } from 'sonner'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../../components/ui/dropdown-menu'
import { TSIBadge, EmptyState, PageSkeleton, NewsFeed, TSIBreakdown, JourneyRiskGraph, SafetyAdvisory, DestinationSearchField, ConfirmDialog } from '../../components/shared'
import { StopDetailSheet } from '../../components/shared/StopDetailSheet'
import tripApi from '../../api/trip.api'
import packingApi from '../../api/packing.api'
import passportApi from '../../api/passport.api'
import newsApi from '../../api/news.api'
import { queryClient } from '../../lib/queryClient'
import { useAuthStore } from '../../store/auth.store'
import { formatDate, formatINR, formatTimeAgo, cn } from '../../lib/utils'
import { tEnum } from '../../lib/i18nEnums'
import { TRIP_STATUSES, ACTIVITY_TYPES } from '../../constants/enums'
import { getDestinationImage } from '../../lib/destinationImages'
import type { Stop, Activity, PackingItem } from '../../types/api.types'

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  TRANSPORT: '#3b82f6', STAY: '#8b5cf6', ACTIVITY: '#10b981', MEAL: '#f59e0b', OTHER: '#94a3b8',
}

const STATUS_STYLES: Record<string, string> = {
  PLANNED:   'bg-slate-900/60 text-white',
  ACTIVE:    'bg-tsi-low/90 text-white',
  COMPLETED: 'bg-trust/90 text-white',
  CANCELLED: 'bg-sos/90 text-white',
}

type TabType = 'itinerary' | 'budget' | 'packing' | 'map' | 'group' | 'news'
const VALID_TABS: TabType[] = ['itinerary', 'budget', 'packing', 'map', 'group', 'news']

// Recenter control — resets a panned/zoomed map back to fit every stop,
// the way a navigation app's "recenter" button returns to your route.
function RecenterControl({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  const recenter = () => {
    if (coords.length === 1) map.flyTo(coords[0], 12)
    else map.flyToBounds(coords, { padding: [40, 40] })
  }
  return (
    <button onClick={recenter} title="Recenter map" aria-label="Recenter map"
      className="absolute bottom-4 right-4 z-[1000] w-10 h-10 rounded-full bg-white shadow-glass border border-outline-variant flex items-center justify-center hover:bg-surface-container active:scale-95 transition-all">
      <LocateFixed className="w-5 h-5 text-on-surface" />
    </button>
  )
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const tourist = useAuthStore((s) => s.tourist)
  // Deep-linkable via ?tab= — Dashboard's "Latest Alerts" View All used to
  // always land on the default Itinerary tab regardless of intent (the tab
  // was plain useState with no URL awareness), so clicking it from the
  // alerts card looked like a broken link straight into trip planning.
  const [searchParams] = useSearchParams()
  const initialTab = VALID_TABS.includes(searchParams.get('tab') as TabType)
    ? (searchParams.get('tab') as TabType) : 'itinerary'
  const [tab, setTab] = useState<TabType>(initialTab)
  const [showTSIDetails, setShowTSIDetails] = useState(false)

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trips', id],
    queryFn: () => tripApi.getTripById(id!).then(r => r.data.data),
    enabled: !!id,
  })

  const isOwner = !!trip && trip.tourist_id === tourist?.id

  const { data: groupData } = useQuery({
    queryKey: ['trips', id, 'members'],
    queryFn: () => tripApi.getTripMembers(id!).then(r => r.data.data),
    enabled: !!id && tab === 'group',
  })

  const { data: newsItems } = useQuery({
    queryKey: ['trips', id, 'news'],
    queryFn: () => newsApi.getForTrip(id!).then(r => r.data.data),
    enabled: !!id,
    staleTime: 2 * 60_000,
  })

  const { mutate: generateInvite, isPending: generatingInvite } = useMutation({
    mutationFn: () => tripApi.getInviteCode(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips', id] }),
  })

  const { mutate: copyInviteCode } = useMutation({
    mutationFn: async () => {
      const code = trip?.invite_code || (await tripApi.getInviteCode(id!)).data.data.inviteCode
      await navigator.clipboard.writeText(code)
      return code
    },
    onSuccess: () => {
      toast.success(t('tripDetail.toastInviteCopied'))
      queryClient.invalidateQueries({ queryKey: ['trips', id] })
    },
  })

  const { mutate: leaveTrip, isPending: leaving } = useMutation({
    mutationFn: () => tripApi.leaveTrip(id!),
    onSuccess: () => {
      toast.success(t('tripDetail.toastLeftGroup'))
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      navigate('/trips')
    },
  })

  const { mutate: generatePacking, isPending: generatingPacking } = useMutation({
    mutationFn: () => packingApi.generate(id!),
    onSuccess: () => { toast.success(t('tripDetail.toastPackingGenerated')); queryClient.invalidateQueries({ queryKey: ['trips', id] }) },
  })

  const { mutate: activateTrip, isPending: activating } = useMutation({
    mutationFn: () => tripApi.updateTripStatus(id!, { status: 'ACTIVE' }),
    onSuccess: () => { toast.success(t('tripDetail.toastTripActivated')); queryClient.invalidateQueries({ queryKey: ['trips'] }) },
  })

  // Cancel keeps the trip and its history (SOS events, check-ins, E-FIRs
  // filed on it all survive — see the trips FK design) but marks it as no
  // longer a live plan. Delete is the genuinely destructive option, only
  // ever reachable through the confirm dialog below.
  const [confirmCancelTrip, setConfirmCancelTrip] = useState(false)
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState(false)

  const { mutate: cancelTrip, isPending: cancelling } = useMutation({
    mutationFn: () => tripApi.updateTripStatus(id!, { status: 'CANCELLED' }),
    onSuccess: () => {
      toast.success(t('tripDetail.toastTripCancelled'))
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      setConfirmCancelTrip(false)
    },
    onError: () => toast.error(t('tripDetail.toastTripCancelFailed')),
  })

  const { mutate: removeTrip, isPending: deletingTrip } = useMutation({
    mutationFn: () => tripApi.deleteTrip(id!),
    onSuccess: () => {
      toast.success(t('tripDetail.toastTripDeleted'))
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      navigate('/trips')
    },
    onError: () => toast.error(t('tripDetail.toastTripDeleteFailed')),
  })

  // Direct navigation, not an axios blob fetch — see passport.api.ts for why.
  const handleDownloadPassport = () => {
    window.location.href = passportApi.getDownloadUrl(id!)
    toast.success(t('tripDetail.toastPreparingPassport'))
  }

  const { mutate: togglePackedItem } = useMutation({
    mutationFn: (items: PackingItem[]) => tripApi.updateChecklist(id!, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips', id] }),
  })

  // Single write path for every itinerary/expense edit below (add/remove a
  // stop, add/remove an activity) — a full replace of trip.stops via the
  // PUT /trips/:id the backend already validates and accepts. The budget
  // tab's pie chart / total-vs-budget bar / over-budget badge are already
  // wired to read live from stops[].activities[].cost (see budgetByType
  // below) — they were empty for every real trip only because nothing ever
  // wrote to this array after trip creation. This closes that gap.
  const { mutate: saveStops, isPending: savingStops } = useMutation({
    mutationFn: (nextStops: Stop[]) => tripApi.updateTrip(id!, { stops: nextStops }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trips', id] }) },
    onError: () => toast.error(t('tripDetail.toastStopsUpdateFailed')),
  })

  const [addStopOpen, setAddStopOpen] = useState(false)
  const [addActivityForStop, setAddActivityForStop] = useState<number | null>(null)
  const [expenseStopIdx, setExpenseStopIdx] = useState<number | null>(null)
  // Deleting a stop drops every activity/cost logged under it, and
  // deleting an activity removes real logged spend from the budget total —
  // both confirmed before firing, not fired straight from the trash icon.
  const [confirmDeleteStop, setConfirmDeleteStop] = useState<number | null>(null)
  const [confirmDeleteActivity, setConfirmDeleteActivity] = useState<{ stopIdx: number; activityIdx: number } | null>(null)
  const [detailStopIdx, setDetailStopIdx] = useState<number | null>(null)
  const [markVisitedIdx, setMarkVisitedIdx] = useState<number | null>(null)

  const addStop = (stop: Stop) => {
    saveStops([...(trip?.stops ?? []), stop])
    setAddStopOpen(false)
  }
  const removeStop = (idx: number) => {
    saveStops((trip?.stops ?? []).filter((_, i) => i !== idx))
    setConfirmDeleteStop(null)
  }
  const addActivity = (stopIdx: number, activity: Activity) => {
    const next = (trip?.stops ?? []).map((s, i) => i === stopIdx ? { ...s, activities: [...s.activities, activity] } : s)
    saveStops(next)
    setAddActivityForStop(null)
    setExpenseStopIdx(null)
  }
  const removeActivity = (stopIdx: number, activityIdx: number) => {
    const next = (trip?.stops ?? []).map((s, i) => i === stopIdx ? { ...s, activities: s.activities.filter((_, ai) => ai !== activityIdx) } : s)
    saveStops(next)
    setConfirmDeleteActivity(null)
  }
  // Pre-fill is an honest estimate (even share of the total planned
  // budget), never a claim of a known real cost -- there's no bank/UPI
  // integration behind this. Editable before confirming.
  const markVisited = (stopIdx: number, actualCostInr: number) => {
    const next = (trip?.stops ?? []).map((s, i) => i === stopIdx ? { ...s, status: 'DONE' as const, actualCostInr } : s)
    saveStops(next)
    setMarkVisitedIdx(null)
  }

  const handleShare = async () => {
    if (!trip?.is_public || !trip.public_token) {
      toast.info(t('tripDetail.toastEnablePublicSharing'))
      return
    }
    const url = `${window.location.origin}/community/${trip.public_token}`
    await navigator.clipboard.writeText(url)
    toast.success(t('tripDetail.toastTripLinkCopied'))
  }

  if (isLoading) return <div className="min-h-screen bg-surface"><PageSkeleton /></div>
  if (!trip) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-5">
        <EmptyState icon={Map} title={t('tripDetail.tripNotFoundTitle')} description={t('tripDetail.tripNotFoundDesc')}
          boxed className="w-full max-w-sm"
          action={<Button onClick={() => navigate('/trips')} className="rounded-full">{t('tripDetail.backToTrips')}</Button>} />
      </div>
    )
  }

  const stops: Stop[] = Array.isArray(trip.stops) ? trip.stops : []
  const checklist: PackingItem[] = Array.isArray(trip.packing_checklist) ? trip.packing_checklist : []
  const mapCoords = stops.filter(s => s.lat != null && s.lng != null).map(s => [s.lat!, s.lng!] as [number, number])
  const heroCity = stops[0]?.city

  // Budget breakdown from activities
  const budgetByType: Record<string, number> = {}
  stops.forEach(stop => {
    stop.activities.forEach(a => {
      budgetByType[a.type || 'OTHER'] = (budgetByType[a.type || 'OTHER'] || 0) + (a.cost || 0)
    })
  })
  const budgetData = Object.entries(budgetByType).map(([name, value]) => ({ name, value }))
  const totalCost = Object.values(budgetByType).reduce((s, v) => s + v, 0)

  const budgetPct = trip.budget_inr ? Math.min(100, Math.round((totalCost / trip.budget_inr) * 100)) : null

  const doneStops = stops.filter(s => s.status === 'DONE')
  const spentSoFar = doneStops.reduce((sum, s) => sum + (s.actualCostInr || 0), 0)
  const nextStopIdx = stops.findIndex(s => s.status !== 'DONE')

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Hero — full-bleed destination photo, rounded into a "card" at the
          bottom edge, with a floating liquid-glass toolbar capsule over it. */}
      <div className="relative h-80 sm:h-96 rounded-b-[32px] overflow-hidden shadow-glass-lg">
        <img src={getDestinationImage(heroCity, { w: 1600, q: 82 })} alt={heroCity || trip.title}
          className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/35" />

        <div className="relative flex items-center justify-between px-5 pt-12">
          <button onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-glass hover:bg-white/30 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-1 bg-white/20 backdrop-blur-xl border border-white/30 rounded-full p-1.5 shadow-glass">
            <button onClick={handleShare} title="Share trip"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
            {trip.status === TRIP_STATUSES.COMPLETED && (
              <button onClick={handleDownloadPassport} title="Download Journey Passport"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                <Download className="w-4 h-4" />
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button title={t('tripDetail.moreOptions')}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {trip.status !== TRIP_STATUSES.CANCELLED && trip.status !== TRIP_STATUSES.COMPLETED && (
                  <DropdownMenuItem onClick={() => setConfirmCancelTrip(true)}>
                    <Ban className="w-4 h-4" /> {t('tripDetail.cancelTrip')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmDeleteTrip(true)}>
                  <Trash2 className="w-4 h-4" /> {t('tripDetail.deleteTrip')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="relative px-5 pt-10 pb-8">
          <span className={cn('inline-block text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xl mb-3', STATUS_STYLES[trip.status] || STATUS_STYLES.PLANNED)}>
            {tEnum(t, 'tripStatus', trip.status)}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-[1.05] drop-shadow-md">{trip.title}</h1>
          <p className="text-sm text-white/80 mt-2">{formatDate(trip.start_date)} → {formatDate(trip.end_date)}</p>
        </div>
      </div>

      {/* Bento stat grid, overlapping the hero's rounded bottom edge */}
      <div className="relative px-5 -mt-10 space-y-3">
        <div className="bg-surface-container-lowest rounded-3xl shadow-glass-lg p-4 flex items-center gap-4 transition-shadow">
          <TSIBadge score={trip.tsi_score} label={trip.tsi_label} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-on-surface-variant">{t('tripDetail.tsiIndexLabel')}</p>
            <p className="text-sm font-bold text-on-surface mt-0.5">{trip.tsi_label || t('tripDetail.notCalculatedYet')}</p>
          </div>
          {trip.status === TRIP_STATUSES.PLANNED && (
            <Button size="sm" onClick={() => activateTrip()} disabled={activating}
              className="bg-primary hover:brightness-95 text-on-surface rounded-full text-xs px-3 py-1 font-bold flex items-center gap-1 flex-shrink-0">
              {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />} {t('tripDetail.activate')}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
              <Map className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-black text-on-surface leading-none">{stops.length}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">{t('tripDetail.stopCount', { count: stops.length })} · {tEnum(t, 'travelType', trip.travel_type)}</p>
            </div>
          </div>
          <div className="col-span-2 bg-surface-container-lowest rounded-3xl shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">{t('tripDetail.budget')}</p>
              {budgetPct != null && (
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                  budgetPct >= 100 ? 'bg-sos/10 text-sos-dark' : budgetPct >= 85 ? 'bg-primary/15 text-primary-dark' : 'bg-tsi-low/10 text-tsi-low'
                )}>
                  {budgetPct >= 100 ? t('tripDetail.overBudget') : budgetPct >= 85 ? t('tripDetail.nearingLimit') : t('tripDetail.onTrack')}
                </span>
              )}
            </div>
            <p className="text-lg font-black text-on-surface leading-none">
              {formatINR(totalCost)}
              {trip.budget_inr && <span className="text-xs font-medium text-on-surface-variant"> / {formatINR(trip.budget_inr)}</span>}
            </p>
            {budgetPct != null && (
              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mt-2.5">
                <div className={cn('h-full rounded-full transition-all duration-700',
                  budgetPct >= 100 ? 'bg-sos' : budgetPct >= 85 ? 'bg-primary' : 'bg-tsi-low'
                )} style={{ width: `${budgetPct}%` }} />
              </div>
            )}
          </div>
        </div>

        {trip.tsi_recommendations.length > 0 && trip.tsi_score !== null && trip.tsi_score < 70 && (
          <div className="bg-tsi-high/10 border border-tsi-high/25 rounded-2xl p-3">
            <p className="text-xs font-bold text-tsi-high mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {t('tripDetail.safetyRecommendations')}
            </p>
            {trip.tsi_recommendations.slice(0, 2).map((r, i) => (
              <p key={i} className="text-xs text-tsi-high">• {r}</p>
            ))}
          </div>
        )}

        {trip.tsi_score !== null && <SafetyAdvisory tripId={id!} />}

        {trip.tsi_score !== null && (
          <div>
            <button onClick={() => setShowTSIDetails(v => !v)}
              className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant hover:text-on-surface py-1 transition-colors">
              <span className="flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> {t('tripDetail.whyThisScore')}</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', showTSIDetails && 'rotate-180')} />
            </button>
            {showTSIDetails && (
              <div className="space-y-3 mt-2 animate-slide-up">
                <TSIBreakdown score={trip.tsi_score} label={trip.tsi_label || ''} factors={trip.tsi_factors} />
                {trip.tsi_factors.stopRisks && <JourneyRiskGraph stopRisks={trip.tsi_factors.stopRisks} />}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation — glass pill row */}
      <div className="sticky top-0 z-10 bg-surface-container/80 backdrop-blur-xl px-5 mt-5 pb-1 flex gap-1.5 overflow-x-auto">
        {([
          { key: 'itinerary' as TabType, icon: List, labelKey: 'tripDetail.tabItinerary' },
          { key: 'budget' as TabType, icon: FileText, labelKey: 'tripDetail.tabBudget' },
          { key: 'packing' as TabType, icon: Package, labelKey: 'tripDetail.tabPacking' },
          { key: 'map' as TabType, icon: Map, labelKey: 'tripDetail.tabMap' },
          { key: 'group' as TabType, icon: Users, labelKey: 'tripDetail.tabGroup' },
          { key: 'news' as TabType, icon: Newspaper, labelKey: 'tripDetail.tabNews' },
        ]).map(({ key, icon: Icon, labelKey }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-full whitespace-nowrap transition-all',
              tab === key ? 'bg-on-surface text-surface shadow-md' : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface shadow-sm'
            )}>
            <Icon className="w-4 h-4" /> {t(labelKey)}
            {key === 'news' && (newsItems || []).some(n => n.severity === 'CRITICAL') && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-sos" />
            )}
          </button>
        ))}
      </div>

      <div className="px-5 mt-4">
        {/* ── Itinerary Tab ────────────────────────────────────── */}
        {tab === 'itinerary' && (
          <div className="space-y-4">
            {stops.length === 0 && <p className="text-center text-on-surface-variant py-8">{t('tripDetail.noStopsYet')}</p>}

            {/* Progress timeline — pure derived state from stops[].status,
                no separate data source. DONE stops filled/checked, the
                first remaining stop called out as "next". */}
            {stops.length > 1 && (
              <div className="flex items-center px-1">
                {stops.map((stop, idx) => (
                  <div key={idx} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center flex-shrink-0" title={stop.city}>
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-colors',
                        stop.status === 'DONE' ? 'bg-tsi-low text-white'
                          : idx === nextStopIdx ? 'bg-primary text-on-surface ring-4 ring-primary/20'
                          : 'bg-surface-container-high text-on-surface-variant'
                      )}>
                        {stop.status === 'DONE' ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span className={cn('text-[9px] mt-1 max-w-[52px] truncate', idx === nextStopIdx ? 'font-bold text-on-surface' : 'text-on-surface-variant')}>{stop.city}</span>
                    </div>
                    {idx < stops.length - 1 && (
                      <div className={cn('h-0.5 flex-1 mx-0.5', stop.status === 'DONE' ? 'bg-tsi-low' : 'bg-surface-container-high')} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {stops.map((stop, idx) => (
              <div key={idx} className={cn('bg-surface-container-lowest rounded-3xl shadow-sm overflow-hidden flex transition-opacity', stop.status === 'DONE' && 'opacity-70')}>
                <img src={getDestinationImage(stop.city, { w: 400, q: 80 })} alt="" onClick={() => setDetailStopIdx(idx)}
                  role="button" aria-label={t('tripDetail.viewStopDetails', { city: stop.city })}
                  className="w-24 sm:w-28 flex-shrink-0 object-cover cursor-pointer" />
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setDetailStopIdx(idx)} className="text-left">
                      <h3 className="font-display font-bold text-on-surface flex items-center gap-1.5">
                        {stop.city}
                        {stop.status === 'DONE' && <CheckCircle2 className="w-3.5 h-3.5 text-tsi-low" />}
                      </h3>
                      <p className="text-xs text-on-surface-variant">{stop.state} · {t('tripDetail.dayCount', { count: stop.days })}</p>
                    </button>
                    <div className="flex items-start gap-2 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-bold text-on-surface-variant">{tEnum(t, 'zoneType', stop.zone_type)}</span>
                        {stop.altitude_m > 2000 && (
                          <p className="text-xs text-tsi-high">{t('tripDetail.altitudeLabel', { m: stop.altitude_m })}</p>
                        )}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteStop(idx) }} disabled={savingStops} title={t('tripDetail.removeStop')}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-sos/60 hover:text-sos-dark hover:bg-sos/10 transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {stop.activities.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {stop.activities.map((act, aIdx) => (
                        <div key={aIdx} className="flex items-center justify-between text-sm group">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ACTIVITY_TYPE_COLORS[act.type || 'OTHER'] }} />
                            <span className="text-on-surface truncate">{act.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {act.cost > 0 && <span className="text-on-surface-variant font-medium">{formatINR(act.cost)}</span>}
                            <button onClick={() => setConfirmDeleteActivity({ stopIdx: idx, activityIdx: aIdx })} disabled={savingStops} title={t('tripDetail.removeActivity')}
                              className="text-on-surface-variant/50 hover:text-sos-dark transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {stop.hospital_km > 0 && (
                    <p className="text-xs text-on-surface-variant mt-2 flex items-center gap-1">
                      <HeartPulse className="w-3 h-3" /> {t('tripDetail.nearestHospital', { km: stop.hospital_km })}
                    </p>
                  )}

                  {stop.status === 'DONE' ? (
                    <p className="mt-2.5 text-xs font-semibold text-tsi-low flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t('tripDetail.visited')}
                      {stop.actualCostInr != null && ` · ${formatINR(stop.actualCostInr)}`}
                    </p>
                  ) : trip.status === TRIP_STATUSES.ACTIVE && (
                    markVisitedIdx === idx ? (
                      <MarkVisitedForm
                        defaultAmount={stops.length > 0 ? Math.round((trip.budget_inr || 0) / stops.length) : 0}
                        onConfirm={(amount) => markVisited(idx, amount)}
                        onCancel={() => setMarkVisitedIdx(null)}
                        pending={savingStops}
                      />
                    ) : (
                      <button onClick={() => setMarkVisitedIdx(idx)}
                        className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-tsi-low hover:underline">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t('tripDetail.markVisited')}
                      </button>
                    )
                  )}

                  {addActivityForStop === idx ? (
                    <AddActivityForm onAdd={(a) => addActivity(idx, a)} onCancel={() => setAddActivityForStop(null)} pending={savingStops} />
                  ) : (
                    <button onClick={() => setAddActivityForStop(idx)}
                      className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-primary-dark hover:underline">
                      <Plus className="w-3.5 h-3.5" /> {t('tripDetail.addActivity')}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={() => setAddStopOpen(true)}
              className="w-full h-12 rounded-2xl border-dashed flex items-center justify-center gap-2 font-bold">
              <Plus className="w-4 h-4" /> {t('tripDetail.addStop')}
            </Button>
          </div>
        )}

        {/* ── Budget Tab ────────────────────────────────────── */}
        {tab === 'budget' && (
          <div className="space-y-4">
            {/* Spent so far — sum of actualCostInr across stops marked
                visited (see markVisited above), separate from the
                activity-cost breakdown below since it tracks real
                confirmed spend against completed stops, not planned
                activity costs across the whole trip. */}
            {doneStops.length > 0 && (
              <div className="bg-tsi-low/10 border border-tsi-low/20 rounded-3xl shadow-sm p-4">
                <p className="text-xs font-bold text-tsi-low uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('tripDetail.spentSoFar')}
                </p>
                <p className="text-lg font-black text-on-surface leading-none">
                  {formatINR(spentSoFar)}
                  {trip.budget_inr && <span className="text-xs font-medium text-on-surface-variant"> / {formatINR(trip.budget_inr)}</span>}
                </p>
                <p className="text-[11px] text-on-surface-variant mt-1">{t('tripDetail.visitedCount', { count: doneStops.length, total: stops.length })}</p>
              </div>
            )}

            {/* Log an expense — same write path as the itinerary tab's
                per-stop "+ Add Activity", but entry-point-first for anyone
                who thinks in expenses rather than itinerary structure. */}
            <div className="bg-primary/5 border border-primary/15 rounded-3xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-primary-dark flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-4 h-4 text-primary-dark" />
                  </span>
                  {t('tripDetail.logExpense')}
                </p>
                {stops.length > 0 && expenseStopIdx === null && (
                  <button onClick={() => setExpenseStopIdx(0)}
                    className="flex items-center gap-1 text-xs font-bold bg-primary text-on-surface px-3 py-1.5 rounded-full hover:brightness-95 transition-all">
                    <Plus className="w-3.5 h-3.5" /> {t('tripDetail.addExpense')}
                  </button>
                )}
              </div>
              {stops.length === 0 ? (
                <p className="text-xs text-on-surface-variant mt-1.5">{t('tripDetail.addStopFirst')}</p>
              ) : expenseStopIdx !== null && (
                <div className="mt-3 space-y-2">
                  <select value={expenseStopIdx} onChange={(e) => setExpenseStopIdx(Number(e.target.value))}
                    className="w-full h-10 rounded-lg text-sm border border-outline-variant bg-surface-container px-3 transition-colors focus:outline-none focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20">
                    {stops.map((s, i) => <option key={i} value={i}>{s.city}{s.state ? `, ${s.state}` : ''}</option>)}
                  </select>
                  <AddActivityForm onAdd={(a) => addActivity(expenseStopIdx, a)} onCancel={() => setExpenseStopIdx(null)} pending={savingStops} />
                </div>
              )}
            </div>

            {budgetData.length === 0 ? (
              <p className="text-center text-on-surface-variant py-8">{t('tripDetail.noActivitiesYet')}</p>
            ) : (
              <>
                <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-5">
                  <h3 className="font-display font-bold text-on-surface mb-1">{t('tripDetail.costBreakdown')}</h3>
                  <p className="text-2xl font-bold text-primary">{formatINR(totalCost)}</p>
                  {trip.budget_inr && <p className="text-xs text-on-surface-variant">{t('tripDetail.budgetLabel', { amount: formatINR(trip.budget_inr) })}</p>}
                  {trip.budget_inr && totalCost > trip.budget_inr && (
                    <p className="text-xs text-sos-dark font-bold mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {t('tripDetail.overBudgetBy', { amount: formatINR(totalCost - trip.budget_inr) })}
                    </p>
                  )}
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={budgetData} cx="50%" cy="50%" outerRadius={80} dataKey="value" isAnimationActive={false}>
                        {budgetData.map((entry) => (
                          <Cell key={entry.name} fill={ACTIVITY_TYPE_COLORS[entry.name] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatINR(Number(value))} />
                      <Legend formatter={(v) => tEnum(t, 'activityType', v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-3xl p-4">
                  <p className="text-xs font-bold text-primary uppercase mb-2 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5" /> {t('tripDetail.emergencyReserveTitle')}
                  </p>
                  <p className="text-sm text-primary">{t('tripDetail.emergencyReserveDesc')}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Packing Tab ────────────────────────────────────── */}
        {tab === 'packing' && (
          <div className="space-y-4">
            {checklist.length === 0 ? (
              <EmptyState icon={Backpack} title={t('tripDetail.noPackingListTitle')} description={t('tripDetail.noPackingListDesc')}
                boxed
                action={
                  <Button onClick={() => generatePacking()} disabled={generatingPacking}
                    className="bg-primary hover:brightness-95 text-on-surface rounded-full px-6 font-bold flex items-center gap-2">
                    {generatingPacking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generatingPacking ? t('tripDetail.generating') : t('tripDetail.generateAiPackingList')}
                  </Button>
                } />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-on-surface-variant">
                    {t('tripDetail.packedCount', { packed: checklist.filter(i => i.packed).length, total: checklist.length })}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => generatePacking()} disabled={generatingPacking}
                    className="rounded-full text-xs flex items-center gap-1.5">
                    <RefreshCw className={cn('w-3.5 h-3.5', generatingPacking && 'animate-spin')} />
                    {generatingPacking ? t('tripDetail.regenerating') : t('tripDetail.regenerate')}
                  </Button>
                </div>
                <div className="bg-surface-container-lowest rounded-3xl shadow-sm overflow-hidden">
                  {checklist.map(item => (
                    <button key={item.id} type="button"
                      onClick={() => togglePackedItem(checklist.map(i => i.id === item.id ? { ...i, packed: !i.packed } : i))}
                      className={cn('w-full flex items-center gap-3 px-5 py-3.5 border-b border-outline-variant last:border-0 text-left transition-colors',
                        item.packed ? 'bg-tsi-low/10' : 'hover:bg-surface-container'
                      )}>
                      <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        item.packed ? 'bg-tsi-low border-tsi-low' : 'border-outline-variant'
                      )}>
                        {item.packed && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className={cn('text-sm', item.packed ? 'line-through text-on-surface-variant' : 'text-on-surface')}>
                        {item.item}
                      </span>
                      <span className="ml-auto text-xs text-on-surface-variant">{tEnum(t, 'packingCategory', item.category)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Map Tab ────────────────────────────────────────── */}
        {tab === 'map' && (
          <div className="rounded-3xl overflow-hidden shadow-sm h-[60vh]">
            {mapCoords.length > 0 ? (
              <MapContainer center={mapCoords[0]} zoom={7} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
                <Polyline positions={mapCoords} color="#f59e0b" weight={3} dashArray="6,8" />
                {stops.filter(s => s.lat != null && s.lng != null).map((stop, i) => (
                  <Marker key={i} position={[stop.lat!, stop.lng!]}>
                    <Popup>
                      <div className="text-center p-1">
                        <p className="font-bold">{stop.city}</p>
                        <p className="text-xs text-on-surface-variant">{stop.state} · {stop.days} days</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                <RecenterControl coords={mapCoords} />
              </MapContainer>
            ) : (
              <div className="h-full bg-surface-container-high flex items-center justify-center">
                <p className="text-on-surface-variant">{t('tripDetail.addStopsForMap')}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Group Tab ─────────────────────────────────────── */}
        {tab === 'group' && (
          <div className="space-y-4">
            {isOwner ? (
              <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-5">
                <h3 className="font-display font-bold text-on-surface mb-1">{t('tripDetail.inviteCompanionsTitle')}</h3>
                <p className="text-xs text-on-surface-variant mb-4">{t('tripDetail.inviteCompanionsDesc')}</p>
                {trip.invite_code ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-surface-container-high rounded-2xl py-3 text-center font-mono text-2xl font-black tracking-[0.3em] text-on-surface">
                      {trip.invite_code}
                    </div>
                    <Button onClick={() => copyInviteCode()} size="icon" variant="outline" className="rounded-full h-12 w-12 flex-shrink-0">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => generateInvite()} disabled={generatingInvite}
                    className="w-full h-12 bg-primary hover:brightness-95 text-on-surface rounded-full font-bold flex items-center justify-center gap-2">
                    {generatingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                    {t('tripDetail.generateInviteCode')}
                  </Button>
                )}
              </div>
            ) : (
              <Button onClick={() => leaveTrip()} disabled={leaving} variant="outline"
                className="w-full h-11 rounded-full font-bold flex items-center justify-center gap-2 border-sos/30 text-sos-dark hover:bg-sos/10">
                {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                {t('tripDetail.leaveGroupTrip')}
              </Button>
            )}

            <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-5">
              <h3 className="font-display font-bold text-on-surface mb-3">{t('tripDetail.travelCompanions')}</h3>
              {!groupData || groupData.members.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-4">
                  {isOwner ? t('tripDetail.noOneJoinedYet') : t('tripDetail.noOtherCompanions')}
                </p>
              ) : (
                <div className="space-y-3">
                  {groupData.members.map((member) => (
                    <div key={member.tourist_id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center flex-shrink-0">
                        {member.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">{member.full_name}</p>
                        <p className="text-xs text-on-surface-variant flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {member.location_updated_at ? t('tripDetail.lastSeen', { time: formatTimeAgo(member.location_updated_at) }) : t('tripDetail.noLocationYet')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── News Tab ──────────────────────────────────────── */}
        {tab === 'news' && (
          <NewsFeed items={newsItems || []} showDestinationName
            emptyMessage={t('tripDetail.noNewsForTrip')} />
        )}

        {/* Journey Passport button */}
        {trip.status === TRIP_STATUSES.COMPLETED && (
          <div className="mt-5">
            <Button onClick={handleDownloadPassport}
              className="w-full h-12 bg-on-surface hover:bg-on-surface/90 text-surface rounded-full font-bold flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              {t('tripDetail.downloadPassport')}
            </Button>
          </div>
        )}
      </div>

      <AddStopDialog open={addStopOpen} onOpenChange={setAddStopOpen} onAdd={addStop} pending={savingStops} />

      <ConfirmDialog
        open={confirmDeleteStop !== null}
        onOpenChange={(v) => !v && setConfirmDeleteStop(null)}
        title={t('tripDetail.removeStopTitle')}
        description={t('tripDetail.removeStopDesc')}
        confirmLabel={t('tripDetail.removeStop')}
        pending={savingStops}
        onConfirm={() => confirmDeleteStop !== null && removeStop(confirmDeleteStop)}
      />
      <ConfirmDialog
        open={confirmDeleteActivity !== null}
        onOpenChange={(v) => !v && setConfirmDeleteActivity(null)}
        title={t('tripDetail.removeActivityTitle')}
        description={t('tripDetail.removeActivityDesc')}
        confirmLabel={t('tripDetail.removeActivity')}
        pending={savingStops}
        onConfirm={() => confirmDeleteActivity && removeActivity(confirmDeleteActivity.stopIdx, confirmDeleteActivity.activityIdx)}
      />
      <ConfirmDialog
        open={confirmCancelTrip}
        onOpenChange={setConfirmCancelTrip}
        title={t('tripDetail.cancelTripTitle')}
        description={t('tripDetail.cancelTripDesc')}
        confirmLabel={t('tripDetail.cancelTrip')}
        destructive={false}
        pending={cancelling}
        onConfirm={() => cancelTrip()}
      />
      <ConfirmDialog
        open={confirmDeleteTrip}
        onOpenChange={setConfirmDeleteTrip}
        title={t('tripDetail.deleteTripTitle')}
        description={t('tripDetail.deleteTripDesc')}
        confirmLabel={t('tripDetail.deleteTrip')}
        destructive
        pending={deletingTrip}
        onConfirm={() => removeTrip()}
      />
      <StopDetailSheet
        open={detailStopIdx !== null}
        stop={detailStopIdx !== null ? stops[detailStopIdx] : null}
        previousStop={detailStopIdx !== null && detailStopIdx > 0 ? stops[detailStopIdx - 1] : null}
        onClose={() => setDetailStopIdx(null)}
      />
    </div>
  )
}

// ── Add Stop dialog ──────────────────────────────────────────────────────
// Real Nominatim search (DestinationSearchField) so a post-creation stop
// carries lat/lng, same as the create-trip wizard's custom-stop field —
// without it the map tab silently drops the stop. TSI-relevant fields
// (connectivity/difficulty/etc.) default the same way CreateTripPage's
// manual stops already do, since neither source can know them.
function AddStopDialog({ open, onOpenChange, onAdd, pending }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (stop: Stop) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [days, setDays] = useState('2')
  const [notes, setNotes] = useState('')

  const reset = () => { setCity(''); setState(''); setLat(null); setLng(null); setDays('2'); setNotes('') }

  const submit = () => {
    if (!city.trim() || !state.trim()) return
    onAdd({
      city: city.trim(), state: state.trim(), destinationId: null, lat, lng,
      days: Math.max(1, Number(days) || 1), arrivalDate: null, departureDate: null,
      activities: [], notes: notes.trim() || null,
      connectivity: 'MODERATE', difficulty: 'EASY', altitude_m: 0, zone_type: 'SAFE',
      hospital_km: 0, eta_minutes: null, status: 'UPCOMING', actualCostInr: null,
    })
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-primary-dark" />
            </span>
            {t('tripDetail.addStop')}
          </DialogTitle>
          <DialogDescription>{t('tripDetail.addStopDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {city.length >= 3 && (
            <div className="relative h-20 rounded-xl overflow-hidden">
              <img src={getDestinationImage(city, { w: 400, q: 70 })} alt=""
                className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <p className="absolute bottom-1.5 left-2.5 text-xs font-bold text-white">{city}{state ? `, ${state}` : ''}</p>
            </div>
          )}
          <DestinationSearchField
            city={city}
            onCityChange={setCity}
            onSelect={(r) => { setCity(r.city); setState(r.state); setLat(r.lat); setLng(r.lng) }}
            cityPlaceholder={t('createTrip.cityPlaceholder')}
          />
          <Input placeholder={t('createTrip.statePlaceholder')} value={state} onChange={(e) => setState(e.target.value)} className="h-10 rounded-lg text-sm" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant whitespace-nowrap">{t('createTrip.daysLabel')}</span>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className="h-10 rounded-lg text-sm w-20" />
          </div>
          <Input placeholder={t('tripDetail.notesOptional')} value={notes} onChange={(e) => setNotes(e.target.value)} className="h-10 rounded-lg text-sm" />
        </div>
        <DialogFooter>
          <Button disabled={!city.trim() || !state.trim() || pending} onClick={submit}
            className="rounded-full font-bold bg-primary hover:brightness-95 text-on-surface flex items-center gap-2">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> {t('tripDetail.addStop')}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Activity inline form ─────────────────────────────────────────────
// Reused by both the itinerary tab's per-stop "+ Add Activity" and the
// budget tab's "+ Add Expense" shortcut — same shape, same write path.
function AddActivityForm({ onAdd, onCancel, pending }: {
  onAdd: (activity: Activity) => void
  onCancel: () => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [type, setType] = useState<string>(ACTIVITY_TYPES.ACTIVITY)
  const [cost, setCost] = useState('')
  const [duration, setDuration] = useState('')

  const submit = () => {
    if (!name.trim()) return
    onAdd({ name: name.trim(), type, cost: Math.max(0, Number(cost) || 0), duration: duration.trim() || undefined })
    setName(''); setCost(''); setDuration('')
  }

  return (
    <div className="mt-2.5 p-3 bg-primary/5 border border-primary/15 rounded-xl space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder={t('tripDetail.activityNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)}
          className="h-9 rounded-lg text-xs bg-surface-container-lowest" />
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none"
            style={{ backgroundColor: ACTIVITY_TYPE_COLORS[type] }} />
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="w-full h-9 rounded-lg text-xs border border-outline-variant bg-surface-container-lowest pl-6 pr-2 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
            {Object.values(ACTIVITY_TYPES).map((v) => <option key={v} value={v}>{tEnum(t, 'activityType', v)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" min={0} placeholder={t('tripDetail.costPlaceholder')} value={cost} onChange={(e) => setCost(e.target.value)}
          className="h-9 rounded-lg text-xs" />
        <Input placeholder={t('tripDetail.durationOptional')} value={duration} onChange={(e) => setDuration(e.target.value)}
          className="h-9 rounded-lg text-xs" />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!name.trim() || pending} onClick={submit}
          className="flex-1 h-9 rounded-full text-xs bg-primary hover:brightness-95 text-on-surface font-bold flex items-center justify-center gap-1.5">
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5" /> {t('common.add')}</>}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="h-9 rounded-full text-xs px-4">
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  )
}

// ── Mark-visited inline confirm ──────────────────────────────────────────
// Amount pre-fills with an even share of the trip's total planned budget —
// an honest estimate, not a claim of a known real cost (no bank/UPI
// integration exists) — and stays fully editable before confirming.
function MarkVisitedForm({ defaultAmount, onConfirm, onCancel, pending }: {
  defaultAmount: number
  onConfirm: (amount: number) => void
  onCancel: () => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(String(defaultAmount))

  return (
    <div className="mt-2.5 p-3 bg-tsi-low/5 border border-tsi-low/20 rounded-xl space-y-2">
      <label className="text-xs text-on-surface-variant flex items-center gap-1.5">
        <Wallet className="w-3.5 h-3.5" /> {t('tripDetail.actualSpendLabel')}
      </label>
      <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)}
        className="h-9 rounded-lg text-xs" />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={pending} onClick={() => onConfirm(Math.max(0, Number(amount) || 0))}
          className="flex-1 h-9 rounded-full text-xs bg-tsi-low hover:brightness-95 text-white font-bold flex items-center justify-center gap-1.5">
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5" /> {t('tripDetail.confirmVisited')}</>}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="h-9 rounded-full text-xs px-4">
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  )
}
