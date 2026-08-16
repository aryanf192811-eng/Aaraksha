// src/services/volunteer.service.js
'use strict'

const { VolunteerRepository } = require('../repositories/volunteer.repository')
const { VolunteerDispatchRepository } = require('../repositories/volunteerDispatch.repository')
const { hashPassword, verifyPassword, hashGovtId, normalizePhone, extractSuffix } = require('../utils/crypto')
const { generateJWT } = require('./auth.service')
const { emitVolunteerAssignmentUpdated } = require('../socket/emitters')
const { VOLUNTEER_DISPATCH_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

// Awarded when a volunteer actually shows up vs. just completing the
// response — completion is worth more since it reflects the full
// commitment, not just an initial "I'm on it."
const POINTS_ON_RESPOND = 10
const POINTS_ON_COMPLETE = 25

async function registerVolunteer(data) {
  const repo = new VolunteerRepository()

  const phone = normalizePhone(data.phone)
  const existingPhone = await repo.findByPhone(phone)
  if (existingPhone) throw Object.assign(new Error(ERRORS.VOLUNTEER_PHONE_TAKEN), { statusCode: 409 })

  const govtIdHash = hashGovtId(data.govtIdNumber)
  const govtIdTaken = await repo.govtIdHashExists(govtIdHash)
  if (govtIdTaken) throw Object.assign(new Error(ERRORS.VOLUNTEER_GOVTID_TAKEN), { statusCode: 409 })

  const passwordHash = await hashPassword(data.password)

  const volunteer = await repo.create({
    fullName: data.fullName, phone, passwordHash,
    govtIdType: data.govtIdType, govtIdHash, govtIdSuffix: extractSuffix(data.govtIdNumber),
    district: data.district, state: data.state,
    latitude: data.latitude ?? null, longitude: data.longitude ?? null,
  })

  const token = generateJWT(volunteer.id, 'volunteer')
  logger.info({ volunteerId: volunteer.id }, 'Volunteer registered')
  return { volunteer, token }
}

async function loginVolunteer(data) {
  const repo = new VolunteerRepository()
  const phone = normalizePhone(data.phone)
  const volunteer = await repo.findByPhone(phone)

  if (!volunteer) throw Object.assign(new Error(ERRORS.INVALID_CREDENTIALS), { statusCode: 401 })
  if (!volunteer.is_active) throw Object.assign(new Error(ERRORS.VOLUNTEER_INACTIVE), { statusCode: 401 })

  const valid = await verifyPassword(data.password, volunteer.password_hash)
  if (!valid) throw Object.assign(new Error(ERRORS.INVALID_CREDENTIALS), { statusCode: 401 })

  const { password_hash, ...safeVolunteer } = volunteer
  const token = generateJWT(volunteer.id, 'volunteer')
  logger.info({ volunteerId: volunteer.id }, 'Volunteer logged in')
  return { volunteer: safeVolunteer, token }
}

async function updateStatus(volunteerId, status, latitude, longitude) {
  const repo = new VolunteerRepository()
  const updated = await repo.updateStatus(volunteerId, status, latitude, longitude)
  if (!updated) throw Object.assign(new Error(ERRORS.VOLUNTEER_NOT_FOUND), { statusCode: 404 })
  return updated
}

async function getMyDispatches(volunteerId) {
  return new VolunteerDispatchRepository().findByVolunteerId(volunteerId)
}

// A volunteer can only ever move their OWN dispatch — updateStatus's SQL
// scopes the UPDATE to (id AND volunteer_id), so a mismatched pair
// silently returns null here rather than leaking whether the dispatch ID
// exists at all.
async function updateDispatchStatus(dispatchId, volunteerId, status) {
  const dispatchRepo = new VolunteerDispatchRepository()
  const volunteerRepo = new VolunteerRepository()

  const timestampCol = status === VOLUNTEER_DISPATCH_STATUSES.RESPONDED ? 'responded_at'
    : status === VOLUNTEER_DISPATCH_STATUSES.COMPLETED ? 'resolved_at'
    : null

  let dispatch = await dispatchRepo.updateStatus(dispatchId, volunteerId, status, timestampCol)
  if (!dispatch) throw Object.assign(new Error(ERRORS.DISPATCH_NOT_FOUND), { statusCode: 404 })

  const points = status === VOLUNTEER_DISPATCH_STATUSES.RESPONDED ? POINTS_ON_RESPOND
    : status === VOLUNTEER_DISPATCH_STATUSES.COMPLETED ? POINTS_ON_COMPLETE
    : 0

  if (points > 0) {
    dispatch = await dispatchRepo.awardPoints(dispatchId, points)
    await volunteerRepo.addPoints(volunteerId, points)
  }

  const volunteer = await volunteerRepo.findById(volunteerId)
  emitVolunteerAssignmentUpdated(dispatch, volunteer)
  logger.info({ dispatchId, volunteerId, status, points }, 'Volunteer dispatch updated')
  return dispatch
}

module.exports = {
  registerVolunteer, loginVolunteer, updateStatus, getMyDispatches, updateDispatchStatus,
}
