// src/components/shared/TravelAssistantFAB.tsx
// Persistent floating "Build My Journey" assistant, tourist app only.
// Deliberately NOT a plain chat-bubble thread -- see JourneyResultCard.tsx
// for why. Every number shown here came from a deterministic scorer
// (travelScoring.service.js); Gemini only narrates it. See chatbot.md for
// the dataset this reasons over and travelPlanner.service.js's header
// comment for the "AI explains, doesn't decide" boundary this whole
// feature is built around.
//
// Two modes: "Plan a journey" (build a fresh itinerary, optionally kicked
// off with a natural-language description that pre-fills the form below --
// never skips it) and "Adjust my journey" (propose/apply a change to a
// trip already committed -- only offered when the current route is that
// trip's own page). See travelPlanner.service.js#adjustTrip/
// applyTripAdjustment for the "propose, never mutate directly" invariant
// the adjust mode is built around.
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Compass, X, Loader2, Send, Sparkles, IndianRupee, CalendarDays, MapPinned, Rocket, Wand2, ArrowRight } from 'lucide-react'
import { useDragSheet } from '../../hooks/useDragSheet'
import { cn } from '../../lib/utils'
import { getErrorMessage } from '../../api/client'
import tripApi from '../../api/trip.api'
import travelPlannerApi, { type BuildJourneyPayload, type BuildJourneyResult, type Interest, type TransportMode } from '../../api/travelPlanner.api'
import { JourneyResultCard } from './travelAssistant/JourneyResultCard'

const NE_STATES = ['Meghalaya', 'Assam', 'Arunachal Pradesh', 'Nagaland', 'Manipur', 'Sikkim']
const INTEREST_OPTIONS: { value: Interest; label: string }[] = [
  { value: 'NATURE', label: 'Nature' }, { value: 'ADVENTURE', label: 'Adventure' },
  { value: 'CULTURE', label: 'Culture' }, { value: 'WILDLIFE', label: 'Wildlife' },
  { value: 'RELAXATION', label: 'Relaxation' },
]
const TRANSPORT_OPTIONS: { value: TransportMode; label: string }[] = [
  { value: 'TRAIN', label: 'Train' }, { value: 'FLIGHT', label: 'Flight' },
]
const ORIGIN_QUICK_PICKS = ['Delhi', 'Mumbai', 'Kolkata', 'Bangalore', 'Chennai']

function fmtInr(n: number) { return `₹${n.toLocaleString('en-IN')}` }

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-on-surface-variant">{label}</span>
      <span className="font-bold text-on-surface text-right">{value}</span>
    </div>
  )
}

