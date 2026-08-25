// src/pages/trips/TripDetailPage.tsx
// Full-bleed destination-photo hero, floating glass TSI/status badges, and
// photo-thumbnail itinerary stops — the "listing detail" language used
// across the redesigned tourist PWA.
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ArrowLeft, Share2, Download, Map, List, Package, FileText, AlertTriangle,
  Rocket, Sparkles, RefreshCw, Loader2, Check, Lightbulb, HeartPulse, Backpack, LocateFixed,
  Users, Copy, LogOut, Clock, Newspaper, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '../../components/ui/button'
import { TSIBadge, EmptyState, PageSkeleton, NewsFeed, TSIBreakdown, JourneyRiskGraph, SafetyAdvisory } from '../../components/shared'
import tripApi from '../../api/trip.api'
import packingApi from '../../api/packing.api'
import passportApi from '../../api/passport.api'
import newsApi from '../../api/news.api'
import { queryClient } from '../../lib/queryClient'
import { useAuthStore } from '../../store/auth.store'
import { formatDate, formatINR, formatTimeAgo, cn } from '../../lib/utils'
import { TRIP_STATUSES } from '../../constants/enums'
import { getDestinationImage } from '../../lib/destinationImages'
import type { Stop, PackingItem } from '../../types/api.types'

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  TRANSPORT: '#3b82f6', STAY: '#8b5cf6', ACTIVITY: '#10b981', MEAL: '#f59e0b', OTHER: '#94a3b8',
}

const STATUS_STYLES: Record<string, string> = {
  PLANNED:   'bg-slate-900/60 text-white',
  ACTIVE:    'bg-green-500/90 text-white',
  COMPLETED: 'bg-blue-500/90 text-white',
  CANCELLED: 'bg-red-500/90 text-white',
}

