// src/services/govt.service.js
'use strict'

const { withTransaction } = require('../database/transaction')
const { SOSRepository } = require('../repositories/sos.repository')
const { RescueRepository } = require('../repositories/rescue.repository')
const { DMSRepository } = require('../repositories/dms.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { TripRepository } = require('../repositories/trip.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { VolunteerRepository } = require('../repositories/volunteer.repository')
const { LocalOperatorRepository } = require('../repositories/localOperator.repository')
const { VolunteerDispatchRepository } = require('../repositories/volunteerDispatch.repository')
const { emitSOSResolved, emitRescueAssigned, emitGuardianRescueAssigned, emitVolunteerAssigned } = require('../socket/emitters')
const { SOS_STATUSES, TEAM_STATUSES, VOLUNTEER_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const { hashPassword, hashGovtId, generateTempPassword, normalizePhone, extractSuffix } = require('../utils/crypto')
const { estimateRescueEtaMinutes } = require('../utils/geo')
const riskModelService = require('./riskModel.service')
const { applyTrustEvent } = require('./trustScore.service')
const logger = require('../utils/logger')

async function getDashboard() {
  const [sosRepo, rescueRepo, dmsRepo, locationRepo, tripRepo] = [
    new SOSRepository(), new RescueRepository(), new DMSRepository(), new LocationRepository(), new TripRepository()
  ]

  const [activeSOS, assignedSOS, resolvedToday, activeTourists,
         availableTeams, deployedTeams, activeDMS, recentSOS, safetyIndex] = await Promise.all([
    sosRepo.countByPeriod(new Date(0)).then(r => parseInt(r[0]?.active || 0)),
    sosRepo.countAssigned(),
    sosRepo.countResolvedToday(),
    locationRepo.countActive(),
    rescueRepo.countAvailable(),
    rescueRepo.countDeployed(),
    dmsRepo.countActive(),
    sosRepo.findRecent(5),
    tripRepo.getAverageActiveTSI(),
  ])

  return {
    activeSOS, assignedSOS, resolvedToday, activeTourists, availableTeams, deployedTeams, activeDMS, recentSOS,
    safetyIndex: safetyIndex.avgTsi, safetyIndexTripCount: safetyIndex.tripCount,
  }
}

// Same "rescuer's live GPS if reported, else registered base" fallback as
// sos.service.js#getActiveRescueInfo — kept as a second small computation
// rather than importing that function, since it operates on the govt list
// row shape (team_base_lat/lng already COALESCEd across team/volunteer),
// not the tourist-facing single-row shape.
async function getActiveSOS(filters) {
  const { rows, total } = await new SOSRepository().findActive(filters)
  const withEta = rows.map((sos) => {
    if (!sos.assignment_id) return sos
    const rescuerLat = sos.rescuer_latitude ?? sos.team_base_lat
    const rescuerLng = sos.rescuer_longitude ?? sos.team_base_lng
    const eta = estimateRescueEtaMinutes(rescuerLat, rescuerLng, sos.latitude, sos.longitude)
    return {
      ...sos,
      rescuer_is_live: sos.rescuer_latitude != null,
      rescuer_distance_km: eta?.distanceKm ?? null,
      rescuer_eta_minutes: eta?.etaMinutes ?? null,
    }
  })
  return { rows: withEta, total }
}

// Assigns either an official rescue team OR a volunteer to an SOS —
// exactly one of teamId/volunteerId is provided (validated by
// AssignRescueSchema's .refine() in govt.routes.js). Both paths share one
// transaction shape and one set of emitters (see normalizeRescuer in
// emitters.js), so a volunteer assignment is a first-class citizen here,
// not a bolted-on special case.
async function assignRescue(sosId, govtUserId, { teamId, volunteerId }, notes) {
  const sosRepo       = new SOSRepository()
  const rescueRepo    = new RescueRepository()
  const volunteerRepo = new VolunteerRepository()
  const rescuerKind   = volunteerId ? 'VOLUNTEER' : 'TEAM'

  const sos  = await sosRepo.findById(sosId)
  if (!sos)  throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  if (![SOS_STATUSES.ACTIVE, SOS_STATUSES.ASSIGNED].includes(sos.status)) {
    throw Object.assign(new Error('SOS is not open for assignment'), { statusCode: 400 })
  }

  let rescuer
  if (rescuerKind === 'VOLUNTEER') {
    rescuer = await volunteerRepo.findById(volunteerId)
    if (!rescuer) throw Object.assign(new Error(ERRORS.VOLUNTEER_NOT_FOUND), { statusCode: 404 })
    if (!rescuer.is_verified) throw Object.assign(new Error(ERRORS.VOLUNTEER_NOT_VERIFIED), { statusCode: 400 })
    if (rescuer.status !== VOLUNTEER_STATUSES.AVAILABLE) {
      throw Object.assign(new Error(ERRORS.VOLUNTEER_NOT_AVAILABLE), { statusCode: 400 })
    }
  } else {
    rescuer = await rescueRepo.findTeamById(teamId)
    if (!rescuer) throw Object.assign(new Error(ERRORS.TEAM_NOT_FOUND), { statusCode: 404 })
    if (rescuer.status !== TEAM_STATUSES.AVAILABLE) {
      throw Object.assign(new Error(ERRORS.TEAM_NOT_AVAILABLE), { statusCode: 400 })
    }
  }

  const { assignment } = await withTransaction(async (client) => {
    const sosRepo_t       = new SOSRepository(client)
    const rescueRepo_t    = new RescueRepository(client)
    const volunteerRepo_t = new VolunteerRepository(client)

    const assignment = await rescueRepo_t.createAssignment({
      sosEventId: sosId, teamId: rescuerKind === 'TEAM' ? teamId : null,
      volunteerId: rescuerKind === 'VOLUNTEER' ? volunteerId : null,
      assignedBy: govtUserId, notes,
    })
    await sosRepo_t.updateStatus(sosId, SOS_STATUSES.ASSIGNED)
    if (rescuerKind === 'TEAM') {
      await rescueRepo_t.updateTeamStatus(teamId, TEAM_STATUSES.DEPLOYED)
    } else {
      await volunteerRepo_t.updateStatus(volunteerId, VOLUNTEER_STATUSES.DEPLOYED)
    }
    return { assignment }
  })

  emitRescueAssigned(assignment, sos, rescuer, rescuerKind)
  if (sos.tourist_id) {
    // Best-effort: a lookup failure here must never undo an already-
    // committed rescue dispatch. One lookup feeds both the volunteer's own
    // "you've been assigned" push (wants the tourist's first name) and the
    // guardian's live ETA update.
    new TouristRepository().findById(sos.tourist_id)
      .then(tourist => {
        if (rescuerKind === 'VOLUNTEER') emitVolunteerAssigned(volunteerId, assignment, sos, tourist)
        if (tourist?.guardian_token) emitGuardianRescueAssigned(tourist.guardian_token, sos, rescuer, rescuerKind)
      })
      .catch(err => logger.error({ err: { message: err.message }, sosId }, 'Post-assignment push failed'))
  } else if (rescuerKind === 'VOLUNTEER') {
    emitVolunteerAssigned(volunteerId, assignment, sos, null)
  }
  logger.info({ sosId, rescuerKind, rescuerId: rescuer.id, assignmentId: assignment.id }, 'Rescue assigned')
  return { assignment, sosStatus: SOS_STATUSES.ASSIGNED, rescuerKind }
}

// Powers the govt "who's near this SOS" panel before assigning — teams and
// volunteers in one distance-sorted list.
async function getNearbyRescuers(sosId) {
  const sos = await new SOSRepository().findById(sosId)
  if (!sos) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  return new RescueRepository().findNearbyAvailableRescuers(sos.latitude, sos.longitude, sos.category)
}

// Powers the govt Live Map's rescuer markers — every rescuer (team or
// volunteer) currently working an SOS, with the position to plot and the
// SOS location to route to. The frontend re-polls this on the same
// RESCUER_LOCATION_UPDATE/RESCUER_STATUS_UPDATE events that already move
// the marker on the tourist/Guardian/Rescuer-app maps, so all four views
// end up moving off the same GPS ticks.
async function getActiveRescuers() {
  return new RescueRepository().findActiveAssignmentsWithPositions()
}

async function resolveSOS(sosId, resolutionNotes, govtUserId, overrideReason) {
  // Gated on a verified rescue handoff (see handoff.service.js) unless an
  // operator explicitly provides an override reason -- checked before the
  // transaction even opens, so an unverified attempt with no reason never
  // touches the DB at all.
  const preCheck = await new SOSRepository().findById(sosId)
  if (!preCheck) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  if (!preCheck.handoff_verified_at && !overrideReason) {
    throw Object.assign(new Error(ERRORS.HANDOFF_NOT_VERIFIED), { statusCode: 400 })
  }

  const { resolved } = await withTransaction(async (client) => {
    const sosRepo_t    = new SOSRepository(client)
    const rescueRepo_t = new RescueRepository(client)

    if (overrideReason) {
      await sosRepo_t.recordHandoffOverride(sosId, govtUserId, overrideReason)
      logger.warn({ sosId, govtUserId, overrideReason }, 'SOS resolved without handoff verification (override)')
    }

    const resolved = await sosRepo_t.updateStatus(sosId, SOS_STATUSES.RESOLVED, { resolutionNotes })
    if (!resolved) {
      // updateStatus returns null both when the SOS doesn't exist and when a
      // concurrent request already closed it (DB-level guard) — disambiguate
      // so two people resolving the same SOS get distinct, correct errors.
      const existing = await sosRepo_t.findById(sosId)
      if (!existing) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
      throw Object.assign(new Error(ERRORS.SOS_ALREADY_CLOSED), { statusCode: 400 })
    }

    const assignment = await rescueRepo_t.resolveAssignment(sosId)
    if (assignment?.team_id) {
      await rescueRepo_t.updateTeamStatus(assignment.team_id, TEAM_STATUSES.AVAILABLE)
    } else if (assignment?.volunteer_id) {
      const volunteerRepo_t = new VolunteerRepository(client)
      await volunteerRepo_t.updateStatus(assignment.volunteer_id, VOLUNTEER_STATUSES.AVAILABLE)
    }
    await new VolunteerDispatchRepository(client).declineAllPendingForSOS(sosId)
    return { resolved }
  })

  emitSOSResolved(resolved, resolutionNotes)
  logger.info({ sosId }, 'SOS resolved')
  return resolved
}

// Deliberately hard-to-reach, always requires a written reason, always a
// human govt decision -- same "audited, never a casual tap-away option"
// posture as the handoff override above. Independent of the SOS's own
// status: govt may only realize this was fraudulent well after the case
// closed, and the trust consequence should still land.
async function confirmFraudulentSOS(sosId, govtUserId, reason) {
  const sos = await new SOSRepository().findById(sosId)
  if (!sos) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })

  const updated = await applyTrustEvent(sos.tourist_id, 'CONFIRMED_FRAUDULENT_SOS', {
    relatedSosId: sosId, govtUserId, note: reason,
  })
  logger.warn({ sosId, touristId: sos.tourist_id, govtUserId }, 'SOS confirmed fraudulent — trust score deducted')
  return updated
}

