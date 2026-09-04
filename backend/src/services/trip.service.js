// src/services/trip.service.js
'use strict'

const { v4: uuid } = require('uuid')
const { TripRepository } = require('../repositories/trip.repository')
const { TripMemberRepository } = require('../repositories/tripMember.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { calculateTSI, computeRescueReadiness } = require('./tsi.service')
const { generateSafetyAdvisory } = require('./gemini.service')
const { generatePublicToken, generateInviteCode } = require('../utils/crypto')
const { TRIP_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

const INVITE_CODE_MAX_ATTEMPTS = 5

const VALID_TRANSITIONS = {
  [TRIP_STATUSES.PLANNED]:   [TRIP_STATUSES.ACTIVE, TRIP_STATUSES.CANCELLED],
  [TRIP_STATUSES.ACTIVE]:    [TRIP_STATUSES.PAUSED, TRIP_STATUSES.COMPLETED, TRIP_STATUSES.CANCELLED],
  [TRIP_STATUSES.PAUSED]:    [TRIP_STATUSES.ACTIVE, TRIP_STATUSES.COMPLETED, TRIP_STATUSES.CANCELLED],
  [TRIP_STATUSES.COMPLETED]: [],
  [TRIP_STATUSES.CANCELLED]: [],
}

async function enrichStops(stops) {
  const destRepo = new DestinationRepository()
  const destinationIds = stops
    .map(s => s.destinationId)
    .filter(id => id && id !== 'null' && id !== 'undefined')

  const destMap = {}
  if (destinationIds.length > 0) {
    const dests = await destRepo.findByIds(destinationIds)
    dests.forEach(d => { destMap[d.id] = d })
  }

  return stops.map(stop => {
    const dest = destMap[stop.destinationId] || {}
    return {
      city:          stop.city,
      state:         stop.state,
      destinationId: stop.destinationId || null,
      // dest.latitude/longitude/nearest_hospital_km are decimal columns --
      // node-pg returns those as strings, not numbers. Number() them on
      // the fallback path or a string silently lands in the stored JSONB
      // and fails StopSchema's z.number() the next time these stops round-
      // trip through an update (stop.lat/lng themselves are already real
      // numbers when the client supplies them, e.g. via Nominatim search).
      lat:           stop.lat ?? (dest.latitude != null ? Number(dest.latitude) : null),
      lng:           stop.lng ?? (dest.longitude != null ? Number(dest.longitude) : null),
      days:          stop.days,
      arrivalDate:   stop.arrivalDate || null,
      departureDate: stop.departureDate || null,
      activities:    (stop.activities || []).map(a => ({ ...a })),
      notes:         stop.notes || null,
      connectivity:  stop.connectivity || dest.connectivity || 'MODERATE',
      difficulty:    stop.difficulty  || dest.difficulty   || 'EASY',
      altitude_m:    stop.altitude_m  ?? dest.altitude_m   ?? 0,
      zone_type:     stop.zone_type   || dest.zone_type    || 'SAFE',
      hospital_km:   stop.hospital_km ?? (dest.nearest_hospital_km != null ? Number(dest.nearest_hospital_km) : 0),
      eta_minutes:   stop.eta_minutes || null,
      status:        stop.status || 'UPCOMING',
      actualCostInr: stop.actualCostInr ?? null,
    }
  })
}

async function createTrip(touristId, data, tourist) {
  const tripRepo = new TripRepository()

  const enrichedStops = await enrichStops(data.stops || [])
  const publicToken = data.isPublic ? generatePublicToken() : null
  const tsiResult = calculateTSI({ ...data, travel_type: data.travelType, stops: enrichedStops }, {})
  const readiness = computeRescueReadiness(tourist, { tsi_score: tsiResult.score, rescue_readiness: {} }, false)

  const trip = await tripRepo.create({
    touristId,
    title:              data.title,
    description:        data.description || null,
    travelType:         data.travelType || 'SOLO',
    startDate:          data.startDate,
    endDate:            data.endDate,
    stops:              enrichedStops,
    budgetInr:          data.budgetInr || null,
    coverImageUrl:      data.coverImageUrl || null,
    isPublic:           data.isPublic || false,
    publicToken,
    tsiScore:           tsiResult.score,
    tsiLabel:           tsiResult.label,
    tsiFactors:         tsiResult.factors,
    tsiRecommendations: tsiResult.recommendations,
    rescueReadiness:    readiness.items,
    rescueReadinessScore: readiness.score,
    packingChecklist:   [],
  })

  logger.info({ tripId: trip.id, touristId, tsi: tsiResult.score }, 'Trip created')
  return trip
}

async function getMyTrips(touristId, filters) {
  return new TripRepository().findByTouristId(touristId, filters)
}

async function getTrip(tripId, touristId) {
  const repo = new TripRepository()
  let trip = await repo.findById(tripId, touristId)
  if (!trip) {
    // Not the owner — check whether they're a joined group member instead
    // of failing outright, so co-travelers can open the same trip.
    const memberRepo = new TripMemberRepository()
    if (await memberRepo.isMember(tripId, touristId)) {
      trip = await repo.findById(tripId)
    }
  }
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })
  return trip
}

