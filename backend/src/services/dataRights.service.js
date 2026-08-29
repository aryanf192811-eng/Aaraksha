// src/services/dataRights.service.js
// Digital Personal Data Protection Act, 2023 (DPDP) — right to access and
// right to erasure, made real rather than left as a privacy-policy
// paragraph nobody can actually exercise. See migration 015_data_rights
// for why deletion anonymizes rather than hard-deletes.
'use strict'

const { TouristRepository } = require('../repositories/tourist.repository')
const { TripRepository } = require('../repositories/trip.repository')
const { CheckinRepository } = require('../repositories/checkin.repository')
const { SOSRepository } = require('../repositories/sos.repository')
const { IncidentRepository } = require('../repositories/incident.repository')
const { CheckpointRepository } = require('../repositories/checkpoint.repository')
const { DataRightsRepository } = require('../repositories/dataRights.repository')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

// Every category of personal data this platform actually holds on a
// tourist, in one document — the DPDP right of access (Section 11) is
// "give me everything you have about me," not a curated subset.
async function exportMyData(touristId) {
  const touristRepo = new TouristRepository()
  const tourist = await touristRepo.findById(touristId)
  if (!tourist) throw Object.assign(new Error(ERRORS.NOT_FOUND), { statusCode: 404 })

  const [trips, checkins, sos, incidents, checkpointScans] = await Promise.all([
    new TripRepository().findByTouristId(touristId, { limit: 1000 }),
    new CheckinRepository().findByTouristId(touristId, { limit: 1000 }),
    new SOSRepository().findByTouristId(touristId, { limit: 1000 }),
    new IncidentRepository().findByTouristId(touristId),
    new CheckpointRepository().findByTouristId(touristId, 1000),
  ])

  return {
    exportedAt: new Date().toISOString(),
    exportNote: 'Every record this platform holds that identifies you, per your right to access under the Digital Personal Data Protection Act, 2023. Internal fields (password hash, government ID hash) are never included in this export — they identify no one and cannot be handed back meaningfully.',
    profile: tourist,
    trips: trips.rows,
    checkIns: checkins,
    sosHistory: sos.rows,
    incidentReportsFiled: incidents,
    governmentCheckpointScans: checkpointScans,
  }
}

async function getPrivacyNotice() {
  // Static, but accurate to what the codebase actually does — not
  // boilerplate. Section 5 of the DPDP Act requires this notice to name
  // the actual purpose per category, not a blanket "for service
  // improvement."
  return {
    categories: [
      { data: 'Name, phone, government ID (stored as an HMAC hash, never the raw number)', purpose: 'Account identity and in-person verification at government checkpoints' },
      { data: 'Live GPS location', purpose: 'Only while a trip is active — powers SOS response, the Guardian tracking link, and Dead Man\'s Switch. Not collected outside an active trip.' },
      { data: 'Blood group and medical notes', purpose: 'Shown to a dispatched rescue team or volunteer only during an actual SOS — never displayed elsewhere' },
      { data: 'Emergency contacts', purpose: 'Notified automatically if you trigger SOS or a Dead Man\'s Switch fires' },
      { data: 'Trip itinerary, check-ins, filed E-FIRs', purpose: 'Your own safety record and journey history — also what a Journey Passport export and the Predictive Risk Model draw on' },
    ],
    rights: [
      { right: 'Right to access', how: 'Download everything held about you — see "Export My Data" below' },
      { right: 'Right to correction', how: 'Edit your profile at any time from the Profile page' },
      { right: 'Right to erasure', how: 'Request account deletion below — granted immediately unless an open SOS or E-FIR requires retention under law' },
      { right: 'Right to grievance redressal', how: 'grievance@aaraksha.gov.in (placeholder — a real deployment would list the appointed Data Protection Officer)' },
    ],
  }
}

// Grants immediately unless the tourist has a genuine open safety/legal
// record — the DPDP Act's own erasure right (Section 12) is explicitly
// subject to retention the law otherwise requires, and an active SOS or
// under-investigation E-FIR is exactly that: erasing it mid-incident
// would destroy the record a real investigation or audit needs.
async function requestDeletion(touristId) {
  const repo = new DataRightsRepository()
  const [openSOS, openIncidents] = await Promise.all([
    repo.countOpenSOSEvents(touristId),
    repo.countOpenIncidentReports(touristId),
  ])

  if (openSOS > 0 || openIncidents > 0) {
    const reasons = []
    if (openSOS > 0) reasons.push(`${openSOS} active SOS event${openSOS === 1 ? '' : 's'}`)
    if (openIncidents > 0) reasons.push(`${openIncidents} E-FIR case${openIncidents === 1 ? '' : 's'}`)
    const reason = `Deletion deferred — ${reasons.join(' and ')} still open. Retention is required until resolved; you can request deletion again afterward.`
    const request = await repo.createDeletionRequest(touristId, 'DENIED', reason)
    logger.info({ touristId, requestId: request.id }, 'Data deletion request deferred — open safety/legal record')
    return { status: 'DENIED', reason }
  }

  await repo.anonymize(touristId)
  const request = await repo.createDeletionRequest(touristId, 'COMPLETED')
  logger.warn({ touristId, requestId: request.id }, 'Tourist account anonymized per DPDP erasure request')
  return { status: 'COMPLETED', reason: null }
}

async function getMyDeletionRequests(touristId) {
  return new DataRightsRepository().findRequestsByTourist(touristId)
}

module.exports = { exportMyData, getPrivacyNotice, requestDeletion, getMyDeletionRequests }