async function getLiveTourists() {
  return new LocationRepository().findLive()
}

async function getRiskOverview() {
  // Get all active trips, group by destination city
  const tripRepo    = new TripRepository()
  const destRepo    = new DestinationRepository()
  const activeTrips = await tripRepo.findAllActive()

  const destStats = {}
  for (const trip of activeTrips) {
    const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
    for (const stop of stops) {
      const key = stop.destinationId || stop.city
      if (!destStats[key]) {
        destStats[key] = {
          destinationId: stop.destinationId || null,
          city:        stop.city,
          state:       stop.state,
          zoneType:    stop.zone_type,
          connectivity:stop.connectivity,
          total:       0,
          solo:        0,
          highRisk:    0,
        }
      }
      destStats[key].total++
      if (trip.travel_type === 'SOLO') destStats[key].solo++
      if ((trip.tsi_score || 100) < 60)  destStats[key].highRisk++
    }
  }

  // Bug fix: this used to key the lookup map by destination id but never
  // stored that id on the stat object itself, so the later lookup always
  // missed and weather (and every other destination detail) silently never
  // attached to any risk zone. Keyed by both id and city name now, since
  // manually-typed trip stops don't always carry a destinationId.
  const destinations = await destRepo.findAll()
  const byId = {}
  const byCity = {}
  destinations.forEach(d => {
    byId[d.id] = d
    byCity[d.name.toUpperCase()] = d
  })

  return Object.values(destStats).map(stat => {
    const dest = (stat.destinationId && byId[stat.destinationId]) || byCity[stat.city.toUpperCase()] || null
    return {
      ...stat,
      weather: dest?.weather_condition ? {
        weather_condition: dest.weather_condition,
        weather_risk:      dest.weather_risk,
        temp_celsius:      dest.temp_celsius,
      } : null,
      altitudeM:          dest?.altitude_m ?? null,
      difficulty:         dest?.difficulty ?? null,
      nearestHospitalName:dest?.nearest_hospital_name ?? null,
      nearestHospitalKm:  dest?.nearest_hospital_km ?? null,
      govtAdvisory:       dest?.govt_advisory ?? null,
      description:        dest?.description ?? null,
      ilpRequired:        dest?.ilp_required ?? false,
      // Coordinates aren't shown in the RiskOverviewPage card grid this
      // already powers, but the Live Map's risk-density layer needs them to
      // plot each destination as a weighted circle rather than a card.
      latitude:           dest?.latitude != null ? Number(dest.latitude) : null,
      longitude:          dest?.longitude != null ? Number(dest.longitude) : null,
      // A second, genuinely distinct signal from zoneType/TSI above — see
      // riskModel.service.js's header comment for why these are kept
      // separate rather than blended into one number.
      predictedRisk:      dest ? riskModelService.predictForDestination(dest) : null,
    }
  })
}

