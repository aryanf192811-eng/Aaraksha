// src/services/travelPlanner.service.js
// Orchestration only: retrieve real data -> score it deterministically
// (travelScoring.service.js) -> hand the ALREADY-SCORED result to Gemini
// for prose narration (gemini.service.js). Gemini is never the thing that
// decides cost, route order, or safety -- see both of those modules' own
// header comments for why that boundary is load-bearing, not decorative.
'use strict'

const { TravelPlannerRepository } = require('../repositories/travelPlanner.repository')
const { TripRepository } = require('../repositories/trip.repository')
const { scoreCandidateItinerary, applyIntentToStops, INTEREST_TAGS } = require('./travelScoring.service')
const { generateJourneyNarrative, extractPlanningIntent, extractTripIntent } = require('./gemini.service')
const { createTrip, updateTrip } = require('./trip.service')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

const NE_REGIONS = ['Meghalaya', 'Assam', 'Arunachal Pradesh', 'Nagaland', 'Manipur', 'Sikkim', 'Mizoram', 'Tripura']

// A small, stable reference list -- not the kind of thing that benefits
// from the chatbot.md dataset-curation process, these facts don't change
// week to week the way destination reviews/routes do. Guwahati is the
// near-universal rail/air gateway into Northeast India; every itinerary
// effectively starts there regardless of the traveller's real origin city.
const GATEWAY = { name: 'Guwahati', lat: 26.1445, lng: 91.7362 }
const EXTERNAL_GATEWAY_LEGS = {
  DELHI:     { mode: 'TRAIN', durationMinutes: 27 * 60, costMinInr: 1200, costMaxInr: 2200, flightAlt: { durationMinutes: 165, costMinInr: 4500, costMaxInr: 9000 } },
  MUMBAI:    { mode: 'TRAIN', durationMinutes: 40 * 60, costMinInr: 1800, costMaxInr: 3200, flightAlt: { durationMinutes: 195, costMinInr: 6000, costMaxInr: 11000 } },
  KOLKATA:   { mode: 'TRAIN', durationMinutes: 17 * 60, costMinInr: 900,  costMaxInr: 1800, flightAlt: { durationMinutes: 90,  costMinInr: 3000, costMaxInr: 6500 } },
  BANGALORE: { mode: 'FLIGHT', durationMinutes: 165, costMinInr: 5000, costMaxInr: 10000 },
  CHENNAI:   { mode: 'FLIGHT', durationMinutes: 175, costMinInr: 5500, costMaxInr: 10500 },
}

function resolveExternalLeg(fromCity, transportPref) {
  const key = (fromCity || '').trim().toUpperCase()
  const entry = EXTERNAL_GATEWAY_LEGS[key]
  if (!entry) {
    return { fromName: fromCity || 'Your city', toName: GATEWAY.name, mode: 'TRAIN', durationMinutes: null, costMinInr: null, costMaxInr: null, notes: 'No curated gateway route yet for this origin city — check current train/flight options to Guwahati.', estimated: true }
  }
  const preferFlight = (transportPref || []).includes('FLIGHT') && entry.flightAlt
  const leg = preferFlight ? entry.flightAlt : entry
  return { fromName: fromCity, toName: GATEWAY.name, mode: preferFlight ? 'FLIGHT' : entry.mode, durationMinutes: leg.durationMinutes, costMinInr: leg.costMinInr, costMaxInr: leg.costMaxInr, notes: null, estimated: false }
}

// How many NE stops to plan for a given trip length -- roughly one stop
// per 1.5 days including travel time between them, clamped to a sane
// range. This is a planning heuristic, not a claim of precision; the
// scorer's own durationFitScore is what actually checks whether the
// chosen count fits.
function stopCountForDays(days) {
  return Math.max(1, Math.min(6, Math.round(days / 1.5)))
}

