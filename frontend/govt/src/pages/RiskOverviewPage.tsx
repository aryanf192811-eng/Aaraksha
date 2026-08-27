// src/pages/RiskOverviewPage.tsx
// Redesign: HD destination photography, a per-zone risk gauge, live weather,
// and an expandable detail panel (hospital distance, altitude, govt
// advisory) pulled from the destinations catalog — all data the backend
// already had but never surfaced (see govt.service.js getRiskOverview fix).
import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Shield, ChevronDown, MapPin, HeartPulse, Mountain, Users, AlertTriangle, FileText, Megaphone, Loader2, BrainCircuit, Info } from 'lucide-react'
import { Sun, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import govtApi, { type RiskOverviewEntry, type PostNewsPayload } from '../api/govt.api'
import { getDestinationImage } from '../lib/destinationImages'
import { cn } from '../lib/utils'

const NEWS_CATEGORIES: PostNewsPayload['category'][] = ['WEATHER', 'ROAD_CLOSURE', 'EVENT', 'ADVISORY', 'FESTIVAL', 'OTHER']
const NEWS_SEVERITIES: PostNewsPayload['severity'][] = ['INFO', 'WARNING', 'CRITICAL']

const ZONE_META: Record<string, { label: string; badge: string; ring: string }> = {
  SAFE:         { label: 'Safe',          badge: 'bg-emerald-100 text-emerald-700', ring: '#10b981' },
  CAUTION:      { label: 'Caution',       badge: 'bg-amber-100 text-amber-700',     ring: '#f59e0b' },
  HIGH_RISK:    { label: 'High Risk',     badge: 'bg-orange-100 text-orange-700',   ring: '#ea580c' },
  RESTRICTED:   { label: 'Restricted',    badge: 'bg-red-100 text-red-700',         ring: '#dc2626' },
  ILP_REQUIRED: { label: 'ILP Required',  badge: 'bg-purple-100 text-purple-700',   ring: '#7c3aed' },
}

const WEATHER_ICONS: Record<string, typeof Sun> = {
  CLEAR: Sun, CLOUDY: Cloud, RAIN: CloudRain, HEAVY_RAIN: CloudRain,
  STORM: CloudLightning, SNOW: CloudSnow, FOG: CloudFog,
}

const FILTERS = ['ALL', 'SAFE', 'CAUTION', 'HIGH_RISK', 'RESTRICTED', 'ILP_REQUIRED'] as const

const PREDICTED_RISK_META: Record<string, { badge: string; bar: string }> = {
  Low:      { badge: 'bg-emerald-100 text-emerald-700', bar: '#10b981' },
  Moderate: { badge: 'bg-amber-100 text-amber-700',     bar: '#f59e0b' },
  Elevated: { badge: 'bg-red-100 text-red-700',          bar: '#dc2626' },
}

// "connectivity_NONE" -> "No connectivity" — readable labels for the
// model's raw feature names, shown in the explainability breakdown.
function humanizeFeature(feature: string): string {
  const [group, ...rest] = feature.split('_')
  const value = rest.join('_')
  const groupLabel = group === 'connectivity' ? 'Connectivity' : group === 'difficulty' ? 'Difficulty'
    : group === 'zone' ? 'Zone' : group === 'altitude' ? 'Altitude' : group === 'hospital' ? 'Hospital distance'
    : group === 'monsoon' ? 'Monsoon season' : group
  if (feature === 'altitude_norm' || feature === 'hospital_distance_norm' || feature === 'monsoon_season') return groupLabel
  return `${groupLabel}: ${value.replace('_', ' ')}`
}

// Composite 0-100 zone risk score from zone classification, live tourist
// mix, and current weather risk — the backend only returns each factor
// independently, so this rolls them into one number for the gauge.
function computeRiskScore(zone: RiskOverviewEntry): number {
  let score = 100
  if (zone.zoneType === 'CAUTION') score -= 15
  if (zone.zoneType === 'HIGH_RISK') score -= 35
  if (zone.zoneType === 'RESTRICTED') score -= 45
  if (zone.ilpRequired) score -= 8
  if (zone.weather?.weather_risk === 'MODERATE') score -= 10
  if (zone.weather?.weather_risk === 'HIGH') score -= 20
  if (zone.weather?.weather_risk === 'EXTREME') score -= 30
  score -= zone.highRisk * 6
  return Math.max(4, Math.min(100, score))
}

function RiskGauge({ score, color }: { score: number; color: string }) {
  const r = 26
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - score / 100)
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-black text-white drop-shadow">{score}</span>
      </div>
    </div>
  )
}