type TabType = 'itinerary' | 'budget' | 'packing' | 'map' | 'group' | 'news'

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
      className="absolute bottom-4 right-4 z-[1000] w-10 h-10 rounded-full bg-white shadow-lg border border-outline-variant flex items-center justify-center hover:bg-surface-container active:scale-95 transition-all">
      <LocateFixed className="w-5 h-5 text-on-surface" />
    </button>
  )
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tourist = useAuthStore((s) => s.tourist)
  const [tab, setTab] = useState<TabType>('itinerary')
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
      toast.success('Invite code copied!')
      queryClient.invalidateQueries({ queryKey: ['trips', id] })
    },
  })

  const { mutate: leaveTrip, isPending: leaving } = useMutation({
    mutationFn: () => tripApi.leaveTrip(id!),
    onSuccess: () => {
      toast.success('Left the group trip')
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      navigate('/trips')
    },
  })

  const { mutate: generatePacking, isPending: generatingPacking } = useMutation({
    mutationFn: () => packingApi.generate(id!),
    onSuccess: () => { toast.success('AI packing list generated!'); queryClient.invalidateQueries({ queryKey: ['trips', id] }) },
  })

  const { mutate: activateTrip, isPending: activating } = useMutation({
    mutationFn: () => tripApi.updateTripStatus(id!, { status: 'ACTIVE' }),
    onSuccess: () => { toast.success('Trip activated!'); queryClient.invalidateQueries({ queryKey: ['trips'] }) },
  })

  // Direct navigation, not an axios blob fetch — see passport.api.ts for why.
  const handleDownloadPassport = () => {
    window.location.href = passportApi.getDownloadUrl(id!)
    toast.success('Preparing your Journey Passport...')
  }

  const { mutate: togglePackedItem } = useMutation({
    mutationFn: (items: PackingItem[]) => tripApi.updateChecklist(id!, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips', id] }),
  })

  const handleShare = async () => {
    if (!trip?.is_public || !trip.public_token) {
      toast.info('Enable public sharing in settings to share this trip')
      return
    }
    const url = `${window.location.origin}/community/${trip.public_token}`
    await navigator.clipboard.writeText(url)
    toast.success('Trip link copied!')
  }

  if (isLoading) return <div className="min-h-screen bg-surface"><PageSkeleton /></div>
  if (!trip) {
    return (
      <EmptyState icon={Map} title="Trip not found" description="This trip may have been deleted or the link is invalid."
        action={<Button onClick={() => navigate('/trips')} className="rounded-full">Back to trips</Button>} />
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

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Hero — full-bleed destination photo, rounded into a "card" at the
          bottom edge, with a floating liquid-glass toolbar capsule over it. */}
      <div className="relative h-80 sm:h-96 rounded-b-[32px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.12)]">
        <img src={getDestinationImage(heroCity, { w: 1200 })} alt={heroCity || trip.title}
          className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/35" />

        <div className="relative flex items-center justify-between px-5 pt-12">
          <button onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 flex items-center justify-center shadow-glass hover:bg-white/25 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-1 bg-white/15 backdrop-blur-xl border border-white/25 rounded-full p-1.5 shadow-glass">
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
          </div>
        </div>

        <div className="relative px-5 pt-10 pb-8">
          <span className={cn('inline-block text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xl mb-3', STATUS_STYLES[trip.status] || STATUS_STYLES.PLANNED)}>
            {trip.status}
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
            <p className="text-xs text-on-surface-variant">Travel Safety Index</p>
            <p className="text-sm font-bold text-on-surface mt-0.5">{trip.tsi_label || 'Not calculated yet'}</p>
          </div>
          {trip.status === TRIP_STATUSES.PLANNED && (
            <Button size="sm" onClick={() => activateTrip()} disabled={activating}
              className="bg-primary hover:brightness-95 text-on-surface rounded-full text-xs px-3 py-1 font-bold flex items-center gap-1 flex-shrink-0">
              {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />} Activate
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
              <p className="text-[11px] text-on-surface-variant mt-1">{stops.length === 1 ? 'Stop' : 'Stops'} · {trip.travel_type}</p>
            </div>
          </div>
          <div className="col-span-2 bg-surface-container-lowest rounded-3xl shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">Budget</p>
              {budgetPct != null && (
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                  budgetPct >= 100 ? 'bg-red-100 text-red-600' : budgetPct >= 85 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                )}>
                  {budgetPct >= 100 ? 'Over budget' : budgetPct >= 85 ? 'Nearing limit' : 'On track'}
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
                  budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 85 ? 'bg-amber-500' : 'bg-primary'
                )} style={{ width: `${budgetPct}%` }} />
              </div>
            )}
          </div>
        </div>

        {trip.tsi_recommendations.length > 0 && trip.tsi_score !== null && trip.tsi_score < 70 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3">
            <p className="text-xs font-bold text-orange-700 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Safety Recommendations
            </p>
            {trip.tsi_recommendations.slice(0, 2).map((r, i) => (
              <p key={i} className="text-xs text-orange-600">• {r}</p>
            ))}
          </div>
        )}

        {trip.tsi_score !== null && <SafetyAdvisory tripId={id!} />}

        {trip.tsi_score !== null && (
          <div>
            <button onClick={() => setShowTSIDetails(v => !v)}
              className="w-full flex items-center justify-between text-xs font-bold text-on-surface-variant hover:text-on-surface py-1 transition-colors">
              <span className="flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Why this score, stop by stop</span>
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
          { key: 'itinerary' as TabType, icon: List, label: 'Itinerary' },
          { key: 'budget' as TabType, icon: FileText, label: 'Budget' },
          { key: 'packing' as TabType, icon: Package, label: 'Packing' },
          { key: 'map' as TabType, icon: Map, label: 'Map' },
          { key: 'group' as TabType, icon: Users, label: 'Group' },
          { key: 'news' as TabType, icon: Newspaper, label: 'News' },
        ]).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-full whitespace-nowrap transition-all',
              tab === key ? 'bg-on-surface text-surface shadow-md' : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface shadow-sm'
            )}>
            <Icon className="w-4 h-4" /> {label}
            {key === 'news' && (newsItems || []).some(n => n.severity === 'CRITICAL') && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500" />
            )}
          </button>
        ))}
      </div>

      <div className="px-5 mt-4">
        {/* ── Itinerary Tab ────────────────────────────────────── */}
        {tab === 'itinerary' && (
          <div className="space-y-4">
            {stops.length === 0 && <p className="text-center text-on-surface-variant py-8">No stops added yet</p>}
            {stops.map((stop, idx) => (
              <div key={idx} className="bg-surface-container-lowest rounded-3xl shadow-sm overflow-hidden flex">
                <img src={getDestinationImage(stop.city, { w: 200 })} alt={stop.city}
                  className="w-24 sm:w-28 flex-shrink-0 object-cover" />
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-display font-bold text-on-surface">{stop.city}</h3>
                      <p className="text-xs text-on-surface-variant">{stop.state} · {stop.days} days</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-bold text-on-surface-variant">{stop.zone_type?.replace('_', ' ')}</span>
                      {stop.altitude_m > 2000 && (
                        <p className="text-xs text-orange-500">{stop.altitude_m}m altitude</p>
                      )}
                    </div>
                  </div>

                  {stop.activities.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {stop.activities.map((act, aIdx) => (
                        <div key={aIdx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ACTIVITY_TYPE_COLORS[act.type || 'OTHER'] }} />
                            <span className="text-on-surface truncate">{act.name}</span>
                          </div>
                          {act.cost > 0 && <span className="text-on-surface-variant font-medium flex-shrink-0">{formatINR(act.cost)}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {stop.hospital_km > 0 && (
                    <p className="text-xs text-on-surface-variant mt-2 flex items-center gap-1">
                      <HeartPulse className="w-3 h-3" /> Nearest hospital: {stop.hospital_km}km
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Budget Tab ────────────────────────────────────── */}
        {tab === 'budget' && (
          <div className="space-y-4">
            {budgetData.length === 0 ? (
              <p className="text-center text-on-surface-variant py-8">No activities with cost added yet</p>
            ) : (
              <>
                <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-5">
                  <h3 className="font-display font-bold text-on-surface mb-1">Cost Breakdown</h3>
                  <p className="text-2xl font-bold text-primary">{formatINR(totalCost)}</p>
                  {trip.budget_inr && <p className="text-xs text-on-surface-variant">Budget: {formatINR(trip.budget_inr)}</p>}
                  {trip.budget_inr && totalCost > trip.budget_inr && (
                    <p className="text-xs text-red-500 font-bold mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Over budget by {formatINR(totalCost - trip.budget_inr)}
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
                      <Legend formatter={(v) => v.charAt(0) + v.slice(1).toLowerCase()} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-3xl p-4">
                  <p className="text-xs font-bold text-primary uppercase mb-2 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5" /> Emergency Reserve Recommended
                  </p>
                  <p className="text-sm text-primary">Keep ₹5,000–₹10,000 as emergency reserve for medical or rescue costs.</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Packing Tab ────────────────────────────────────── */}
        {tab === 'packing' && (
          <div className="space-y-4">
            {checklist.length === 0 ? (
              <EmptyState icon={Backpack} title="No packing list yet" description="Generate a context-aware list using AI"
                action={
                  <Button onClick={() => generatePacking()} disabled={generatingPacking}
                    className="bg-primary hover:brightness-95 text-on-surface rounded-full px-6 font-bold flex items-center gap-2">
                    {generatingPacking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generatingPacking ? 'Generating...' : 'Generate AI Packing List'}
                  </Button>
                } />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-on-surface-variant">
                    {checklist.filter(i => i.packed).length}/{checklist.length} packed
                  </p>
                  <Button size="sm" variant="outline" onClick={() => generatePacking()} disabled={generatingPacking}
                    className="rounded-full text-xs flex items-center gap-1.5">
                    <RefreshCw className={cn('w-3.5 h-3.5', generatingPacking && 'animate-spin')} />
                    {generatingPacking ? 'Regenerating...' : 'Regenerate'}
                  </Button>
                </div>
                <div className="bg-surface-container-lowest rounded-3xl shadow-sm overflow-hidden">
                  {checklist.map(item => (
                    <button key={item.id} type="button"
                      onClick={() => togglePackedItem(checklist.map(i => i.id === item.id ? { ...i, packed: !i.packed } : i))}
                      className={cn('w-full flex items-center gap-3 px-5 py-3.5 border-b border-outline-variant last:border-0 text-left transition-colors',
                        item.packed ? 'bg-green-50' : 'hover:bg-surface-container'
                      )}>
                      <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        item.packed ? 'bg-green-500 border-green-500' : 'border-slate-300'
                      )}>
                        {item.packed && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className={cn('text-sm', item.packed ? 'line-through text-on-surface-variant' : 'text-on-surface')}>
                        {item.item}
                      </span>
                      <span className="ml-auto text-xs text-on-surface-variant">{item.category}</span>
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
                <p className="text-on-surface-variant">Add stops with coordinates to view map</p>
              </div>
            )}
          </div>
        )}

        {/* ── Group Tab ─────────────────────────────────────── */}
        {tab === 'group' && (
          <div className="space-y-4">
            {isOwner ? (
              <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-5">
                <h3 className="font-display font-bold text-on-surface mb-1">Invite companions</h3>
                <p className="text-xs text-on-surface-variant mb-4">Share this code so they can join and see this trip, and so their SOS alerts reach you too.</p>
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
                    Generate Invite Code
                  </Button>
                )}
              </div>
            ) : (
              <Button onClick={() => leaveTrip()} disabled={leaving} variant="outline"
                className="w-full h-11 rounded-full font-bold flex items-center justify-center gap-2 border-red-200 text-red-600 hover:bg-red-50">
                {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Leave Group Trip
              </Button>
            )}

            <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-5">
              <h3 className="font-display font-bold text-on-surface mb-3">Travel companions</h3>
              {!groupData || groupData.members.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-4">
                  {isOwner ? 'No one has joined yet — share your invite code.' : 'No other companions yet.'}
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
                          {member.location_updated_at ? `Last seen ${formatTimeAgo(member.location_updated_at)}` : 'No location yet'}
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
            emptyMessage="No news or alerts for this trip's destinations right now" />
        )}

        {/* Journey Passport button */}
        {trip.status === TRIP_STATUSES.COMPLETED && (
          <div className="mt-5">
            <Button onClick={handleDownloadPassport}
              className="w-full h-12 bg-on-surface hover:bg-on-surface/90 text-surface rounded-full font-bold flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Download Digital Journey Passport
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
