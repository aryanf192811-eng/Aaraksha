// src/services/travelScoring.service.js
// Pure, deterministic itinerary scoring -- no DB, no Gemini, no network.
// Same shape/contract as tsi.service.js: every number here is a real,
// explainable computation. This is the boundary the whole "Build My
// Journey" feature is built around: an LLM only ever narrates the output
// of this module, it never computes a fact this module could compute
// itself. See travelPlanner.service.js for how this gets called.
'use strict'

const { haversineKm } = require('../utils/geo')
const { calculateStopRisk } = require('./tsi.service')

// A handful of fixed, explainable tags matched by simple keyword presence
// in a destination's free-text description/difficulty -- no embeddings, no
// ML, so every match is directly explainable ("matched because the
// description mentions 'trek'"), matching this codebase's existing
// "no PostGIS, plain haversineKm loops" preference for simple over exotic.
const INTEREST_KEYWORDS = {
  NATURE:      ['valley', 'waterfall', 'nature', 'scenic', 'hill', 'lake', 'river', 'forest'],
  ADVENTURE:   ['trek', 'trekking', 'adventure', 'climb', 'expedition', 'camp'],
  WILDLIFE:    ['wildlife', 'national park', 'sanctuary', 'rhino', 'tiger', 'bird'],
  CULTURE:     ['village', 'tribal', 'monastery', 'heritage', 'festival', 'craft'],
  RELAXATION:  [], // no keyword set -- scored from difficulty/connectivity instead, below
}
const INTEREST_TAGS = Object.keys(INTEREST_KEYWORDS)

// Used only when a destination has zero destination_reviews rows yet (no
// real cost data to draw on) -- a clearly-labeled estimate, never presented
// as a measured fact. travelPlanner.service.js marks these in the response
// so the frontend can show "estimated" rather than implying a real number.
const FALLBACK_DAILY_SPEND_INR = 1500

function matchesInterest(destination, tag) {
  if (tag === 'RELAXATION') {
    return destination.difficulty === 'EASY' && ['GOOD', 'EXCELLENT'].includes(destination.connectivity)
  }
  const haystack = `${destination.description || ''} ${destination.name || ''}`.toLowerCase()
  return (INTEREST_KEYWORDS[tag] || []).some((kw) => haystack.includes(kw))
}

function interestMatchScore(destinations, interests) {
  if (!interests || interests.length === 0) return { score: 70, matchedPerStop: destinations.map(() => []) }
  const matchedPerStop = destinations.map((d) => INTEREST_TAGS.filter((tag) => interests.includes(tag) && matchesInterest(d, tag)))
  const matchedCount = matchedPerStop.filter((m) => m.length > 0).length
  const score = destinations.length > 0 ? Math.round((matchedCount / destinations.length) * 100) : 70
  return { score, matchedPerStop }
}

// Greedy nearest-neighbor ordering from the origin. Not a real TSP solver --
// deliberately not, for a handful of stops (typical itinerary is 2-6 NE
// destinations) a greedy heuristic gets within a few percent of optimal and
// stays instant, explainable, and dependency-free. This is what actually
// answers "visit B before A" -- the order it returns IS the recommendation.
function orderStopsGreedy(origin, destinations) {
  const remaining = [...destinations]
  const ordered = []
  let current = origin
  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current.lat, current.lng, remaining[i].latitude, remaining[i].longitude)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    ordered.push(next)
    current = { lat: next.latitude, lng: next.longitude }
  }
  return ordered
}

// Total path length for a given stop order, vs. the length of the greedy
// (near-optimal) order for the SAME stop set -- the ratio is the
// backtracking penalty. A route already in greedy order scores ~1.0; a
// route that zigzags scores higher, and callers weight that down.
function backtrackingRatio(origin, orderedDestinations) {
  const pathLength = (stops) => {
    let total = 0
    let current = origin
    for (const s of stops) {
      total += haversineKm(current.lat, current.lng, s.latitude, s.longitude)
      current = { lat: s.latitude, lng: s.longitude }
    }
    return total
  }
  const actual = pathLength(orderedDestinations)
  const optimal = pathLength(orderStopsGreedy(origin, orderedDestinations))
  if (optimal === 0) return 1
  return actual / optimal
}

function budgetFitScore(totalCostInr, budgetInr) {
  if (!budgetInr || budgetInr <= 0) return 100
  if (totalCostInr <= budgetInr) return 100
  const overPct = ((totalCostInr - budgetInr) / budgetInr) * 100
  return Math.max(0, Math.round(100 - overPct * 2))
}

function durationFitScore(totalMinutesNeeded, days) {
  const availableMinutes = days * 24 * 60
  if (totalMinutesNeeded <= availableMinutes) return 100
  const overPct = ((totalMinutesNeeded - availableMinutes) / availableMinutes) * 100
  return Math.max(0, Math.round(100 - overPct * 3))
}

