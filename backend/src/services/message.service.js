// src/services/message.service.js
// Two threads, deliberately deferred out of the earlier rescue-handoff-
// verification pass to get the anti-fraud code+proximity gate right first:
//   - Tourist <-> Guardian: always available while the guardian link is
//     valid, not gated on an active SOS.
//   - Tourist <-> Rescuer: scoped to one active rescue assignment, extends
//     the existing tel: link the same conversation already has. A stale
//     rescuer (declined, reassigned, or the SOS already resolved) can't
//     post into it -- reuses the same ACTIVE_ASSIGNMENT_FILTER every other
//     "am I still assigned" check in rescue.repository.js already relies
//     on, rather than reimplementing that check here.
'use strict'

const { MessageRepository } = require('../repositories/message.repository')
const { SOSRepository } = require('../repositories/sos.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { RescueRepository } = require('../repositories/rescue.repository')
const { emitMessageReceived } = require('../socket/emitters')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

function notFound(message, statusCode = 404) {
  return Object.assign(new Error(message), { statusCode })
}

// ── Tourist <-> Guardian ──────────────────────────────────────────────

async function getGuardianThreadForTourist(touristId, limit) {
  const rows = await new MessageRepository().findByTouristGuardianThread(touristId, limit)
  return rows.reverse() // oldest-first for rendering, newest-first was just the cheap query order
}

// PIN-gated the same way getGuardianView is (see tourist.service.js) — the
// chat thread is just as sensitive as live location, so a leaked link
// alone can't read it either.
async function getGuardianThreadForGuardian(token, pin, limit) {
  const tourist = await new TouristRepository().findByGuardianToken(token)
  if (!tourist) throw Object.assign(new Error(ERRORS.GUARDIAN_TOKEN_INVALID), { statusCode: 404 })
  if (!pin) throw Object.assign(new Error(ERRORS.GUARDIAN_PIN_REQUIRED), { statusCode: 401 })
  if (pin !== tourist.guardian_pin) throw Object.assign(new Error(ERRORS.GUARDIAN_PIN_INCORRECT), { statusCode: 401 })
  return getGuardianThreadForTourist(tourist.id, limit)
}

async function sendGuardianMessageAsTourist(touristId, body) {
  const tourist = await new TouristRepository().findById(touristId)
  const message = await new MessageRepository().create({
    conversationType: 'TOURIST_GUARDIAN', touristId, senderKind: 'TOURIST', senderId: touristId, body,
  })
  emitMessageReceived(message, { touristId, guardianToken: tourist.guardian_token })
  return message
}

async function sendGuardianMessageAsGuardian(token, pin, body) {
  const tourist = await new TouristRepository().findByGuardianToken(token)
  if (!tourist) throw Object.assign(new Error(ERRORS.GUARDIAN_TOKEN_INVALID), { statusCode: 404 })
  if (!pin) throw Object.assign(new Error(ERRORS.GUARDIAN_PIN_REQUIRED), { statusCode: 401 })
  if (pin !== tourist.guardian_pin) throw Object.assign(new Error(ERRORS.GUARDIAN_PIN_INCORRECT), { statusCode: 401 })
  const message = await new MessageRepository().create({
    conversationType: 'TOURIST_GUARDIAN', touristId: tourist.id, senderKind: 'GUARDIAN', senderId: null, body,
  })
  emitMessageReceived(message, { touristId: tourist.id, guardianToken: token })
  return message
}

// ── Tourist <-> Rescuer ────────────────────────────────────────────────

async function loadSosForRescueThread(sosId) {
  const sos = await new SOSRepository().findById(sosId)
  if (!sos) throw notFound(ERRORS.SOS_NOT_FOUND)
  return sos
}

async function getRescueThreadAsTourist(touristId, sosId, limit) {
  const sos = await loadSosForRescueThread(sosId)
  if (sos.tourist_id !== touristId) throw notFound(ERRORS.MESSAGE_NOT_YOUR_SOS, 403)
  return new MessageRepository().findByRescueThread(sosId, limit).then((rows) => rows.reverse())
}

async function getRescueThreadAsVolunteer(volunteerId, limit) {
  const assignment = await new RescueRepository().findActiveAssignmentByVolunteerId(volunteerId)
  if (!assignment) throw notFound(ERRORS.MESSAGE_NO_ASSIGNMENT)
  const rows = await new MessageRepository().findByRescueThread(assignment.sos_event_id, limit)
  return rows.reverse()
}

async function sendRescueMessageAsTourist(touristId, sosId, body) {
  const sos = await loadSosForRescueThread(sosId)
  if (sos.tourist_id !== touristId) throw notFound(ERRORS.MESSAGE_NOT_YOUR_SOS, 403)

  const assignment = await new RescueRepository().findActiveAssignmentBySOS(sosId)
  if (!assignment) throw notFound(ERRORS.MESSAGE_NO_ACTIVE_RESCUER, 400)
  // Official teams have no login yet (a real, scoped-out feature — see the
  // messaging plan) so there's no one on the other end to receive this in
  // real time or reply to it via the API. Reject rather than silently
  // create a message nobody will ever see.
  if (!assignment.volunteer_id) throw notFound(ERRORS.MESSAGE_TEAM_NOT_SUPPORTED, 400)

  const message = await new MessageRepository().create({
    conversationType: 'TOURIST_RESCUER', touristId, sosEventId: sosId, senderKind: 'TOURIST', senderId: touristId, body,
  })
  emitMessageReceived(message, { touristId, volunteerId: assignment.volunteer_id })
  return message
}

async function sendRescueMessageAsVolunteer(volunteerId, body) {
  const assignment = await new RescueRepository().findActiveAssignmentByVolunteerId(volunteerId)
  if (!assignment) throw notFound(ERRORS.MESSAGE_NO_ASSIGNMENT)

  const message = await new MessageRepository().create({
    conversationType: 'TOURIST_RESCUER', touristId: assignment.tourist_id, sosEventId: assignment.sos_event_id,
    senderKind: 'VOLUNTEER', senderId: volunteerId, body,
  })
  emitMessageReceived(message, { touristId: assignment.tourist_id, volunteerId })
  logger.info({ volunteerId, sosId: assignment.sos_event_id }, 'Rescue-thread message sent')
  return message
}

module.exports = {
  getGuardianThreadForTourist, getGuardianThreadForGuardian,
  sendGuardianMessageAsTourist, sendGuardianMessageAsGuardian,
  getRescueThreadAsTourist, getRescueThreadAsVolunteer,
  sendRescueMessageAsTourist, sendRescueMessageAsVolunteer,
}
