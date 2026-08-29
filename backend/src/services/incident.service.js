// src/services/incident.service.js
// E-FIR-style triage workflow — see migration 012_incident_reports for why
// this is a separate table/flow from both sos_events (live emergencies)
// and scam_reports (crowd-sourced community warnings, no officer involved).
'use strict'

const { IncidentRepository } = require('../repositories/incident.repository')
const { TripRepository } = require('../repositories/trip.repository')
const { emitIncidentFiled, emitIncidentStatusUpdated } = require('../socket/emitters')
const { INCIDENT_CATEGORIES, INCIDENT_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

// A blunt, explainable severity default — same "rule-based, not a black
// box" stance as TSI and the anomaly detector. An officer can always raise
// or lower it manually once they've actually read the report.
const HIGH_PRIORITY_CATEGORIES = new Set([INCIDENT_CATEGORIES.ASSAULT, INCIDENT_CATEGORIES.VEHICLE_ACCIDENT])
const LOW_PRIORITY_CATEGORIES  = new Set([INCIDENT_CATEGORIES.LOST_DOCUMENT])

function defaultPriority(category) {
  if (HIGH_PRIORITY_CATEGORIES.has(category)) return 'HIGH'
  if (LOW_PRIORITY_CATEGORIES.has(category)) return 'LOW'
  return 'MEDIUM'
}

// The investigation ladder, enforced — updateStatus() previously validated
// only enum membership, so a direct FILED -> RESOLVED call skipped
// ASSIGNED/UNDER_INVESTIGATION entirely and produced a "resolved" case with
// no officer of record (assigned_officer_id still null). CLOSED is reachable
// from any non-terminal state as a deliberate administrative dismissal (a
// duplicate or invalid report shouldn't need a fake investigation first);
// RESOLVED specifically means an investigation concluded, so it's only
// reachable from UNDER_INVESTIGATION. Re-submitting the current status is
// always allowed as a no-op, since the govt UI resends it on every
// priority/notes-only update.
const VALID_STATUS_TRANSITIONS = Object.freeze({
  [INCIDENT_STATUSES.FILED]:               [INCIDENT_STATUSES.ASSIGNED, INCIDENT_STATUSES.CLOSED],
  [INCIDENT_STATUSES.ASSIGNED]:            [INCIDENT_STATUSES.UNDER_INVESTIGATION, INCIDENT_STATUSES.CLOSED],
  [INCIDENT_STATUSES.UNDER_INVESTIGATION]: [INCIDENT_STATUSES.RESOLVED, INCIDENT_STATUSES.CLOSED],
  [INCIDENT_STATUSES.RESOLVED]:            [],
  [INCIDENT_STATUSES.CLOSED]:              [],
})

// Never trust a client-supplied JSON string at face value — parsed and
// reshaped into exactly the fields expected (class name + confidence),
// dropping anything else, before it ever reaches a SQL parameter. Bad
// input degrades to "no tags" rather than a 500 — this is optional
// evidence context for the officer, not something the filing should fail
// over.
function sanitizeDetectedTags(rawJson) {
  if (!rawJson) return null
  try {
    const parsed = JSON.parse(rawJson)
    if (!Array.isArray(parsed)) return null
    const cleaned = parsed
      .filter(t => t && typeof t.class === 'string' && typeof t.score === 'number')
      .map(t => ({ class: t.class.slice(0, 50), score: Math.round(Math.min(1, Math.max(0, t.score)) * 100) / 100 }))
      .slice(0, 10)
    return cleaned.length > 0 ? cleaned : null
  } catch {
    return null
  }
}

async function fileIncident(touristId, data, photoFile = null) {
  if (data.tripId) {
    const trip = await new TripRepository().findById(data.tripId, touristId)
    if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })
  }

  const { detectedTagsJson, ...rest } = data
  const repo = new IncidentRepository()
  const incident = await repo.create({
    touristId, ...rest,
    priority: defaultPriority(data.category),
    photoUrl: photoFile ? `/uploads/incidents/${photoFile.filename}` : null,
    detectedTags: sanitizeDetectedTags(detectedTagsJson),
  })
  const withTourist = await repo.findById(incident.id)
  emitIncidentFiled(withTourist)
  logger.info({ touristId, incidentId: incident.id, caseNumber: incident.case_number, category: data.category, hasPhoto: !!photoFile }, 'Incident report filed')
  return incident
}

async function getMyIncidents(touristId) {
  return new IncidentRepository().findByTouristId(touristId)
}

async function getIncident(id, touristId = null) {
  const incident = await new IncidentRepository().findById(id)
  if (!incident) throw Object.assign(new Error(ERRORS.INCIDENT_NOT_FOUND), { statusCode: 404 })
  if (touristId && incident.tourist_id !== touristId) {
    throw Object.assign(new Error(ERRORS.INCIDENT_NOT_FOUND), { statusCode: 404 })
  }
  return incident
}

async function getQueue(filters) {
  return new IncidentRepository().findQueue(filters)
}

async function getAssignableOfficers() {
  return new IncidentRepository().findAssignableOfficers()
}

// Defaults to self-assignment (officerId omitted) — the common case of an
// officer picking up a case from the unassigned queue — but a
// DISTRICT_ADMIN/SUPER_ADMIN can hand a case to a specific POLICE officer
// instead, same optional-target pattern as govtService.assignRescue.
async function assignIncident(id, actingOfficerId, targetOfficerId) {
  const repo = new IncidentRepository()
  const existing = await repo.findById(id)
  if (!existing) throw Object.assign(new Error(ERRORS.INCIDENT_NOT_FOUND), { statusCode: 404 })

  const incident = await repo.assign(id, targetOfficerId || actingOfficerId)
  emitIncidentStatusUpdated(incident)
  logger.info({ incidentId: id, officerId: targetOfficerId || actingOfficerId }, 'Incident report assigned')
  return repo.findById(id)
}

async function updateStatus(id, status, resolutionNotes, priority) {
  const repo = new IncidentRepository()
  const existing = await repo.findById(id)
  if (!existing) throw Object.assign(new Error(ERRORS.INCIDENT_NOT_FOUND), { statusCode: 404 })
  if (!Object.values(INCIDENT_STATUSES).includes(status)) {
    throw Object.assign(new Error(ERRORS.VALIDATION_FAILED), { statusCode: 400 })
  }

  if (status !== existing.status) {
    const isTerminal = VALID_STATUS_TRANSITIONS[existing.status]?.length === 0
    if (isTerminal) {
      throw Object.assign(new Error(ERRORS.INCIDENT_ALREADY_CLOSED), { statusCode: 400 })
    }
    if (!VALID_STATUS_TRANSITIONS[existing.status]?.includes(status)) {
      throw Object.assign(
        new Error(`Cannot move a case from ${existing.status} to ${status} directly — the investigation ladder requires ${VALID_STATUS_TRANSITIONS[existing.status].join(' or ')} next`),
        { statusCode: 400 }
      )
    }
  }

  await repo.updateStatus(id, status, resolutionNotes, priority)
  const incident = await repo.findById(id)
  emitIncidentStatusUpdated(incident)
  logger.info({ incidentId: id, status }, 'Incident report status updated')
  return incident
}

module.exports = { fileIncident, getMyIncidents, getIncident, getQueue, getAssignableOfficers, assignIncident, updateStatus }
