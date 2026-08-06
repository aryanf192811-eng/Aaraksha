// src/services/webhook.service.js
// Handles inbound SMS from Twilio — the offline SOS fallback path.
// Parses AARAKSHA_SOS|ID:...|LAT:...|LNG:...|CAT:...|BATT:...|TIME:... format.
'use strict'

const { InboundRepository } = require('../repositories/inbound.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { SOSRepository }     = require('../repositories/sos.repository')
const { LocationRepository }= require('../repositories/location.repository')
const { withTransaction }   = require('../database/transaction')
const { emitSOSReceived }   = require('../socket/emitters')
const { notifyOnSOS }       = require('./notification/notification.service')
const { SOS_CATEGORIES, SOS_TRIGGER_TYPES } = require('../constants/enums')
const logger = require('../utils/logger')

// Regex pattern for structured offline SOS SMS
const SOS_PATTERN = /AARAKSHA_SOS\|ID:([a-f0-9-]{36})\|LAT:(-?\d+\.?\d*)\|LNG:(-?\d+\.?\d*)\|CAT:([A-Z]+)\|BATT:(\d+)\|TIME:(\d+)/

async function processInboundSMS(fromPhone, body) {
  const inboundRepo = new InboundRepository()
  const record      = await inboundRepo.create(fromPhone, body)

  const match = body?.match(SOS_PATTERN)
  if (!match) {
    await inboundRepo.markFailed(record.id, `Pattern not matched. Body: ${body?.slice(0, 100)}`)
    logger.warn({ from: fromPhone }, 'Inbound SMS did not match SOS pattern — ignored')
    return
  }

  const [, touristId, latStr, lngStr, category, battStr, timeStr] = match
  const lat     = parseFloat(latStr)
  const lng     = parseFloat(lngStr)
  const battery = parseInt(battStr, 10)
  const timestamp = parseInt(timeStr, 10) * 1000

  // Validate coordinates
  if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
    await inboundRepo.markFailed(record.id, `Invalid coordinates: lat=${latStr} lng=${lngStr}`)
    return
  }

  // Validate category
  const validCategory = Object.values(SOS_CATEGORIES).includes(category) ? category : SOS_CATEGORIES.OTHER

  // Check location staleness (> 30 minutes old)
  const isStale = Date.now() - timestamp > 30 * 60 * 1000

  const touristRepo = new TouristRepository()
  const tourist = await touristRepo.findById(touristId)

  if (!tourist || !tourist.is_active) {
    await inboundRepo.markFailed(record.id, `Tourist not found or inactive: ${touristId}`)
    logger.warn({ touristId, from: fromPhone }, 'Inbound SOS — tourist not found')
    return
  }

  // Create SOS event in transaction
  const { sosEvent } = await withTransaction(async (client) => {
    const sosRepo_t      = new SOSRepository(client)
    const locationRepo_t = new LocationRepository(client)

    const sosEvent = await sosRepo_t.create({
      touristId:       tourist.id,
      tripId:          null,
      latitude:        lat,
      longitude:       lng,
      isStaleLocation: isStale,
      category:        validCategory,
      triggerType:     SOS_TRIGGER_TYPES.SMS_INBOUND,
      batteryPct:      battery,
      message:         `Offline SOS via SMS. Timestamp: ${new Date(timestamp).toISOString()}${isStale ? ' [STALE LOCATION]' : ''}`,
    })

    // Update location from the SMS (may be stale but it's what we have)
    await locationRepo_t.upsert(tourist.id, { latitude: lat, longitude: lng, batteryPct: battery })

    return { sosEvent }
  })

  // Update inbound record
  await inboundRepo.markParsed(record.id, tourist.id, sosEvent.id)

  // Side effects outside transaction
  emitSOSReceived(sosEvent, tourist)
  notifyOnSOS(tourist, sosEvent).catch(err =>
    logger.error({ err: err.message, sosId: sosEvent.id }, 'Inbound SOS notification failed')
  )

  logger.warn({
    sosId:     sosEvent.id,
    touristId: tourist.id,
    category:  validCategory,
    isStale,
    from:      fromPhone,
  }, 'Offline SOS processed from inbound SMS')
}

module.exports = { processInboundSMS }
