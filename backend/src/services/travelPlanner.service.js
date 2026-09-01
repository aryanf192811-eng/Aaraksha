// src/services/travelPlanner.service.js
// Orchestration only: retrieve real data -> score it deterministically
// (travelScoring.service.js) -> hand the ALREADY-SCORED result to Gemini
// for prose narration (gemini.service.js). Gemini is never the thing that
// decides cost, route order, or safety -- see both of those modules' own
// header comments for why that boundary is load-bearing, not decorative.
'use strict'

const { TravelPlannerRepository } = require('../repositories/travelPlanner.repository')
const { scoreCandidateItinerary, INTEREST_TAGS } = require('./travelScoring.service')
const { generateJourneyNarrative, extractPlanningIntent } = require('./gemini.service')
const { createTrip } = require('./trip.service')
const logger = require('../utils/logger')

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
async function commitJourney({ touristId, tourist, title, startDate, endDate, travelType, itinerary, totalCostInr }) {
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

module.exports = { buildJourney, askFollowUp, commitJourney }
