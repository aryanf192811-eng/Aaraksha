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

async function markFalseAlarm(sosId, touristId) {
  const repo = new SOSRepository()
  const sos = await repo.findById(sosId)

  if (!sos) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  if (sos.tourist_id !== touristId) throw Object.assign(new Error(ERRORS.FORBIDDEN), { statusCode: 403 })
  if ([SOS_STATUSES.RESOLVED, SOS_STATUSES.FALSE_ALARM].includes(sos.status)) {
    throw Object.assign(new Error(ERRORS.SOS_ALREADY_CLOSED), { statusCode: 400 })
  }

  const updated = await repo.updateStatus(sosId, SOS_STATUSES.FALSE_ALARM)
  emitSOSResolved(sosId, 'Tourist confirmed false alarm')
  logger.info({ sosId, touristId }, 'SOS marked false alarm')
  return updated
}

module.exports = { createSOS, getSOSHistory, markFalseAlarm }
