// src/pages/trips/TripListPage.tsx
// Destination-photo "listing card" language — image-forward, floating glass
// badges for status/TSI, matching the rest of the redesigned tourist PWA.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronRight, ArrowLeft, Plane, MapPin, Sparkles, Users, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog'
import { TripCardSkeleton, EmptyState } from '../../components/shared'
import tripApi from '../../api/trip.api'
import { queryClient } from '../../lib/queryClient'
import { formatDate, formatINR, cn } from '../../lib/utils'
import { tEnum } from '../../lib/i18nEnums'
import { getDestinationImage, HERO_PHOTO } from '../../lib/destinationImages'

const STATUS_TABS = ['All', 'ACTIVE', 'PLANNED', 'COMPLETED', 'CANCELLED']
const STATUS_STYLES: Record<string, string> = {
  PLANNED:   'bg-slate-900/60 text-white',
  ACTIVE:    'bg-green-500/90 text-white',
  COMPLETED: 'bg-blue-500/90 text-white',
  CANCELLED: 'bg-red-500/90 text-white',
}

// Literal class names (not built from getTSIColors' output at runtime) so
// Tailwind's static content scanner can actually see and generate them.
function tsiDotColor(score: number | null): string {
  if (score === null) return 'bg-slate-400'
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

export default function TripListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('All')
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['trips', activeTab],
    queryFn: () => tripApi.getMyTrips({
      status: activeTab !== 'All' ? activeTab : undefined,
      limit: 20,
    }).then(r => r.data),
  })

  const { mutate: joinTrip, isPending: joining } = useMutation({
    mutationFn: () => tripApi.joinTrip(joinCode.trim()),
    onSuccess: (res) => {
      toast.success(t('trips.toastJoined'))
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      setJoinOpen(false)
      setJoinCode('')
      navigate(`/trips/${res.data.data.id}`)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('trips.toastJoinFailed'))
    },
  })

  const trips = data?.data || []

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest/80 backdrop-blur-xl sticky top-0 z-10 px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6 text-on-surface" /></button>
            <h1 className="font-display text-xl font-bold text-on-surface">{t('trips.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setJoinOpen(true)} size="sm" variant="outline"
              className="rounded-full text-xs px-3 font-bold">
              <Users className="w-3.5 h-3.5 mr-1" /> {t('trips.join')}
            </Button>
            <Button onClick={() => navigate('/trips/new')} size="sm"
              className="bg-primary hover:brightness-95 text-on-surface rounded-full text-xs px-3 font-bold shadow-glow-amber">
              <Plus className="w-3.5 h-3.5 mr-1" /> {t('trips.newTrip')}
            </Button>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all',
                activeTab === tab ? 'bg-on-surface text-surface' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
              )}>
              {tab === 'All' ? t('trips.tabAll') : tEnum(t, 'tripStatus', tab)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-5 space-y-5">
        {isLoading && [1, 2, 3].map(i => <TripCardSkeleton key={i} />)}

        {!isLoading && trips.length === 0 && (
          <div className="relative rounded-3xl overflow-hidden mt-2">
            <img src={HERO_PHOTO} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1px]" />
            <div className="relative">
              <EmptyState icon={Plane} title={t('trips.noTripsFound')}
                description={t('trips.noTripsDescription')}
                className="text-white [&_h3]:text-white [&_p]:text-white/70 [&_svg]:text-white/60"
                action={
                  <Button onClick={() => navigate('/trips/new')} className="bg-primary hover:brightness-95 text-primary-foreground rounded-full px-6 font-bold shadow-glass">
                    <Plus className="w-4 h-4 mr-2" /> {t('dashboard.planNewTrip')}
                  </Button>
                }
              />
            </div>
          </div>
        )}

        {trips.map((trip) => {
          const firstStopCity = trip.stops?.[0]?.city
          return (
            <div key={trip.id} onClick={() => navigate(`/trips/${trip.id}`)} role="button"
              className="group relative rounded-3xl overflow-hidden shadow-md hover:shadow-glass-lg active:scale-[0.98] transition-all bg-surface-container-lowest cursor-pointer">
              {/* Photo */}
              <div className="relative h-40 overflow-hidden">
                <img src={getDestinationImage(firstStopCity, { w: 1200, q: 82 })} alt={firstStopCity || trip.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/10" />
                <span className={cn('absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xl', STATUS_STYLES[trip.status] || STATUS_STYLES.PLANNED)}>
                  {tEnum(t, 'tripStatus', trip.status)}
                </span>
                {trip.tsi_score !== null && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-surface-container-lowest/90 backdrop-blur-xl rounded-full pl-1.5 pr-2.5 py-1 shadow-sm">
                    <span className={cn('w-2 h-2 rounded-full', tsiDotColor(trip.tsi_score))} />
                    <span className="text-[11px] font-bold text-on-surface">TSI {trip.tsi_score}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-on-surface truncate">{trip.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{formatDate(trip.start_date)} → {formatDate(trip.end_date)}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {typeof trip.stop_count === 'number' && (
                      <span className="text-xs text-on-surface-variant flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {trip.stop_count} {t('dashboard.stops')}
                      </span>
                    )}
                    {trip.budget_inr && (
                      <span className="text-xs text-primary font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> {formatINR(trip.budget_inr)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-on-surface-variant flex-shrink-0" />
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('trips.joinDialogTitle')}</DialogTitle>
            <DialogDescription>{t('trips.joinDialogDescription')}</DialogDescription>
          </DialogHeader>
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. K7M2QX"
            maxLength={8}
            className="text-center text-lg font-mono font-bold tracking-widest uppercase"
            autoFocus
          />
          <DialogFooter>
            <Button onClick={() => joinTrip()} disabled={joining || joinCode.trim().length < 4}
              className="bg-primary hover:brightness-95 text-on-surface font-bold rounded-full">
              {joining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {joining ? t('trips.joining') : t('trips.joinTripButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
