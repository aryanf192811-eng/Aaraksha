// src/services/dms.service.js
'use strict'

const { withTransaction } = require('../database/transaction')
const { DMSRepository } = require('../repositories/dms.repository')
const { CheckinRepository } = require('../repositories/checkin.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { SOSRepository } = require('../repositories/sos.repository')
const { emitDMSTriggered, emitCheckinUpdate, emitGuardianSOSAlert } = require('../socket/emitters')
const { notifyOnSOS, notifyDMSWarning } = require('./notification/notification.service')
const { DMS_STATUSES, SOS_CATEGORIES, SOS_TRIGGER_TYPES, CHECKIN_TYPES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

async function createDMS(touristId, data) {
  const repo = new DMSRepository()
  const existing = await repo.findActiveByTouristId(touristId)
  if (existing) throw Object.assign(new Error(ERRORS.DMS_ALREADY_ACTIVE), { statusCode: 400 })
  const dms = await repo.create({
    touristId,
    tripId: data.tripId || null,
    // demoSeconds present => interval_minutes stores the sentinel 0 (see
    // migration 008); intervalMinutes present => interval_seconds stays null.
    intervalMinutes: data.demoSeconds != null ? 0 : data.intervalMinutes,
    intervalSeconds: data.demoSeconds ?? null,
  })
  logger.info({ dmsId: dms.id, touristId, intervalMinutes: data.intervalMinutes, demoSeconds: data.demoSeconds }, 'DMS created')
  return dms
}

async function getActiveDMS(touristId) {
  return new DMSRepository().findActiveByTouristId(touristId)
}

async function resetDMS(dmsId, touristId, data) {
  const dmsRepo = new DMSRepository()
  const dms = await dmsRepo.findById(dmsId, touristId)
  if (!dms) throw Object.assign(new Error(ERRORS.DMS_NOT_FOUND), { statusCode: 404 })

  const { dmsUpdated, checkin, tourist } = await withTransaction(async (client) => {
    const dmsRepo_t    = new DMSRepository(client)
    const checkinRepo  = new CheckinRepository(client)
    const locationRepo = new LocationRepository(client)
    const touristRepo  = new TouristRepository(client)

    const dmsUpdated = await dmsRepo_t.reset(dmsId, dms.interval_minutes, dms.interval_seconds)

    const checkin = await checkinRepo.create({
      touristId,
      tripId:    dms.trip_id,
      dmsId,
      latitude:   data.latitude  || null,
      longitude:  data.longitude || null,
      batteryPct: data.batteryPct || null,
      message:    data.message || null,
      type:       CHECKIN_TYPES.DMS_RESET,
    })

    if (data.latitude && data.longitude) {
      await locationRepo.upsert(touristId, {
        latitude: data.latitude, longitude: data.longitude, batteryPct: data.batteryPct
      })
    }

    const tourist = await touristRepo.findById(touristId)
    return { dmsUpdated, checkin, tourist }
  })

  emitCheckinUpdate(touristId, tourist?.guardian_token,
    { latitude: data.latitude, longitude: data.longitude }, data.batteryPct, null)

  logger.info({ dmsId, touristId }, 'DMS reset')
  return { dms: dmsUpdated, checkin }
}

async function updateDMSStatus(dmsId, touristId, status) {
  const repo = new DMSRepository()
  const updated = await repo.updateStatus(dmsId, touristId, status)
  if (!updated) throw Object.assign(new Error(ERRORS.DMS_NOT_FOUND), { statusCode: 404 })
  return updated
}

// Called by DMS cron — not an HTTP handler
async function processDMSTriggers() {
  const dmsRepo = new DMSRepository()
  const triggered = await dmsRepo.findTriggered()

  for (const dmsRow of triggered) {
    try {
      const { sosEvent } = await withTransaction(async (client) => {
        const dmsRepo_t = new DMSRepository(client)
        const sosRepo_t = new SOSRepository(client)

        const lat = dmsRow.latitude || 0
        const lng = dmsRow.longitude || 0
        const isStale = !dmsRow.latitude

        const sosEvent = await sosRepo_t.create({
          touristId:       dmsRow.tourist_id,
          tripId:          dmsRow.trip_id,
          latitude:        lat,
          longitude:       lng,
          isStaleLocation: isStale,
          category:        SOS_CATEGORIES.MISSING,
          triggerType:     SOS_TRIGGER_TYPES.DEAD_MANS_SWITCH,
          batteryPct:      dmsRow.battery_pct || null,
          message:         "Automatic SOS — Dead Man's Switch timeout",
        })

        await dmsRepo_t.markTriggered(dmsRow.id, sosEvent.id)
        return { sosEvent }
      })

      const tourist = {
        id: dmsRow.tourist_id,
        full_name: dmsRow.full_name,
        phone: dmsRow.phone,
        blood_group: dmsRow.blood_group,
        emergency_contacts: dmsRow.emergency_contacts,
        guardian_token: dmsRow.guardian_token,
        govt_id_suffix: dmsRow.govt_id_suffix,
      }
      emitDMSTriggered(sosEvent, tourist)
      emitGuardianSOSAlert(tourist.guardian_token, sosEvent, tourist)
      notifyOnSOS(tourist, sosEvent).catch(err =>
        logger.error({ err: { message: err.message } }, 'DMS SOS notification failed'))

      logger.warn({ dmsId: dmsRow.id, sosId: sosEvent.id, touristName: dmsRow.full_name }, 'DMS triggered — SOS created')
    } catch (err) {
      logger.error({ err: { message: err.message }, dmsId: dmsRow.id }, 'Failed to process DMS trigger')
    }
  }

  return { processed: triggered.length }
}

async function processDMSWarnings() {
  const dmsRepo = new DMSRepository()
  const needWarn = await dmsRepo.findNeedingWarning()

  for (const dmsRow of needWarn) {
    try {
      await notifyDMSWarning({ phone: dmsRow.phone, id: dmsRow.tourist_id }, dmsRow)
      await dmsRepo.markWarned(dmsRow.id)
      logger.info({ dmsId: dmsRow.id, touristName: dmsRow.full_name }, 'DMS warning sent')
    } catch (err) {
      logger.error({ err: { message: err.message }, dmsId: dmsRow.id }, 'DMS warning failed')
    }
  }

  return { processed: needWarn.length }
}

module.exports = { createDMS, getActiveDMS, resetDMS, updateDMSStatus, processDMSTriggers, processDMSWarnings }