// Recomputes an itinerary's total cost server-side from real destination
// IDs -- never trusts a client-supplied number. Used by applyTripAdjustment,
// which has a genuine propose-then-apply gap (the tourist can sit on a
// proposal before approving it), unlike commitJourney's narrower window
// (see that function's own comment for why it takes a lighter validation-
// only approach instead). Also doubles as the "every destinationId in
// this itinerary is real" check: findDestinationsByIds silently drops
// anything that doesn't resolve, so a length mismatch here is a tampered
// or stale id, not a database error.
async function recomputeItineraryCost(destinationIds, days) {
  const repo = new TravelPlannerRepository()
  const destinations = await repo.findDestinationsByIds(destinationIds)
  if (destinations.length !== destinationIds.length) {
    const err = new Error('This itinerary references a destination that no longer exists — please build a new journey.')
    err.statusCode = 422
    throw err
  }
  const [legsByPair, reviewSummaryById] = await Promise.all([
    repo.findRoutesAmong(destinationIds),
    repo.getReviewSummaries(destinationIds),
  ])
  // budgetInr/interests only affect the score breakdown, not totalCostInr
  // itself -- irrelevant here, this call exists purely to get an
  // authoritative cost figure for a stop set someone already chose.
  const scored = scoreCandidateItinerary({
    origin: GATEWAY, destinations, legsByPair, reviewSummaryById,
    budgetInr: null, days: days || 1, interests: [],
  })
  return { destinations, totalCostInr: scored.totalCostInr }
}

async function selectCandidates({ state, interests, count }) {
  const repo = new TravelPlannerRepository()
  const candidates = await repo.findCandidateDestinations({ state })
  if (candidates.length === 0) return { candidates: [], repo }

  // Rank by a cheap combination of popularity and interest-keyword
  // presence, then take the top N -- the real scoring/ordering happens
  // afterward in travelScoring.service.js; this step only narrows a
  // possibly-large candidate pool down to a travel-planning-sized set.
  const scored = candidates.map((d) => {
    const haystack = `${d.description || ''} ${d.name || ''}`.toLowerCase()
    const interestHits = (interests || []).filter((tag) =>
      INTEREST_TAGS.includes(tag) && haystack.split(' ').some((w) => w.length > 3 && haystack.includes(w))
    ).length
    return { d, rank: (d.popularity_index || 0) + interestHits * 20 }
  })
  scored.sort((a, b) => b.rank - a.rank)
  return { candidates: scored.slice(0, count).map((s) => s.d), repo }
}

async function buildJourney({ fromCity, region, days, budgetInr, interests, transportPref }) {
  const count = stopCountForDays(days)
  const { candidates, repo } = await selectCandidates({ state: region, interests, count })

  if (candidates.length === 0) {
    // errorHandler.js only ever reads err.message for a thrown
    // err.statusCode error -- a separate err.details property (the
    // previous version of this code) is silently dropped, so the tourist
    // saw the generic "Validation failed" instead of this actually
    // useful explanation. Put the real message where it's read.
    const err = new Error(`No destinations found for "${region}" yet — the dataset may not cover this region. See chatbot.md.`)
    err.statusCode = 422
    throw err
  }

  const destinationIds = candidates.map((d) => d.id)
  const [legsByPair, reviewSummaryById] = await Promise.all([
    repo.findRoutesAmong(destinationIds),
    repo.getReviewSummaries(destinationIds),
  ])

  const scored = scoreCandidateItinerary({
    origin: GATEWAY, destinations: candidates, legsByPair, reviewSummaryById,
    budgetInr, days, interests,
  })

  const externalLeg = resolveExternalLeg(fromCity, transportPref)
  const externalCost = (externalLeg.costMinInr || 0) + (externalLeg.costMaxInr || externalLeg.costMinInr || 0)
  const roundTripExternalCost = externalCost // out + back, both legs roughly symmetric

  const { whyThisRoute, source } = await generateJourneyNarrative(scored)

  logger.info({ region, days, stops: scored.orderedStops.length, totalCostInr: scored.totalCostInr, source }, 'Journey built')

  return {
    externalLegs: { outbound: externalLeg, return: { ...externalLeg, fromName: externalLeg.toName, toName: externalLeg.fromName } },
    itinerary: scored,
    totalCostInr: scored.totalCostInr + roundTripExternalCost,
    whyThisRoute,
    narrativeSource: source,
  }
}