// Owner-only. Returns the existing code if one was already generated —
// re-sharing shouldn't invalidate a code travel companions may already have.
async function getOrCreateInviteCode(tripId, touristId) {
  const repo = new TripRepository()
  const trip = await repo.findById(tripId, touristId)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })
  if (trip.invite_code) return trip.invite_code

  for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateInviteCode()
    try {
      const updated = await repo.setInviteCode(tripId, touristId, code)
      if (updated) return updated.invite_code
    } catch (err) {
      // Unique constraint collision on invite_code — vanishingly unlikely
      // at 6 chars from a 33-char alphabet, but retry rather than fail.
      if (err.code !== '23505') throw err
    }
  }
  throw Object.assign(new Error('Could not generate a unique invite code — try again'), { statusCode: 500 })
}

async function joinTripByCode(touristId, inviteCode) {
  const tripRepo = new TripRepository()
  const memberRepo = new TripMemberRepository()

  const trip = await tripRepo.findByInviteCode(inviteCode.toUpperCase())
  if (!trip || trip.status === TRIP_STATUSES.CANCELLED) {
    throw Object.assign(new Error(ERRORS.INVITE_CODE_INVALID), { statusCode: 404 })
  }
  if (trip.tourist_id === touristId) {
    throw Object.assign(new Error(ERRORS.CANNOT_JOIN_OWN_TRIP), { statusCode: 400 })
  }
  if (await memberRepo.isMember(trip.id, touristId)) {
    throw Object.assign(new Error(ERRORS.ALREADY_TRIP_MEMBER), { statusCode: 400 })
  }

  await memberRepo.add(trip.id, touristId)
  logger.info({ tripId: trip.id, touristId }, 'Tourist joined group trip')
  return trip
}

// Owner or member only.
async function getTripMembers(tripId, touristId) {
  const tripRepo = new TripRepository()
  const memberRepo = new TripMemberRepository()

  const trip = await tripRepo.findById(tripId, touristId)
  const isMember = trip ? true : await memberRepo.isMember(tripId, touristId)
  if (!trip && !isMember) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  const ownerTrip = trip || await tripRepo.findById(tripId)
  const members = await memberRepo.findByTripId(tripId)
  return { ownerId: ownerTrip.tourist_id, members }
}

async function leaveTrip(tripId, touristId) {
  const memberRepo = new TripMemberRepository()
  const removed = await memberRepo.remove(tripId, touristId)
  if (!removed) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })
  logger.info({ tripId, touristId }, 'Tourist left group trip')
  return removed
}

async function getPublicTrip(publicToken) {
  const trip = await new TripRepository().findByPublicToken(publicToken)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })
  return trip
}

