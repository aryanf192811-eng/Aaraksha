// src/services/checkin.service.js
'use strict'

const { withTransaction } = require('../database/transaction')
const { CheckinRepository } = require('../repositories/checkin.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { DMSRepository } = require('../repositories/dms.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { emitCheckinUpdate } = require('../socket/emitters')
const { CHECKIN_TYPES } = require('../constants/enums')
const logger = require('../utils/logger')

async function createCheckin(touristId, data) {
  const { checkin, dmsReset, tourist } = await withTransaction(async (client) => {
    const checkinRepo  = new CheckinRepository(client)
    const locationRepo = new LocationRepository(client)
    const dmsRepo      = new DMSRepository(client)
    const touristRepo  = new TouristRepository(client)

    const checkin = await checkinRepo.create({
      touristId,
      tripId:    data.tripId    || null,
      dmsId:     data.dmsId    || null,
      latitude:  data.latitude,
      longitude: data.longitude,
      batteryPct:data.batteryPct || null,
      message:   data.message   || null,
      type:      data.dmsId ? CHECKIN_TYPES.DMS_RESET : CHECKIN_TYPES.MANUAL,
    })

    await locationRepo.upsert(touristId, {
      latitude:   data.latitude,
      longitude:  data.longitude,
      batteryPct: data.batteryPct || null,
      accuracyM:  data.accuracyM  || null,
    })

    let dmsReset = false
    if (data.dmsId) {
      const dms = await dmsRepo.findById(data.dmsId, touristId)
      if (dms) {
        await dmsRepo.reset(data.dmsId, dms.interval_minutes)
        dmsReset = true
      }
    }

    const tourist = await touristRepo.findById(touristId)
    return { checkin, dmsReset, tourist }
  })

  emitCheckinUpdate(touristId, tourist.guardian_token,
    { latitude: data.latitude, longitude: data.longitude },
    data.batteryPct, null)

  if (data.batteryPct !== null && data.batteryPct <= 20) {
    logger.warn({ touristId, batteryPct: data.batteryPct }, 'Tourist battery critically low')
  }

  return { checkin, dmsReset }
}

async function getRecentCheckins(touristId, filters) {
  return new CheckinRepository().findByTouristId(touristId, filters)
}

module.exports = { createCheckin, getRecentCheckins }