function getRiskModelInfo() {
  return riskModelService.getModelInfo()
}

async function getRescueTeams() {
  return new RescueRepository().findAllTeams()
}

async function updateTeamStatus(teamId, status) {
  return new RescueRepository().updateTeamStatus(teamId, status)
}

async function getAnalytics(period = '30d') {
  const days    = parseInt(period) || 30
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const sosRepo   = new SOSRepository()
  const rescueRepo = new RescueRepository()

  const [perDay, byCategory, totals, avgResponse] = await Promise.all([
    sosRepo.trendsPerDay(startDate),
    sosRepo.countByCategory(startDate),
    sosRepo.countByPeriod(startDate),
    rescueRepo.avgResponseMinutes(startDate),
  ])

  return { perDay, byCategory, totals: totals[0], avgResponseMinutes: avgResponse }
}

async function getPendingVolunteers() {
  return new VolunteerRepository().findPendingVerification()
}

async function getAllVolunteers() {
  return new VolunteerRepository().findAll()
}

// Govt-initiated onboarding — an operator provisions a volunteer directly
// (walk-in local responder, a district's own outreach list) rather than
// waiting for a self-registration to review. Pre-verified since the
// operator's own action IS the identity check; a one-time password is
// generated and returned so it can be handed to the volunteer to log into
// the Rescuer app with (same login endpoint self-registered volunteers
// use — this is only a different provisioning path, not a different
// account type).
async function createVolunteer(data) {
  const repo = new VolunteerRepository()

  const phone = normalizePhone(data.phone)
  const existingPhone = await repo.findByPhone(phone)
  if (existingPhone) throw Object.assign(new Error(ERRORS.VOLUNTEER_PHONE_TAKEN), { statusCode: 409 })

  const govtIdHash = hashGovtId(data.govtIdNumber)
  const govtIdTaken = await repo.govtIdHashExists(govtIdHash)
  if (govtIdTaken) throw Object.assign(new Error(ERRORS.VOLUNTEER_GOVTID_TAKEN), { statusCode: 409 })

  const tempPassword = generateTempPassword()
  const passwordHash = await hashPassword(tempPassword)

  const volunteer = await repo.create({
    fullName: data.fullName, phone, passwordHash,
    govtIdType: data.govtIdType, govtIdHash, govtIdSuffix: extractSuffix(data.govtIdNumber),
    district: data.district, state: data.state,
    latitude: data.latitude ?? null, longitude: data.longitude ?? null,
    rescuerType: data.teamId ? 'OFFICIAL' : 'VOLUNTEER', teamId: data.teamId ?? null,
  }, true)

  logger.info({ volunteerId: volunteer.id }, 'Volunteer provisioned by govt operator')
  return { volunteer, temporaryPassword: tempPassword }
}