async function updateTrip(tripId, touristId, data, tourist) {
  const tripRepo = new TripRepository()
  const existing = await tripRepo.findById(tripId, touristId)
  if (!existing) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  // PUT is validated as a partial update (UpdateTripSchema = TripFieldsSchema
  // .partial()) — the route genuinely accepts { stops: [...] } alone. But
  // trip.repository.js#update() runs one unconditional full-column UPDATE,
  // so an omitted field must fall back to its current value here or that
  // column gets overwritten with NULL, which the NOT NULL columns
  // (title/start_date/end_date) reject outright with a raw DB error.
  const merged = {
    title:         data.title ?? existing.title,
    description:   data.description ?? existing.description,
    travelType:    data.travelType ?? existing.travel_type,
    startDate:     data.startDate ?? existing.start_date,
    endDate:       data.endDate ?? existing.end_date,
    stops:         data.stops ?? existing.stops,
    budgetInr:     data.budgetInr ?? existing.budget_inr,
    coverImageUrl: data.coverImageUrl ?? existing.cover_image_url,
    isPublic:      data.isPublic ?? existing.is_public,
  }

  const enrichedStops = await enrichStops(merged.stops || [])
  const tsiResult = calculateTSI({ ...merged, travel_type: merged.travelType, stops: enrichedStops }, {})
  const readiness = computeRescueReadiness(tourist, { tsi_score: tsiResult.score, rescue_readiness: existing.rescue_readiness || {} }, false)

  return tripRepo.update(tripId, touristId, {
    ...merged, stops: enrichedStops,
    tsiScore: tsiResult.score, tsiLabel: tsiResult.label,
    tsiFactors: tsiResult.factors, tsiRecommendations: tsiResult.recommendations,
    rescueReadiness: readiness.items, rescueReadinessScore: readiness.score,
  })
}

async function updateTripStatus(tripId, touristId, newStatus) {
  const tripRepo = new TripRepository()
  const trip = await tripRepo.findById(tripId, touristId)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  const allowed = VALID_TRANSITIONS[trip.status] || []
  if (!allowed.includes(newStatus)) {
    throw Object.assign(
      new Error(`${ERRORS.INVALID_TRIP_TRANSITION}: ${trip.status} → ${newStatus}`),
      { statusCode: 400 }
    )
  }

  // Switching a trip to ACTIVE while a different trip is already ACTIVE used
  // to be a hard 400 (TRIP_ALREADY_ACTIVE) -- a tourist genuinely juggling
  // two plans (e.g. a short detour trip while a longer one is paused) had no
  // way to make room for the new one short of cancelling the old one
  // outright. Auto-pausing the previous trip instead makes "switch active
  // trip" a deliberate, reversible user action rather than a dead end --
  // findActiveByTouristId (guardian view, DMS, checkpoint scans) still only
  // ever sees at most one ACTIVE trip, so that invariant is preserved.
  if (newStatus === TRIP_STATUSES.ACTIVE) {
    const active = await tripRepo.findActiveByTouristId(touristId)
    if (active && active.id !== tripId) {
      await tripRepo.updateStatus(active.id, touristId, TRIP_STATUSES.PAUSED)
      logger.info({ tripId: active.id, touristId }, 'Trip auto-paused to activate another')
    }
  }

  return tripRepo.updateStatus(tripId, touristId, newStatus)
}

async function updateChecklist(tripId, touristId, checklist) {
  const repo = new TripRepository()
  const trip = await repo.findById(tripId, touristId)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })
  const normalized = checklist.map(i => ({ ...i, id: i.id || uuid() }))
  return repo.updateChecklist(tripId, touristId, normalized)
}

async function deleteTrip(tripId, touristId) {
  const repo = new TripRepository()
  const deleted = await repo.delete(tripId, touristId)
  if (!deleted) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })
  return deleted
}

// Generated on demand (not cached/persisted) — same reasoning as the packing
// list's own "regenerate on request" behavior. Cheap enough for a hackathon
// demo's call volume and avoids a schema change just to cache a paragraph.
async function getSafetyAdvisory(tripId, touristId) {
  const trip = await getTrip(tripId, touristId)
  if (trip.tsi_score == null) throw Object.assign(new Error('Trip has no computed Travel Safety Index yet — add at least one stop first'), { statusCode: 400 })

  const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
  return generateSafetyAdvisory({
    tsiScore:        trip.tsi_score,
    tsiLabel:        trip.tsi_label,
    factors:         trip.tsi_factors,
    travelType:      trip.travel_type,
    recommendations: trip.tsi_recommendations,
    destination:     stops[0]?.city || null,
  })
}

module.exports = {
  createTrip, getMyTrips, getTrip, getPublicTrip, updateTrip, updateTripStatus, updateChecklist, deleteTrip,
  getOrCreateInviteCode, joinTripByCode, getTripMembers, leaveTrip, getSafetyAdvisory,
}
