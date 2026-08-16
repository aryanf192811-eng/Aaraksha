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
const { emitSOSResolved, emitRescueAssigned, emitGuardianRescueAssigned, emitVolunteerAssigned } = require('../socket/emitters')
const { SOS_STATUSES, TEAM_STATUSES, VOLUNTEER_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
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

async function getActiveSOS(filters) {
  return new SOSRepository().findActive(filters)
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
  return new RescueRepository().findNearbyAvailableRescuers(sos.latitude, sos.longitude)
}

async function resolveSOS(sosId, resolutionNotes) {
  const { resolved } = await withTransaction(async (client) => {
    const sosRepo_t    = new SOSRepository(client)
    const rescueRepo_t = new RescueRepository(client)

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
    return { resolved }
  })

  emitSOSResolved(resolved, resolutionNotes)
  logger.info({ sosId }, 'SOS resolved')
  return resolved
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
    }
  })
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

async function verifyVolunteer(volunteerId) {
  const volunteer = await new VolunteerRepository().verify(volunteerId)
  if (!volunteer) throw Object.assign(new Error(ERRORS.VOLUNTEER_NOT_FOUND), { statusCode: 404 })
  logger.info({ volunteerId }, 'Volunteer verified')
  return volunteer
}

module.exports = {
  getDashboard, getActiveSOS, assignRescue, resolveSOS, getNearbyRescuers,
  getLiveTourists, getRiskOverview, getRescueTeams, updateTeamStatus, getAnalytics,
  getPendingVolunteers, verifyVolunteer,
}
