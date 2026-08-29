// src/services/handoff.service.js
// Anti-fraud rescue handoff verification. A dishonest rescuer could
// previously claim "arrived" and have govt close the case by phone without
// ever reaching the tourist. The tourist now holds a short code (reusing
// the existing otp_verifications infrastructure — same 6-digit/HMAC-SHA256/
// 3-attempt-lockout pattern as password reset, see otp.service.js, purpose
// RESCUE_HANDOFF) that the rescuer must obtain from them in person, from
// within a proximity threshold of the tourist's last known location,
// before resolveSOS will allow the case to close.
'use strict'

const crypto = require('crypto')
const { OTPRepository } = require('../repositories/otp.repository')
const { SOSRepository } = require('../repositories/sos.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { RescueRepository } = require('../repositories/rescue.repository')
const { haversineKm } = require('../utils/geo')
const { normalizePhone } = require('../utils/crypto')
const { emitHandoffVerified } = require('../socket/emitters')
const { SOS_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const config = require('../config/env')
const logger = require('../utils/logger')

const PURPOSE = 'RESCUE_HANDOFF'
const CODE_EXPIRE_HOURS = 6 // a real rescue can take hours in remote terrain
const MAX_ATTEMPTS = 3
const MAX_REGENERATIONS_PER_HOUR = 3
// Generous for rural/mountain GPS drift — this app's own risk model already
// treats the terrain this way (see destination seed data's hospital_km,
// connectivity fields); a food-delivery app's tight geofence would produce
// false "too far" rejections here.
const PROXIMITY_THRESHOLD_KM = 0.25

function generateCode() {
  return crypto.randomInt(100_000, 999_999).toString()
}

function hashCode(code) {
  return crypto.createHmac('sha256', config.security.govtIdSecret).update(code).digest('hex')
}

async function getOrCreateHandoffCode(touristId, sosId) {
  const sosRepo     = new SOSRepository()
  const touristRepo = new TouristRepository()
  const otpRepo      = new OTPRepository()

  const sos = await sosRepo.findById(sosId)
  if (!sos || sos.tourist_id !== touristId) {
    throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  }
  if (![SOS_STATUSES.ACTIVE, SOS_STATUSES.ASSIGNED].includes(sos.status)) {
    throw Object.assign(new Error(ERRORS.HANDOFF_NOT_ELIGIBLE), { statusCode: 400 })
  }

  const tourist = await touristRepo.findById(touristId)
  const phone   = normalizePhone(tourist.phone)

  const existing = await otpRepo.findValid(phone, PURPOSE)
  if (existing) {
    // Can't un-hash a code that's already been issued — and silently
    // re-issuing would invalidate whatever the rescuer already has from
    // the tourist. The tourist's own app is expected to cache the
    // plaintext it got the first time; regenerateHandoffCode below is the
    // deliberate, explicit way to get a new one.
    return { alreadyIssued: true, expiresAt: existing.expires_at }
  }

  const code      = generateCode()
  const expiresAt = new Date(Date.now() + CODE_EXPIRE_HOURS * 60 * 60 * 1000)
  await otpRepo.create(phone, hashCode(code), PURPOSE, expiresAt)
  logger.info({ touristId, sosId }, 'Rescue handoff code issued')

  return { alreadyIssued: false, code, expiresAt }
}

async function regenerateHandoffCode(touristId, sosId) {
  const sosRepo     = new SOSRepository()
  const touristRepo = new TouristRepository()
  const otpRepo      = new OTPRepository()

  const sos = await sosRepo.findById(sosId)
  if (!sos || sos.tourist_id !== touristId) {
    throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  }
  if (![SOS_STATUSES.ACTIVE, SOS_STATUSES.ASSIGNED].includes(sos.status)) {
    throw Object.assign(new Error(ERRORS.HANDOFF_NOT_ELIGIBLE), { statusCode: 400 })
  }

  const tourist = await touristRepo.findById(touristId)
  const phone   = normalizePhone(tourist.phone)

  const recentCount = await otpRepo.countRecentRequests(phone, PURPOSE, 60)
  if (recentCount >= MAX_REGENERATIONS_PER_HOUR) {
    throw Object.assign(
      new Error('Too many new codes requested. Wait an hour before generating another.'),
      { statusCode: 429 }
    )
  }

  const code      = generateCode()
  const expiresAt = new Date(Date.now() + CODE_EXPIRE_HOURS * 60 * 60 * 1000)
  // create() already invalidates the previous unused code for this
  // phone+purpose — deliberate here: this IS the "I lost it, start over"
  // path, so the old code (whatever the rescuer may have heard already)
  // should stop working.
  await otpRepo.create(phone, hashCode(code), PURPOSE, expiresAt)
  logger.info({ touristId, sosId }, 'Rescue handoff code regenerated')

  return { code, expiresAt }
}

// Shared verification core for both the volunteer's own in-field entry
// and govt's relay entry on behalf of an official team.
async function verifyHandoff({ assignment, code, rescuerKind }) {
  const sosRepo      = new SOSRepository()
  const touristRepo  = new TouristRepository()
  const locationRepo = new LocationRepository()
  const otpRepo       = new OTPRepository()

  const sos = await sosRepo.findById(assignment.sos_event_id)
  if (!sos) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })

  // Proximity gate — only enforceable when a live rescuer position exists.
  // A team assignment with no live position yet (shouldn't happen once an
  // OFFICIAL-type volunteer is on the job, but guarded anyway) skips the
  // geofence rather than hard-failing; the code check below still applies.
  if (assignment.rescuer_latitude != null && assignment.rescuer_longitude != null) {
    const loc = await locationRepo.findByTouristId(sos.tourist_id)
    const touristLat = loc ? loc.latitude : sos.latitude
    const touristLng = loc ? loc.longitude : sos.longitude
    const distanceKm = haversineKm(
      Number(assignment.rescuer_latitude), Number(assignment.rescuer_longitude),
      Number(touristLat), Number(touristLng)
    )
    if (distanceKm > PROXIMITY_THRESHOLD_KM) {
      throw Object.assign(new Error(ERRORS.HANDOFF_TOO_FAR), { statusCode: 400 })
    }
  }

  const touristRow = await touristRepo.findById(sos.tourist_id)
  const phone = normalizePhone(touristRow.phone)
  const record = await otpRepo.findValid(phone, PURPOSE)
  if (!record) throw Object.assign(new Error(ERRORS.HANDOFF_CODE_INVALID), { statusCode: 400 })

  if (record.attempts >= MAX_ATTEMPTS) {
    throw Object.assign(
      new Error(`Code locked after ${MAX_ATTEMPTS} failed attempts. Ask the tourist to generate a new one.`),
      { statusCode: 429 }
    )
  }

  const providedHash = hashCode(String(code).trim())
  const expectedBuf = Buffer.from(record.otp_hash, 'hex')
  const providedBuf = Buffer.from(providedHash, 'hex')
  const isValid = expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf)

  if (!isValid) {
    const newAttempts = await otpRepo.incrementAttempts(record.id)
    const remaining   = Math.max(0, MAX_ATTEMPTS - newAttempts)
    throw Object.assign(
      new Error(`Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`),
      { statusCode: 400 }
    )
  }

  await otpRepo.markUsed(record.id)
  const updated = await sosRepo.recordHandoffVerified(sos.id, rescuerKind)
  emitHandoffVerified(updated, touristRow.guardian_token, assignment.volunteer_id)
  logger.info({ sosId: sos.id, rescuerKind }, 'Rescue handoff verified')
  return updated
}

async function verifyHandoffAsVolunteer(volunteerId, code) {
  const assignment = await new RescueRepository().findActiveAssignmentByVolunteerId(volunteerId)
  if (!assignment) throw Object.assign(new Error(ERRORS.HANDOFF_NO_ASSIGNMENT), { statusCode: 404 })
  return verifyHandoff({ assignment, code, rescuerKind: 'VOLUNTEER' })
}

async function verifyHandoffAsTeamRelay(sosId, code) {
  const assignment = await new RescueRepository().findActiveAssignmentBySOS(sosId)
  if (!assignment) throw Object.assign(new Error(ERRORS.HANDOFF_NO_ASSIGNMENT), { statusCode: 404 })
  return verifyHandoff({ assignment, code, rescuerKind: 'TEAM' })
}

module.exports = {
  getOrCreateHandoffCode, regenerateHandoffCode,
  verifyHandoffAsVolunteer, verifyHandoffAsTeamRelay,
}