export function TravelAssistantFAB() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const { handleProps, sheetStyle } = useDragSheet({ onClose: () => setOpen(false) })

  const tripPageMatch = location.pathname.match(/^\/trips\/([0-9a-f-]{36})$/i)
  const contextTripId = tripPageMatch?.[1] ?? null
  const [mode, setMode] = useState<'build' | 'adjust'>(contextTripId ? 'adjust' : 'build')

  const { data: contextTrip } = useQuery({
    queryKey: ['trip', contextTripId, 'for-assistant'],
    queryFn: () => tripApi.getTripById(contextTripId!).then((r) => r.data.data),
    enabled: open && !!contextTripId,
  })

  // ── Part 1: natural-language pre-fill ────────────────────────────────
  // 'intro' -> just the free-text box (the default, "Notion-AI style" entry
  // point). 'confirm' -> read-only summary of what was extracted, with an
  // Edit action and a chat box to refine further before building -- never
  // silently building on the user's behalf, but never making them fill in
  // a raw form first either. 'form' -> the original field-by-field form,
  // now reached only via "Edit details" or "fill in manually" -- demoted
  // from the default path, not removed (a bad/partial extraction still
  // needs a correction path).
  const [stage, setStage] = useState<'intro' | 'confirm' | 'form'>('intro')
  const [nlText, setNlText] = useState('')
  const [fromCity, setFromCity] = useState('Delhi')
  const [region, setRegion] = useState('Meghalaya')
  const [days, setDays] = useState(5)
  const [budgetInr, setBudgetInr] = useState(20000)
  const [interests, setInterests] = useState<Interest[]>(['NATURE'])
  const [transportPref, setTransportPref] = useState<TransportMode[]>([])
  const [followUp, setFollowUp] = useState('')
  const [result, setResult] = useState<BuildJourneyResult | null>(null)

  const { mutate: extractIntent, isPending: extracting } = useMutation({
    mutationFn: () => travelPlannerApi.extractIntent(nlText).then((r) => r.data.data),
    onSuccess: (data) => {
      if (data.fromCity) setFromCity(data.fromCity)
      if (data.region) setRegion(data.region)
      if (data.days) setDays(data.days)
      if (data.budgetInr) setBudgetInr(data.budgetInr)
      if (data.interests?.length) setInterests(data.interests)
      if (data.transportPref?.length) setTransportPref(data.transportPref)
      // Always land on the confirm screen, understood or not -- a partial
      // read still pre-fills what it could, and Edit is right there for
      // whatever it missed. There's no "understood: false, back to a blank
      // form" dead end.
      setStage('confirm')
      if (!data.understood) toast.message("Couldn't pick up much from that — check the details below and edit anything that's off.")
      else toast.success('Filled in from your description — check it over before building.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const context: BuildJourneyPayload = { fromCity, region, days, budgetInr, interests, transportPref }

  const { mutate: build, isPending: building } = useMutation({
    mutationFn: () => travelPlannerApi.buildJourney(context).then((r) => r.data.data),
    onSuccess: (data) => setResult(data),
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const { mutate: ask, isPending: asking } = useMutation({
    mutationFn: () => travelPlannerApi.askFollowUp(followUp, { ...context, stopNames: result?.itinerary.orderedStops.map((s) => s.name) }).then((r) => r.data.data),
    onSuccess: (data) => {
      if (!data.understood) { toast.message(data.message || "Didn't understand that — try being specific."); return }
      setDays(data.appliedContext.days ?? days)
      setBudgetInr(data.appliedContext.budgetInr ?? budgetInr)
      setInterests((data.appliedContext.interests as Interest[]) ?? interests)
      setResult(data)
      setFollowUp('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const { mutate: commit, isPending: committing } = useMutation({
    mutationFn: () => {
      if (!result) throw new Error('No journey to start')
      const startDate = new Date()
      const endDate = new Date(startDate.getTime() + result.itinerary.daysNeeded * 86400000)
      return travelPlannerApi.commitJourney({
        title: `${region} trip via Aaraksha Assistant`,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        totalCostInr: result.totalCostInr,
        itinerary: result.itinerary,
      }).then((r) => r.data.data)
    },
    onSuccess: (trip) => {
      toast.success('Journey started — now a real, monitored Aaraksha trip.')
      setOpen(false)
      resetBuildState()
      navigate(`/trips/${trip.id}`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // Clears the whole "plan a journey" flow back to its default entry point.
  // The FAB is mounted globally (see main.tsx) and never unmounts between
  // trips, so without this, opening it again after committing a journey
  // would silently resume mid-flow on stale text/results instead of
  // starting fresh.
  const resetBuildState = () => {
    setStage('intro')
    setNlText('')
    setResult(null)
    setFollowUp('')
  }

  // ── Part 2: adjust an already-committed trip ─────────────────────────
  const [adjustText, setAdjustText] = useState('')
  const [proposal, setProposal] = useState<{
    before: { totalCostInr: number; days: number; stopNames: string[]; tsiScore: number | null }
    after: Omit<BuildJourneyResult, 'externalLegs'> & { daysUsedForScoring: number }
  } | null>(null)

  const { mutate: proposeAdjustment, isPending: proposing } = useMutation({
    mutationFn: () => {
      if (!contextTripId) throw new Error('No trip selected')
      return travelPlannerApi.adjustTrip(contextTripId, adjustText).then((r) => r.data.data)
    },
    onSuccess: (data) => {
      if (!data.understood) { toast.message(data.message); return }
      setProposal(data)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const { mutate: applyAdjustment, isPending: applying } = useMutation({
    mutationFn: () => {
      if (!contextTripId || !proposal) throw new Error('Nothing to apply')
      const ids = proposal.after.itinerary.orderedStops.map((s) => s.id)
      return travelPlannerApi.applyTripAdjustment(contextTripId, ids, proposal.after.daysUsedForScoring)
    },
    onSuccess: () => {
      toast.success('Trip updated.')
      setProposal(null)
      setAdjustText('')
      setOpen(false)
      // Full reload of the trip detail page's own query -- simplest way
      // to guarantee every tab (itinerary/budget/map) reflects the change
      // immediately, matching how committing a fresh journey already
      // navigates to a freshly-loaded trip page.
      navigate(0)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const toggleInterest = (tag: Interest) =>
    setInterests((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : cur.length < 5 ? [...cur, tag] : cur))
  const toggleTransport = (mode: TransportMode) =>
    setTransportPref((cur) => (cur.includes(mode) ? cur.filter((m) => m !== mode) : [...cur, mode]))

  return (
    <>
      {/* Positioned above BottomNav's raised center SOS button — bottom-right
          keeps it clear of that existing high-priority control entirely. */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Aaraksha Travel Assistant"
        className="fixed z-30 right-4 bottom-24 w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30 flex items-center justify-center text-white active:scale-95 transition-transform"
      >
        <span className="absolute inset-0 rounded-full bg-amber-400 opacity-40 animate-ping motion-reduce:hidden" />
        <Compass className="w-6 h-6 relative" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[1100] flex items-end sm:items-center sm:justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={sheetStyle}
            className="w-full sm:w-[440px] sm:rounded-3xl bg-surface rounded-t-3xl shadow-2xl h-[85vh] max-h-[720px] flex flex-col overflow-hidden">
            <div {...handleProps} className="flex-shrink-0 pt-2.5 pb-1 flex justify-center">
              <div className="w-10 h-1 bg-outline-variant rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 border-b border-outline-variant flex-shrink-0">
              <p className="flex items-center gap-2 font-display font-black text-on-surface">
                <Sparkles className="w-4 h-4 text-amber-500" /> Aaraksha Travel Assistant
              </p>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container">
                <X className="w-4 h-4 text-on-surface-variant" />
              </button>
            </div>

            {contextTripId && !result && !proposal && (
              <div className="flex-shrink-0 px-4 pt-3 grid grid-cols-2 gap-1.5">
                <button onClick={() => setMode('adjust')}
                  className={cn('text-xs font-bold py-2 rounded-full border text-center', mode === 'adjust' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant')}>
                  Adjust my journey
                </button>
                <button onClick={() => setMode('build')}
                  className={cn('text-xs font-bold py-2 rounded-full border text-center', mode === 'build' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant')}>
                  Plan a journey
                </button>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
              {mode === 'adjust' && contextTripId ? (
                <>
                  {!proposal ? (
                    <>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Adjusting <span className="font-bold text-on-surface">{contextTrip?.title || 'this trip'}</span>. Tell me what to change — I'll show you exactly what it does before anything is saved.
                      </p>
                      <textarea value={adjustText} onChange={(e) => setAdjustText(e.target.value)} rows={3}
                        placeholder='e.g. "I have ₹4,000 less now" or "remove Cherrapunji"'
                        className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                    </>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">What changes</p>
                        <div className="grid grid-cols-2 gap-3 text-center">
                          <div>
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase">Before</p>
                            <p className="font-black text-on-surface">{fmtInr(proposal.before.totalCostInr)}</p>
                            <p className="text-[11px] text-on-surface-variant">{proposal.before.stopNames.join(', ')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-primary uppercase flex items-center justify-center gap-1"><ArrowRight className="w-3 h-3" /> After</p>
                            <p className="font-black text-primary">{fmtInr(proposal.after.totalCostInr)}</p>
                            <p className="text-[11px] text-on-surface-variant">{proposal.after.itinerary.orderedStops.map((s) => s.name).join(', ')}</p>
                          </div>
                        </div>
                      </div>
                      <JourneyResultCard result={proposal.after} />
                      <button onClick={() => setProposal(null)}
                        className="w-full text-xs font-bold text-on-surface-variant hover:text-primary py-1">
                        ← Never mind, try a different change
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {!result ? (
                    stage === 'intro' ? (
                      <>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          Tell me where you're starting from and what you're after — I'll build a real, costed itinerary from Aaraksha's Northeast India data, not a guess.
                        </p>
                        <div>
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 flex items-center gap-1"><Wand2 className="w-3 h-3" /> Describe your trip</label>
                          <textarea value={nlText} onChange={(e) => setNlText(e.target.value)} rows={3}
                            placeholder='e.g. "6 days in Meghalaya from Delhi, under ₹20,000, mostly nature"'
                            className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                          <button onClick={() => extractIntent()} disabled={extracting || !nlText.trim()}
                            className="mt-1.5 w-full h-10 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {extracting ? 'Reading your trip…' : 'Plan it'}
                          </button>
                        </div>
                        <button onClick={() => setStage('form')}
                          className="w-full text-xs font-bold text-on-surface-variant hover:text-primary py-1">
                          or fill in the details yourself
                        </button>
                      </>
                    ) : stage === 'confirm' ? (
                      <>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          Here's what I picked up — check it over, or tell me what to change.
                        </p>
                        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm p-4 space-y-2.5">
                          <SummaryRow label="From" value={fromCity} />
                          <SummaryRow label="Region" value={region} />
                          <SummaryRow label="Duration" value={`${days} day${days === 1 ? '' : 's'}`} />
                          <SummaryRow label="Budget" value={fmtInr(budgetInr)} />
                          <SummaryRow label="Interests" value={interests.length ? interests.map((i) => INTEREST_OPTIONS.find((o) => o.value === i)?.label || i).join(', ') : 'Not specified'} />
                          <SummaryRow label="Transport" value={transportPref.length ? transportPref.map((m) => TRANSPORT_OPTIONS.find((o) => o.value === m)?.label || m).join(', ') : 'No preference'} />
                        </div>
                        <button onClick={() => setStage('form')}
                          className="w-full h-9 rounded-full border border-outline-variant text-on-surface text-xs font-bold flex items-center justify-center gap-1.5">
                          Edit details
                        </button>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Starting from</label>
                          <input value={fromCity} onChange={(e) => setFromCity(e.target.value)}
                            className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {ORIGIN_QUICK_PICKS.map((c) => (
                              <button key={c} onClick={() => setFromCity(c)}
                                className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full border', fromCity === c ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant')}>
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 flex items-center gap-1"><MapPinned className="w-3 h-3" /> Where in the Northeast</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {NE_STATES.map((s) => (
                              <button key={s} onClick={() => setRegion(s)}
                                className={cn('text-xs font-bold px-2 py-2 rounded-xl border text-center', region === s ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant')}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Days</label>
                            <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)}
                              className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Budget</label>
                            <input type="number" min={0} step={500} value={budgetInr} onChange={(e) => setBudgetInr(Number(e.target.value) || 0)}
                              className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Interests</label>
                          <div className="flex flex-wrap gap-1.5">
                            {INTEREST_OPTIONS.map(({ value, label }) => (
                              <button key={value} onClick={() => toggleInterest(value)}
                                className={cn('text-xs font-bold px-3 py-1.5 rounded-full border', interests.includes(value) ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant')}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Prefer (optional)</label>
                          <div className="flex flex-wrap gap-1.5">
                            {TRANSPORT_OPTIONS.map(({ value, label }) => (
                              <button key={value} onClick={() => toggleTransport(value)}
                                className={cn('text-xs font-bold px-3 py-1.5 rounded-full border', transportPref.includes(value) ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant')}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button onClick={() => setStage('confirm')}
                          className="w-full text-xs font-bold text-on-surface-variant hover:text-primary py-1">
                          ← Back to summary
                        </button>
                      </>
                    )
                  ) : (
                    <>
                      <JourneyResultCard result={result} />
                      <button onClick={resetBuildState}
                        className="w-full text-xs font-bold text-on-surface-variant hover:text-primary py-1">
                        ← Start over with a new request
                      </button>
                    </>
                  )}

                  {building && (
                    <div className="flex flex-col items-center gap-2 py-8 text-on-surface-variant">
                      <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                      <p className="text-xs font-semibold">Scoring routes across Northeast India…</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex-shrink-0 border-t border-outline-variant p-3 bg-surface">
              {mode === 'adjust' && contextTripId ? (
                !proposal ? (
                  <button onClick={() => proposeAdjustment()} disabled={proposing || !adjustText.trim()}
                    className="w-full h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                    {proposing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Propose adjustment
                  </button>
                ) : (
                  <button onClick={() => applyAdjustment()} disabled={applying}
                    className="w-full h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                    {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    Apply this change
                  </button>
                )
              ) : !result && stage === 'confirm' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={followUp} onChange={(e) => setFollowUp(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && followUp.trim() && !asking) ask() }}
                      placeholder='anything to change? e.g. "make it 3 days shorter"'
                      className="flex-1 rounded-full border border-outline-variant bg-surface-container px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                    <button onClick={() => ask()} disabled={asking || !followUp.trim()}
                      aria-label="Send"
                      className="w-11 h-11 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center flex-shrink-0 disabled:opacity-40">
                      {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <button onClick={() => build()} disabled={building}
                    className="w-full h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                    {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Compass className="w-4 h-4" />}
                    Build My Journey
                  </button>
                </div>
              ) : !result && stage === 'form' ? (
                <button onClick={() => build()} disabled={building}
                  className="w-full h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                  {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Compass className="w-4 h-4" />}
                  Build My Journey
                </button>
              ) : !result ? null : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={followUp} onChange={(e) => setFollowUp(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && followUp.trim() && !asking) ask() }}
                      placeholder='e.g. "only ₹12,000 now" or "drop a stop"'
                      className="flex-1 rounded-full border border-outline-variant bg-surface-container px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                    <button onClick={() => ask()} disabled={asking || !followUp.trim()}
                      aria-label="Send"
                      className="w-11 h-11 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center flex-shrink-0 disabled:opacity-40">
                      {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <button onClick={() => commit()} disabled={committing}
                    className="w-full h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                    {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    Start This Journey
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