export default function RiskOverviewPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [alertTarget, setAlertTarget] = useState<RiskOverviewEntry | null>(null)
  const [category, setCategory] = useState<PostNewsPayload['category']>('ADVISORY')
  const [severity, setSeverity] = useState<PostNewsPayload['severity']>('INFO')
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')

  const { data: riskData, isLoading } = useQuery({
    queryKey: ['govt', 'risk-overview'],
    queryFn: () => govtApi.getRiskOverview().then(r => r.data.data),
    refetchInterval: 60_000,
  })

  const { data: modelInfo } = useQuery({
    queryKey: ['govt', 'risk-model', 'info'],
    queryFn: () => govtApi.getRiskModelInfo().then(r => r.data.data),
    staleTime: 10 * 60_000,
  })

  const resetAlertForm = () => {
    setAlertTarget(null)
    setCategory('ADVISORY')
    setSeverity('INFO')
    setHeadline('')
    setBody('')
  }

  const { mutate: postAlert, isPending: postingAlert } = useMutation({
    mutationFn: () => govtApi.postDestinationNews(alertTarget!.destinationId!, {
      category, severity, headline: headline.trim(), body: body.trim() || undefined, source: 'Aaraksha Command Center',
    }),
    onSuccess: () => {
      toast.success(severity === 'CRITICAL' ? 'Alert posted — affected tourists notified immediately' : 'Advisory posted')
      resetAlertForm()
    },
    onError: () => toast.error('Could not post — try again'),
  })

  const risks = useMemo(() => {
    const all = riskData || []
    const filtered = filter === 'ALL' ? all : all.filter(z => z.zoneType === filter)
    return [...filtered].sort((a, b) => computeRiskScore(a) - computeRiskScore(b))
  }, [riskData, filter])

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full overflow-x-hidden">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-on-surface">Risk Overview</h1>
          <p className="text-on-surface-variant text-sm">Destination-level tourist risk assessment, live weather, and local emergency infrastructure</p>
        </div>
        {modelInfo && (
          <div className="group relative">
            <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-full pl-3 pr-3.5 py-1.5 text-xs font-semibold text-violet-700 cursor-help">
              <BrainCircuit className="w-3.5 h-3.5" />
              Predictive Risk Model · {(modelInfo.testMetrics.accuracy * 100).toFixed(0)}% test accuracy
              <Info className="w-3 h-3 opacity-60" />
            </div>
            <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg p-3.5 text-xs text-on-surface-variant opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <p className="font-bold text-on-surface mb-1.5">A real trained model, not a rule-based score</p>
              <p className="mb-2">
                A logistic regression trained on {modelInfo.trainingSamples.toLocaleString()} examples
                (held out {modelInfo.testSamples.toLocaleString()} for testing) — precision{' '}
                {(modelInfo.testMetrics.precision * 100).toFixed(0)}%, recall {(modelInfo.testMetrics.recall * 100).toFixed(0)}%.
                Distinct from the Travel Safety Index above, which is rule-based by design.
              </p>
              <p className="text-[11px] italic">{modelInfo.labelSourceNote}</p>
            </div>
          </div>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-colors border',
              filter === f
                ? 'bg-primary-dark text-white border-primary-dark'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary-dark/40'
            )}>
            {f === 'ALL' ? 'All Zones' : (ZONE_META[f]?.label ?? f)}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid md:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-surface-container-lowest rounded-2xl animate-pulse" />)}</div>
      )}

      {risks.length === 0 && !isLoading && (
        <div className="bg-surface-container-lowest rounded-xl p-10 text-center">
          <Shield className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-bold text-on-surface">No active risk zones</p>
          <p className="text-sm text-on-surface-variant">
            {filter === 'ALL' ? 'All tracked tourists are in safe zones' : 'No destinations currently match this filter'}
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {risks.map((zone) => {
          const meta = ZONE_META[zone.zoneType] || ZONE_META.SAFE
          const score = computeRiskScore(zone)
          const WeatherIcon = WEATHER_ICONS[zone.weather?.weather_condition || 'CLEAR'] || Sun
          const key = zone.destinationId || zone.city
          const isOpen = expanded === key

          return (
            <div key={key} className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant">
              {/* HD photo header */}
              <div className="relative h-40">
                <img src={getDestinationImage(zone.city, { w: 800 })} alt={zone.city}
                  className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-slate-950/10" />
                <div className="relative h-full flex flex-col justify-between p-4">
                  <div className="flex items-start justify-between">
                    <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', meta.badge)}>{meta.label}</span>
                    <RiskGauge score={score} color={meta.ring} />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-xl leading-tight">{zone.city}</h3>
                    <p className="text-xs text-white/75 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {zone.state}
                      {zone.weather && (
                        <span className="ml-2 flex items-center gap-1">
                          <WeatherIcon className="w-3.5 h-3.5" /> {zone.weather.temp_celsius}°C · {zone.weather.weather_condition}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2 p-4 pb-3">
                <div className="text-center">
                  <p className="text-lg font-black text-on-surface flex items-center justify-center gap-1"><Users className="w-3.5 h-3.5 text-on-surface-variant" />{zone.total}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Tourists</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-blue-600">{zone.solo}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Solo</p>
                </div>
                <div className="text-center">
                  <p className={cn('text-lg font-black', zone.highRisk > 0 ? 'text-orange-600' : 'text-on-surface')}>{zone.highRisk}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">High TSI</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-on-surface">{zone.altitudeM != null ? `${zone.altitudeM}m` : '—'}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Altitude</p>
                </div>
              </div>

              {/* Expandable detail */}
              <button onClick={() => setExpanded(isOpen ? null : key)}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs font-semibold text-primary-dark border-t border-outline-variant hover:bg-surface-container transition-colors">
                {isOpen ? 'Hide details' : 'View emergency infrastructure & advisory'}
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-outline-variant bg-surface-container/40">
                  {zone.description && (
                    <p className="text-xs text-on-surface-variant italic pt-3">{zone.description}</p>
                  )}
                  <div className="flex items-start gap-2 text-xs">
                    <HeartPulse className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-on-surface">
                      {zone.nearestHospitalName || 'No hospital on record'}
                      {zone.nearestHospitalKm && <span className="text-on-surface-variant"> · {zone.nearestHospitalKm} km away</span>}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Mountain className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                    <span className="text-on-surface">
                      {zone.difficulty ? `${zone.difficulty} difficulty` : 'Difficulty not rated'} · {zone.connectivity} connectivity
                    </span>
                  </div>
                  {zone.predictedRisk && (() => {
                    const rm = PREDICTED_RISK_META[zone.predictedRisk.label] || PREDICTED_RISK_META.Moderate
                    return (
                      <div className="bg-violet-50/60 border border-violet-200 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700 uppercase tracking-wide">
                            <BrainCircuit className="w-3.5 h-3.5" /> Predicted Incident Risk
                          </span>
                          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', rm.badge)}>
                            {zone.predictedRisk.percentage}% · {zone.predictedRisk.label}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-violet-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${zone.predictedRisk.percentage}%`, background: rm.bar }} />
                        </div>
                        <p className="text-[10px] text-on-surface-variant">
                          Top factors: {zone.predictedRisk.topFactors.slice(0, 3).map(f => humanizeFeature(f.feature)).join(', ')}
                        </p>
                      </div>
                    )
                  })()}
                  {zone.govtAdvisory && (
                    <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span className="text-amber-800">{zone.govtAdvisory}</span>
                    </div>
                  )}
                  {!zone.govtAdvisory && (
                    <div className="flex items-start gap-2 text-xs text-on-surface-variant">
                      <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> No standing advisory for this destination.
                    </div>
                  )}
                  {zone.destinationId && (
                    <Button size="sm" variant="outline" onClick={() => setAlertTarget(zone)}
                      className="w-full mt-1 rounded-lg text-xs flex items-center gap-1.5">
                      <Megaphone className="w-3.5 h-3.5" /> Post News / Alert
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Dialog open={!!alertTarget} onOpenChange={(open) => !open && resetAlertForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post News / Alert — {alertTarget?.city}</DialogTitle>
            <DialogDescription>
              Visible to every tourist with this destination on their itinerary. CRITICAL severity pushes an immediate notification to anyone with an active trip here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Category</label>
                <Select value={category} onValueChange={(v) => setCategory(v as PostNewsPayload['category'])}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NEWS_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Severity</label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as PostNewsPayload['severity'])}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NEWS_SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Headline *</label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Sela Pass closed due to fresh snowfall" className="h-10 rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Details</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Additional context for travelers..." rows={3} className="rounded-lg" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => postAlert()} disabled={postingAlert || headline.trim().length < 3}
              className="bg-primary hover:brightness-95 text-primary-foreground font-bold rounded-lg">
              {postingAlert ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {postingAlert ? 'Posting...' : 'Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
