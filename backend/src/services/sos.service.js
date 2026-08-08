// src/services/sos.service.js
// THE MOST CRITICAL SERVICE — no mistakes allowed.
'use strict'

const { withTransaction } = require('../database/transaction')
const { SOSRepository } = require('../repositories/sos.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { notifyOnSOS } = require('./notification/notification.service')
const { emitSOSReceived, emitSOSResolved } = require('../socket/emitters')
const { SOS_TRIGGER_TYPES, SOS_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const { estimateRescueEtaMinutes } = require('../utils/geo')
const logger = require('../utils/logger')

async function createSOS(touristId, data) {
  // 1. Run DB writes in a transaction
  const { sosEvent, tourist } = await withTransaction(async (client) => {
    const sosRepo      = new SOSRepository(client)
    const locationRepo = new LocationRepository(client)
    const touristRepo  = new TouristRepository(client)

    const sosEvent = await sosRepo.create({
      touristId,
      tripId:            data.tripId || null,
      latitude:          data.latitude,
      longitude:         data.longitude,
      locationAccuracyM: data.locationAccuracyM || null,
      isStaleLocation:   data.isStaleLocation || false,
      category:          data.category,
      message:           data.message || null,
      triggerType:       SOS_TRIGGER_TYPES.MANUAL,
      batteryPct:        data.batteryPct || null,
    })

    // Always update last known location on SOS
    await locationRepo.upsert(touristId, {
      latitude:   data.latitude,
      longitude:  data.longitude,
      batteryPct: data.batteryPct || null,
      accuracyM:  data.locationAccuracyM || null,
    })

    const tourist = await touristRepo.findById(touristId)
    return { sosEvent, tourist }
  })

  // 2. Side effects AFTER transaction — failures here do not rollback SOS
  emitSOSReceived(sosEvent, tourist)

  // Fire and forget — never await, never throw to caller
  notifyOnSOS(tourist, sosEvent)
    .then(notified => {
      const sosRepo = new SOSRepository()
      return sosRepo.updateContactsNotified(sosEvent.id, notified)
    })
    .catch(err => logger.error({ err: { message: err.message }, sosId: sosEvent.id }, 'Post-SOS notification failed'))

  logger.warn({ sosId: sosEvent.id, touristId, category: data.category }, 'SOS created')
  return sosEvent
}

async function getSOSHistory(touristId, filters) {
  const repo = new SOSRepository()
  return repo.findByTouristId(touristId, filters)
}

// Powers the tourist-facing "rescue is on the way" view. ETA is a rough
// estimate from the team's registered base location, not live GPS — no
// rescue-team-side app/login exists to report a real live position, so this
// is the honest, buildable version: distance-and-speed math, not a
// simulated live tracker.
async function getActiveRescueInfo(touristId) {
  const repo = new SOSRepository()
  const row = await repo.findActiveWithRescueInfo(touristId)
  if (!row) return null

  const hasTeam = !!row.team_id
  const eta = hasTeam
    ? estimateRescueEtaMinutes(row.team_lat, row.team_lng, row.latitude, row.longitude)
    : null

  return {
    sosId:      row.id,
    category:   row.category,
    status:     row.status,
    createdAt:  row.created_at,
    latitude:   row.latitude,
    longitude:  row.longitude,
    team: hasTeam ? {
      id:          row.team_id,
      name:        row.team_name,
      type:        row.team_type,
      phone:       row.team_phone,
      latitude:    row.team_lat,
      longitude:   row.team_lng,
      status:      row.assignment_status,
      assignedAt:  row.assigned_at,
      distanceKm:  eta?.distanceKm ?? null,
      etaMinutes:  eta?.etaMinutes ?? null,
    } : null,
  }
}

async function markFalseAlarm(sosId, touristId) {
  const repo = new SOSRepository()
  const sos = await repo.findById(sosId)

  if (!sos) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  if (sos.tourist_id !== touristId) throw Object.assign(new Error(ERRORS.FORBIDDEN), { statusCode: 403 })
  if ([SOS_STATUSES.RESOLVED, SOS_STATUSES.FALSE_ALARM].includes(sos.status)) {
    throw Object.assign(new Error(ERRORS.SOS_ALREADY_CLOSED), { statusCode: 400 })
  }

  const updated = await repo.updateStatus(sosId, SOS_STATUSES.FALSE_ALARM)
  // The findById check above is TOCTOU-racy against a concurrent resolve/
  // false-alarm; the DB-level guard in updateStatus is the real source of
  // truth, so re-check its result rather than trusting the pre-check alone.
  if (!updated) throw Object.assign(new Error(ERRORS.SOS_ALREADY_CLOSED), { statusCode: 400 })
  emitSOSResolved(updated, 'Tourist confirmed false alarm')
  logger.info({ sosId, touristId }, 'SOS marked false alarm')
  return updated
}

module.exports = { createSOS, getSOSHistory, markFalseAlarm, getActiveRescueInfo }