// Reuses tsi.service.js's own per-stop risk math -- the worst stop drives
// the safety signal, same "worst stop, not average" philosophy calculateTSI
// already uses for a committed trip, so a planned-but-not-yet-committed
// itinerary and an actual trip never disagree about which stop is riskiest.
function safetySignal(orderedDestinations) {
  const stopRisks = orderedDestinations.map((d) => calculateStopRisk({
    city: d.name, destinationId: d.id, connectivity: d.connectivity,
    difficulty: d.difficulty, altitude_m: d.altitude_m, zone_type: d.zone_type,
    hospital_km: d.nearest_hospital_km,
  }, {}))
  const worst = stopRisks.reduce((w, s) => (s.penalty > (w?.penalty ?? -Infinity) ? s : w), null)
  return { stopRisks, worstStop: worst, score: worst?.score ?? 100 }
}

// One leg per consecutive pair. `legsByPair` is a Map keyed by
// "fromDestinationId_toDestinationId" -> typical_routes row, built by the
// caller from the DB. A missing pair (no curated leg yet -- expected while
// the dataset is still being grown, see chatbot.md) falls back to a rough
// haversine-based estimate, clearly flagged so the frontend/Gemini prompt
// never treats it as a measured fact.
function buildLegs(origin, orderedDestinations, legsByPair) {
  const legs = []
  let current = { id: null, lat: origin.lat, lng: origin.lng, name: origin.name || 'Start' }
  for (const dest of orderedDestinations) {
    const key = `${current.id}_${dest.id}`
    const curated = legsByPair.get(key)
    if (curated) {
      legs.push({
        fromName: current.name, toName: dest.name, mode: curated.mode,
        durationMinutes: curated.duration_minutes, costMinInr: curated.cost_min_inr,
        costMaxInr: curated.cost_max_inr, notes: curated.notes, estimated: false,
      })
    } else {
      const distanceKm = haversineKm(current.lat, current.lng, dest.latitude, dest.longitude)
      legs.push({
        fromName: current.name, toName: dest.name, mode: 'SHARED_TAXI',
        durationMinutes: Math.round((distanceKm / 35) * 60), // ~35km/h rough NE road speed
        costMinInr: Math.round(distanceKm * 8), costMaxInr: Math.round(distanceKm * 14),
        notes: null, estimated: true,
      })
    }
    current = { id: dest.id, lat: dest.latitude, lng: dest.longitude, name: dest.name }
  }
  return legs
}

// The single entry point. Returns everything already computed -- Gemini
// (in travelPlanner.service.js) only ever narrates this object, never
// recomputes or contradicts a number in it.
function scoreCandidateItinerary({ origin, destinations, legsByPair, reviewSummaryById, budgetInr, days, interests }) {
  const ordered = orderStopsGreedy(origin, destinations)
  const legs = buildLegs(origin, ordered, legsByPair)

  const legsCostInr = legs.reduce((sum, l) => sum + l.costMaxInr, 0)
  const legsMinutes = legs.reduce((sum, l) => sum + l.durationMinutes, 0)
  const daysPerStop = Math.max(1, Math.floor(days / Math.max(1, ordered.length)))
  const localSpend = ordered.reduce((sum, d) => {
    const review = reviewSummaryById?.get(d.id)
    const dailySpend = review?.avgCostInr || FALLBACK_DAILY_SPEND_INR
    return sum + dailySpend * daysPerStop
  }, 0)
  const totalCostInr = Math.round(legsCostInr + localSpend)

  const totalMinutesNeeded = legsMinutes + ordered.length * daysPerStop * 24 * 60

  const { score: interestScore, matchedPerStop } = interestMatchScore(ordered, interests)
  const backtrack = backtrackingRatio(origin, ordered)
  const backtrackScore = Math.max(0, Math.round(100 - (backtrack - 1) * 100))
  const budgetScore = budgetFitScore(totalCostInr, budgetInr)
  const durationScore = durationFitScore(totalMinutesNeeded, days)
  const { stopRisks, worstStop, score: safetyScore } = safetySignal(ordered)

  const overallScore = Math.round(
    budgetScore * 0.3 + durationScore * 0.2 + safetyScore * 0.2 + interestScore * 0.15 + backtrackScore * 0.15
  )

  return {
    orderedStops: ordered.map((d, i) => ({
      id: d.id, name: d.name, state: d.state, lat: d.latitude, lng: d.longitude,
      matchedInterests: matchedPerStop[i], popularityIndex: d.popularity_index,
      reviewSummary: reviewSummaryById?.get(d.id) || null,
    })),
    legs,
    totalCostInr,
    daysNeeded: Math.ceil(totalMinutesNeeded / (24 * 60)),
    scores: { overall: overallScore, budget: budgetScore, duration: durationScore, safety: safetyScore, interestMatch: interestScore, backtracking: backtrackScore },
    safety: { stopRisks, worstStop },
    localSpendEstimated: ordered.some((d) => !reviewSummaryById?.get(d.id)?.avgCostInr),
  }
}

module.exports = { scoreCandidateItinerary, orderStopsGreedy, backtrackingRatio, budgetFitScore, durationFitScore, interestMatchScore, INTEREST_TAGS }