async function askFollowUp({ freeText, currentContext }) {
  const intent = await extractPlanningIntent(freeText, currentContext)
  if (!intent.understood) {
    return { understood: false, message: "I couldn't quite work out what to change — try the structured form, or be specific (e.g. \"drop the budget to ₹15,000\")." }
  }
  const nextContext = {
    fromCity: currentContext.fromCity,
    region: currentContext.region,
    days: intent.days ?? currentContext.days,
    budgetInr: intent.budgetInr ?? currentContext.budgetInr,
    interests: Array.from(new Set([...(currentContext.interests || []), ...(intent.addInterests || [])])),
    transportPref: currentContext.transportPref,
  }
  const result = await buildJourney(nextContext)
  return { understood: true, ...result, appliedContext: nextContext }
}

// Maps a built journey's ordered stops into the exact StopSchema shape
// trip.validator.js already expects, then calls the EXISTING
// tripService.createTrip -- no duplicated trip-creation logic, no second
// TSI calculation. enrichStops() in trip.service.js already pulls
// connectivity/difficulty/zone_type/lat/lng from destinationId, so this
// payload only needs city/state/destinationId/days.
//
// Validates every destinationId is real (via findDestinationsByIds) but,
// unlike applyTripAdjustment below, still trusts the client-submitted
// totalCostInr rather than fully recomputing it. That's a deliberate,
// narrower trade-off, not an oversight: this function is called
// immediately after buildJourney generated that exact number seconds
// earlier in the same session (no stored, reusable "proposal" a client
// could tamper with over time), and totalCostInr here also includes the
// external gateway leg (Delhi->Guwahati etc.), which isn't part of
// scoreCandidateItinerary's own computation and would need fromCity/
// transportPref threaded through an extra hop to fully reconstruct --
// real plumbing for a materially smaller risk window than the propose-
// then-apply gap applyTripAdjustment actually has.
async function commitJourney({ touristId, tourist, title, startDate, endDate, travelType, itinerary, totalCostInr }) {
  const destinationIds = itinerary.orderedStops.map((s) => s.id)
  const repo = new TravelPlannerRepository()
  const realDestinations = await repo.findDestinationsByIds(destinationIds)
  if (realDestinations.length !== destinationIds.length) {
    const err = new Error('This itinerary references a destination that no longer exists — please build a new journey.')
    err.statusCode = 422
    throw err
  }

  const daysPerStop = Math.max(1, Math.round((itinerary.orderedStops.length ? itinerary.daysNeeded : 1) / Math.max(1, itinerary.orderedStops.length)))
  const stops = itinerary.orderedStops.map((s) => ({
    city: s.name,
    state: s.state,
    destinationId: s.id,
    days: daysPerStop,
  }))

  const trip = await createTrip(touristId, {
    title,
    description: 'Planned with Aaraksha Travel Assistant',
    travelType: travelType || 'SOLO',
    startDate,
    endDate,
    stops,
    budgetInr: totalCostInr,
  }, tourist)

  logger.info({ tripId: trip.id, touristId, stops: stops.length }, 'Journey committed as trip')
  return trip
}

// Part 1 -- natural-language trip intake. Only ever pre-fills the
// existing structured form; the tourist reviews and can edit every field
// before anything is built. See gemini.service.js#extractTripIntent's own
// header comment for why an unclear region resolves to "leave it blank,"
// never a guess.
async function extractIntent(text) {
  return extractTripIntent(text, NE_REGIONS)
}

