// src/services/volunteer.service.js
'use strict'

const { VolunteerRepository } = require('../repositories/volunteer.repository')
const { VolunteerDispatchRepository } = require('../repositories/volunteerDispatch.repository')
const { RescueRepository } = require('../repositories/rescue.repository')
const { SOSRepository } = require('../repositories/sos.repository')
const { hashPassword, verifyPassword, hashGovtId, normalizePhone, extractSuffix } = require('../utils/crypto')
const { generateJWT } = require('./auth.service')
const { emitVolunteerAssignmentUpdated, emitRescuerLocationUpdate, emitRescuerStatusUpdate, emitRescuerNavigatingState, emitAssignmentCancelled } = require('../socket/emitters')
const { VOLUNTEER_DISPATCH_STATUSES, ASSIGNMENT_STATUSES, SOS_STATUSES, VOLUNTEER_STATUSES } = require('../constants/enums')
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

// The Rescuer app's "active job" screen — the one rescue_assignments row
// (not volunteer_dispatches — that's the broadcast, this is "you are the
// one officially assigned") this volunteer is currently on, if any.
async function getActiveAssignment(volunteerId) {
  return new RescueRepository().findActiveAssignmentByVolunteerId(volunteerId)
}

// Called every ~8-10s by the Rescuer app while en route — writes the
// rescuer's current position onto their active assignment and fans it out
// live to whoever's watching (tourist, guardian, govt dashboard), the same
// three rooms assignRescue's own post-assignment push already targets.
async function updateRescuerLocation(volunteerId, latitude, longitude) {
  const rescueRepo = new RescueRepository()
  const assignment = await rescueRepo.findActiveAssignmentByVolunteerId(volunteerId)
  if (!assignment) throw Object.assign(new Error(ERRORS.ASSIGNMENT_NOT_FOUND), { statusCode: 404 })

  await rescueRepo.updateAssignmentRescuerLocation(assignment.id, latitude, longitude)
  emitRescuerLocationUpdate(
    { id: assignment.sos_event_id, tourist_id: assignment.tourist_id },
    assignment.guardian_token,
    latitude, longitude
  )
  return { assignmentId: assignment.id, latitude, longitude }
}

// Ephemeral — no DB write, purely a live reassurance broadcast for
// whoever's watching (tourist/guardian). Reuses the same "find the current
// assignment or 404" shape as updateRescuerLocation/updateAssignmentStatus.
async function updateNavigatingState(volunteerId, navigating) {
  const rescueRepo = new RescueRepository()
  const assignment = await rescueRepo.findActiveAssignmentByVolunteerId(volunteerId)
  if (!assignment) throw Object.assign(new Error(ERRORS.ASSIGNMENT_NOT_FOUND), { statusCode: 404 })

  emitRescuerNavigatingState(
    { id: assignment.sos_event_id, tourist_id: assignment.tourist_id },
    assignment.guardian_token,
    navigating
  )
  return { navigating }
}

async function updateAssignmentStatus(volunteerId, status) {
  const rescueRepo = new RescueRepository()
  const current = await rescueRepo.findActiveAssignmentByVolunteerId(volunteerId)
  if (!current) throw Object.assign(new Error(ERRORS.ASSIGNMENT_NOT_FOUND), { statusCode: 404 })

  const updated = await rescueRepo.updateAssignmentStatus(current.id, volunteerId, status)
  if (!updated) throw Object.assign(new Error(ERRORS.ASSIGNMENT_NOT_FOUND), { statusCode: 404 })

  emitRescuerStatusUpdate(
    { id: current.sos_event_id, tourist_id: current.tourist_id },
    current.guardian_token,
    status
  )
  logger.info({ volunteerId, assignmentId: current.id, status }, 'Rescuer status updated')
  return updated
}

// A rescuer backing out of a live assignment — vehicle breakdown, they
// become unable to continue safely, a higher-priority call, or on arrival
// realizing the situation is beyond what they can handle and it needs to
// go to an official team instead. The target status is derived server-side
// from where the assignment actually was, not client-supplied — DECLINED
// if they never left ASSIGNED (backing out before starting), CANCELLED if
// they were already EN_ROUTE/ARRIVED (backing out mid-response). This
// keeps the label honest regardless of what the client sends, and means
// one endpoint covers both cases instead of two that could disagree with
// reality.
//
// Blocked once the handoff has been verified — at that point the rescuer
// has already proven they physically reached the tourist and the case is
// concluding; "cancelling" a completed handoff doesn't mean anything.
//
// Side effects mirror what assignRescue did in reverse: the volunteer goes
// back to AVAILABLE, and — only if no other assignment is already active
// for this SOS — the SOS itself reverts from ASSIGNED to ACTIVE so it
// reappears in govt's unassigned queue for reassignment. Every room
// watching (tourist, guardian, govt) gets an immediate, honest explanation
// via emitAssignmentCancelled rather than silently stale "EN_ROUTE" data.
async function exitAssignment(volunteerId, reason) {
  const rescueRepo = new RescueRepository()
  const current = await rescueRepo.findActiveAssignmentByVolunteerId(volunteerId)
  if (!current) throw Object.assign(new Error(ERRORS.ASSIGNMENT_NOT_FOUND), { statusCode: 404 })
  if (current.handoff_verified_at) {
    throw Object.assign(new Error(ERRORS.ASSIGNMENT_ALREADY_VERIFIED), { statusCode: 400 })
  }

  const targetStatus = current.status === ASSIGNMENT_STATUSES.ASSIGNED
    ? ASSIGNMENT_STATUSES.DECLINED
    : ASSIGNMENT_STATUSES.CANCELLED

  const closed = await rescueRepo.exitAssignment(current.id, volunteerId, targetStatus, reason)
  if (!closed) throw Object.assign(new Error(ERRORS.ASSIGNMENT_NOT_FOUND), { statusCode: 404 })

  const volunteerRepo = new VolunteerRepository()
  const volunteer = await volunteerRepo.updateStatus(volunteerId, VOLUNTEER_STATUSES.AVAILABLE)

  const stillActive = await rescueRepo.findActiveAssignmentBySOS(current.sos_event_id)
  if (!stillActive) {
    const sosRepo = new SOSRepository()
    await sosRepo.updateStatus(current.sos_event_id, SOS_STATUSES.ACTIVE)
  }

  emitAssignmentCancelled(
    { id: current.sos_event_id, tourist_id: current.tourist_id },
    current.guardian_token,
    volunteer?.full_name ?? 'Your assigned volunteer',
    reason
  )
  logger.warn({ volunteerId, assignmentId: current.id, status: targetStatus, reason }, 'Rescuer exited assignment')
  return closed
}

module.exports = {
  registerVolunteer, loginVolunteer, updateStatus, getMyDispatches, updateDispatchStatus,
  getActiveAssignment, updateRescuerLocation, updateNavigatingState, updateAssignmentStatus, exitAssignment,
}