async function verifyVolunteer(volunteerId) {
  const volunteer = await new VolunteerRepository().verify(volunteerId)
  if (!volunteer) throw Object.assign(new Error(ERRORS.VOLUNTEER_NOT_FOUND), { statusCode: 404 })
  logger.info({ volunteerId }, 'Volunteer verified')
  return volunteer
}

async function rejectVolunteer(volunteerId) {
  const volunteer = await new VolunteerRepository().reject(volunteerId)
  if (!volunteer) throw Object.assign(new Error(ERRORS.VOLUNTEER_NOT_FOUND), { statusCode: 404 })
  logger.info({ volunteerId }, 'Volunteer application rejected')
  return volunteer
}

async function getPendingLocalOperators() {
  return new LocalOperatorRepository().findPendingVerification()
}

async function getAllLocalOperators() {
  return new LocalOperatorRepository().findAll()
}

async function verifyLocalOperator(operatorId, govtUserId) {
  const operator = await new LocalOperatorRepository().verify(operatorId, govtUserId)
  if (!operator) throw Object.assign(new Error(ERRORS.LOCAL_OPERATOR_NOT_FOUND), { statusCode: 404 })
  logger.info({ operatorId, govtUserId }, 'Local tourism provider verified')
  return operator
}

async function rejectLocalOperator(operatorId) {
  const operator = await new LocalOperatorRepository().reject(operatorId)
  if (!operator) throw Object.assign(new Error(ERRORS.LOCAL_OPERATOR_NOT_FOUND), { statusCode: 404 })
  logger.info({ operatorId }, 'Local tourism provider rejected')
  return operator
}

module.exports = {
  getDashboard, getActiveSOS, assignRescue, resolveSOS, getNearbyRescuers, getActiveRescuers,
  getLiveTourists, getRiskOverview, getRiskModelInfo, getRescueTeams, updateTeamStatus, getAnalytics,
  getPendingVolunteers, getAllVolunteers, createVolunteer, verifyVolunteer, rejectVolunteer,
  getPendingLocalOperators, getAllLocalOperators, verifyLocalOperator, rejectLocalOperator,
  confirmFraudulentSOS,
}