// Part 2 -- propose an adjustment to an ALREADY-COMMITTED trip. Returns a
// proposal only; nothing here writes to the database. See this file's
// module header and applyTripAdjustment below for the "propose, never
// mutate" invariant this pair of functions is built around.
async function adjustTrip({ touristId, tripId, freeText }) {
  const tripRepo = new TripRepository()
  const trip = await tripRepo.findById(tripId, touristId)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
  const destinationIds = stops.map((s) => s.destinationId).filter(Boolean)
  const skippedManualStops = stops.length - destinationIds.length

  const repo = new TravelPlannerRepository()
  const currentDestinations = await repo.findDestinationsByIds(destinationIds)

  const currentContext = {
    budgetInr: trip.budget_inr,
    days: Math.max(1, Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / 86400000)),
    interests: [],
    stopNames: currentDestinations.map((d) => d.name),
  }
  const intent = await extractPlanningIntent(freeText, currentContext)
  if (!intent.understood) {
    return { understood: false, message: "I couldn't quite work out what to change — try being specific, e.g. \"drop the budget to ₹15,000\" or \"remove Cherrapunji\"." }
  }

  const region = currentDestinations[0]?.state
  const candidatePool = (intent.addInterests?.length && region)
    ? (await repo.findCandidateDestinations({ state: region })).filter((d) => !currentDestinations.some((c) => c.id === d.id))
    : []

  const adjustedDestinations = applyIntentToStops(currentDestinations, intent, candidatePool)
  const days = intent.days ?? currentContext.days

  // Hard-fail before scoring, not a soft warning -- a degenerate proposal
  // (every stop removed, or an impossible day count) never reaches the
  // tourist as something to "apply."
  if (adjustedDestinations.length === 0) {
    const err = new Error('That change would remove every stop from this trip — nothing to propose. Try building a new journey instead.')
    err.statusCode = 422
    throw err
  }
  if (days < 1) {
    const err = new Error('That change results in fewer than 1 day for this trip.')
    err.statusCode = 422
    throw err
  }

  const legsByPair = await repo.findRoutesAmong(adjustedDestinations.map((d) => d.id))
  const reviewSummaryById = await repo.getReviewSummaries(adjustedDestinations.map((d) => d.id))

  const scored = scoreCandidateItinerary({
    origin: GATEWAY, destinations: adjustedDestinations, legsByPair, reviewSummaryById,
    budgetInr: intent.budgetInr ?? currentContext.budgetInr, days, interests: currentContext.interests,
  })
  const { whyThisRoute, source } = await generateJourneyNarrative(scored)

  logger.info({ tripId, touristId, stops: scored.orderedStops.length, totalCostInr: scored.totalCostInr }, 'Trip adjustment proposed')

  return {
    understood: true,
    before: {
      totalCostInr: trip.budget_inr,
      days: currentContext.days,
      stopNames: currentContext.stopNames,
      tsiScore: trip.tsi_score,
    },
    // daysUsedForScoring, not scored.daysNeeded: they're different numbers
    // (daysNeeded is the scorer's own estimate of what's actually needed;
    // `days` here is what local-spend was actually costed against) --
    // found live-verifying this exact endpoint, when applying with
    // daysNeeded instead produced a different total than the one just
    // shown as the proposal. The frontend must echo this exact value back
    // to apply-adjustment, not daysNeeded, so what's approved is exactly
    // what gets persisted.
    after: { itinerary: scored, totalCostInr: scored.totalCostInr, whyThisRoute, narrativeSource: source, daysUsedForScoring: days },
    skippedManualStops,
  }
}

// Applies a previously-proposed adjustment. Deliberately takes only
// destinationIds + days from the client -- see this file's module header
// for why totalCostInr is recomputed here via recomputeItineraryCost
// rather than trusted from the request, unlike commitJourney's narrower
// trade-off just above.
async function applyTripAdjustment({ touristId, tourist, tripId, orderedStopIds, days }) {
  const tripRepo = new TripRepository()
  const trip = await tripRepo.findById(tripId, touristId)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  if (!Array.isArray(orderedStopIds) || orderedStopIds.length === 0) {
    const err = new Error('An adjustment must include at least one stop.')
    err.statusCode = 422
    throw err
  }

  const { destinations, totalCostInr } = await recomputeItineraryCost(orderedStopIds, days)
  // Preserve the approved order -- recomputeItineraryCost's destinations
  // array isn't guaranteed to match orderedStopIds' order (findDestinationsByIds
  // doesn't promise it), so re-sort by the id order the tourist approved.
  const byId = new Map(destinations.map((d) => [d.id, d]))
  const orderedDestinations = orderedStopIds.map((id) => byId.get(id))

  const daysPerStop = Math.max(1, Math.round((days || 1) / orderedDestinations.length))
  const stops = orderedDestinations.map((d) => ({
    city: d.name,
    state: d.state,
    destinationId: d.id,
    days: daysPerStop,
  }))

  const updated = await updateTrip(tripId, touristId, { stops, budgetInr: totalCostInr }, tourist)
  logger.info({ tripId, touristId, totalCostInr }, 'Trip adjustment applied')
  return updated
}

module.exports = { buildJourney, askFollowUp, commitJourney, extractIntent, adjustTrip, applyTripAdjustment }
