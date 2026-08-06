// src/services/govt.service.js
'use strict'

const { withTransaction } = require('../database/transaction')
const { SOSRepository } = require('../repositories/sos.repository')
const { RescueRepository } = require('../repositories/rescue.repository')
const { DMSRepository } = require('../repositories/dms.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { TripRepository } = require('../repositories/trip.repository')
const { emitSOSResolved, emitRescueAssigned } = require('../socket/emitters')
const { SOS_STATUSES, TEAM_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

async function getDashboard() {
  const [sosRepo, rescueRepo, dmsRepo, locationRepo] = [
    new SOSRepository(), new RescueRepository(), new DMSRepository(), new LocationRepository()
  ]

  const [activeSOS, assignedSOS, resolvedToday, activeTourists,
         availableTeams, deployedTeams, activeDMS, recentSOS] = await Promise.all([
    sosRepo.countByPeriod(new Date(0)).then(r => parseInt(r[0]?.active || 0)),
    sosRepo.query(`SELECT COUNT(*)::int as c FROM sos_events WHERE status='ASSIGNED'`).then(r => r[0]?.c || 0),
    sosRepo.query(`SELECT COUNT(*)::int as c FROM sos_events WHERE status='RESOLVED' AND resolved_at::date=CURRENT_DATE`).then(r => r[0]?.c || 0),
    locationRepo.countActive(),
    rescueRepo.countAvailable(),
    rescueRepo.countDeployed(),
    dmsRepo.countActive(),
    sosRepo.query(`
      SELECT se.id, se.category, se.status, se.created_at, t.full_name, t.phone
      FROM sos_events se LEFT JOIN tourists t ON t.id=se.tourist_id
      ORDER BY se.created_at DESC LIMIT 5`),
  ])

  return { activeSOS, assignedSOS, resolvedToday, activeTourists, availableTeams, deployedTeams, activeDMS, recentSOS }
}

async function getActiveSOS(filters) {
  return new SOSRepository().findActive(filters)
}

async function assignRescue(sosId, govtUserId, teamId, notes) {
  const sosRepo    = new SOSRepository()
  const rescueRepo = new RescueRepository()

  const sos  = await sosRepo.findById(sosId)
  if (!sos)  throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  if (![SOS_STATUSES.ACTIVE, SOS_STATUSES.ASSIGNED].includes(sos.status)) {
    throw Object.assign(new Error('SOS is not open for assignment'), { statusCode: 400 })
  }

  const team = await rescueRepo.findTeamById(teamId)
  if (!team) throw Object.assign(new Error(ERRORS.TEAM_NOT_FOUND), { statusCode: 404 })
  if (team.status !== TEAM_STATUSES.AVAILABLE) {
    throw Object.assign(new Error(ERRORS.TEAM_NOT_AVAILABLE), { statusCode: 400 })
  }

  const { assignment } = await withTransaction(async (client) => {
    const sosRepo_t    = new SOSRepository(client)
    const rescueRepo_t = new RescueRepository(client)

    const assignment = await rescueRepo_t.createAssignment({
      sosEventId: sosId, teamId, assignedBy: govtUserId, notes
    })
    await sosRepo_t.updateStatus(sosId, SOS_STATUSES.ASSIGNED)
    await rescueRepo_t.updateTeamStatus(teamId, TEAM_STATUSES.DEPLOYED)
    return { assignment }
  })

  emitRescueAssigned(assignment, sos, team)
  logger.info({ sosId, teamId, assignmentId: assignment.id }, 'Rescue assigned')
  return { assignment, sosStatus: SOS_STATUSES.ASSIGNED, teamStatus: TEAM_STATUSES.DEPLOYED }
}

async function resolveSOS(sosId, resolutionNotes) {
  const { resolved } = await withTransaction(async (client) => {
    const sosRepo_t    = new SOSRepository(client)
    const rescueRepo_t = new RescueRepository(client)

    const resolved = await sosRepo_t.updateStatus(sosId, SOS_STATUSES.RESOLVED, { resolutionNotes })
    if (!resolved) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })

    const assignment = await rescueRepo_t.resolveAssignment(sosId)
    if (assignment?.team_id) {
      await rescueRepo_t.updateTeamStatus(assignment.team_id, TEAM_STATUSES.AVAILABLE)
    }
    return { resolved }
  })

  emitSOSResolved(sosId, resolutionNotes)
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

  const destinations = await destRepo.findAll()
  const weatherMap = {}
  destinations.forEach(d => {
    if (d.weather_condition) weatherMap[d.id] = d
  })

  return Object.values(destStats).map(stat => ({
    ...stat,
    weather: weatherMap[stat.destinationId] || null,
  }))
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

module.exports = {
  getDashboard, getActiveSOS, assignRescue, resolveSOS,
  getLiveTourists, getRiskOverview, getRescueTeams, updateTeamStatus, getAnalytics,
}
