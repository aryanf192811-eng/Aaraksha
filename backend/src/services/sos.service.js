// src/services/sos.service.js
// THE MOST CRITICAL SERVICE — no mistakes allowed.
'use strict'

const { withTransaction } = require('../database/transaction')
const { SOSRepository } = require('../repositories/sos.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { TripMemberRepository } = require('../repositories/tripMember.repository')
const { VolunteerRepository } = require('../repositories/volunteer.repository')
const { VolunteerDispatchRepository } = require('../repositories/volunteerDispatch.repository')
const { RescueRepository } = require('../repositories/rescue.repository')
const { notifyOnSOS, notifyVolunteersOnSOS } = require('./notification/notification.service')
const { emitSOSReceived, emitSOSResolved, emitGroupSOSAlert, emitGuardianSOSAlert, emitVolunteerSOSAlert } = require('../socket/emitters')
const { SOS_TRIGGER_TYPES, SOS_STATUSES, TEAM_STATUSES, VOLUNTEER_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const { estimateRescueEtaMinutes } = require('../utils/geo')
const logger = require('../utils/logger')

// How far a verified volunteer can be and still get alerted. Wide enough to
// be useful in the sparser parts of Northeast India without paging someone
// an hour away for a nearby-sounding emergency.
const VOLUNTEER_ALERT_RADIUS_KM = 15

async function createSOS(touristId, data) {
  // 1. Run DB writes in a transaction
  const { sosEvent, tourist, isDuplicate } = await withTransaction(async (client) => {
    const sosRepo      = new SOSRepository(client)
    const locationRepo = new LocationRepository(client)
    const touristRepo  = new TouristRepository(client)

    // Idempotency guard: a tourist already mid-incident (double-tap, flaky
    // network retry, second browser tab, panic-mashing the button) must not
    // spawn a second ACTIVE row — the frontend disables re-triggering too
    // (SOSButton's isActive prop), but that's UI, not a guarantee. Returning
    // the existing incident instead of erroring keeps this endpoint safe to
    // call repeatedly. This is a same-tourist dedup, not full incident
    // merging/escalation (parent_sos_id, location trail) — that's real
    // future work, out of scope for this pass.
    const existingActive = await sosRepo.findLatestActiveByTouristId(touristId)
    if (existingActive) {
      const sosEvent = await sosRepo.findById(existingActive.id)
      const tourist = await touristRepo.findById(touristId)
      return { sosEvent, tourist, isDuplicate: true }
    }

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
    return { sosEvent, tourist, isDuplicate: false }
  })

  if (isDuplicate) {
    logger.info({ sosId: sosEvent.id, touristId }, 'Duplicate SOS trigger suppressed — incident already active')
    return sosEvent
  }

  // 2. Side effects AFTER transaction — failures here do not rollback SOS
  emitSOSReceived(sosEvent, tourist)
  emitGuardianSOSAlert(tourist.guardian_token, sosEvent, tourist)

  // Group SOS fan-out: alert co-travelers on the same trip, not just the
  // sender's own emergency contacts — they may be nearby and best placed to
  // physically help. Best-effort: a lookup failure must never block the SOS.
  if (sosEvent.trip_id) {
    new TripMemberRepository().getGroupTouristIds(sosEvent.trip_id)
      .then(groupIds => {
        const others = groupIds.filter(id => id !== touristId)
        if (others.length > 0) emitGroupSOSAlert(others, sosEvent, tourist)
      })
      .catch(err => logger.error({ err: { message: err.message }, sosId: sosEvent.id }, 'Group SOS fan-out failed'))
  }

  // Volunteer network fan-out: alert nearby verified volunteers alongside
  // official channels. Best-effort, same shape as the group SOS fan-out
  // above — a matching/notify failure must never affect the SOS itself.
  new VolunteerRepository().findVerifiedNearby(sosEvent.latitude, sosEvent.longitude, VOLUNTEER_ALERT_RADIUS_KM)
    .then(async (volunteers) => {
      if (volunteers.length === 0) return
      emitVolunteerSOSAlert(volunteers, sosEvent, tourist)
      await notifyVolunteersOnSOS(volunteers, tourist, sosEvent)
      await new VolunteerDispatchRepository().createMany(sosEvent.id, volunteers.map(v => v.id))
    })
    .catch(err => logger.error({ err: { message: err.message }, sosId: sosEvent.id }, 'Volunteer SOS fan-out failed'))

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

// Powers the tourist-facing "rescue is on the way" view. ETA is a rough
// estimate from the team's registered base location, not live GPS — no
// rescue-team-side app/login exists to report a real live position, so this
// is the honest, buildable version: distance-and-speed math, not a
// simulated live tracker.
async function getActiveRescueInfo(touristId) {
  const repo = new SOSRepository()
  const row = await repo.findActiveWithRescueInfo(touristId)
  if (!row) return null

  const hasTeam = !!row.team_id
  const hasVolunteer = !!row.volunteer_id
  // A volunteer's live GPS (once they've sent at least one /me/location
  // update) is a truer "where are they right now" than their registered
  // base — an official team has no live feed, so it always shows base.
  const baseLat = hasTeam ? row.team_lat : row.volunteer_base_lat
  const baseLng = hasTeam ? row.team_lng : row.volunteer_base_lng
  const rescuerLat = row.rescuer_latitude ?? baseLat
  const rescuerLng = row.rescuer_longitude ?? baseLng
  const eta = (hasTeam || hasVolunteer)
    ? estimateRescueEtaMinutes(rescuerLat, rescuerLng, row.latitude, row.longitude)
    : null

  return {
    sosId:      row.id,
    category:   row.category,
    status:     row.status,
    createdAt:  row.created_at,
    latitude:   row.latitude,
    longitude:  row.longitude,
    handoffVerifiedAt:     row.handoff_verified_at,
    handoffVerifiedByKind: row.handoff_verified_by_kind,
    rescuer: (hasTeam || hasVolunteer) ? {
      kind:        hasTeam ? 'TEAM' : 'VOLUNTEER',
      id:          hasTeam ? row.team_id : row.volunteer_id,
      name:        hasTeam ? row.team_name : row.volunteer_name,
      type:        hasTeam ? row.team_type : 'VOLUNTEER',
      phone:       hasTeam ? row.team_phone : row.volunteer_phone,
      latitude:    rescuerLat,
      longitude:   rescuerLng,
      isLive:      row.rescuer_latitude != null,
      liveUpdatedAt: row.rescuer_location_updated_at,
      status:      row.assignment_status,
      assignedAt:  row.assigned_at,
      distanceKm:  eta?.distanceKm ?? null,
      etaMinutes:  eta?.etaMinutes ?? null,
    } : null,
  }
}

async function markFalseAlarm(sosId, touristId) {
  const repo = new SOSRepository()
  const sos = await repo.findById(sosId)

  if (!sos) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  if (sos.tourist_id !== touristId) throw Object.assign(new Error(ERRORS.FORBIDDEN), { statusCode: 403 })
  if ([SOS_STATUSES.RESOLVED, SOS_STATUSES.FALSE_ALARM].includes(sos.status)) {
    throw Object.assign(new Error(ERRORS.SOS_ALREADY_CLOSED), { statusCode: 400 })
  }

  // Mirrors govt.service.js#resolveSOS's rescuer-release step — a tourist
  // cancelling their own SOS is just as final as a govt operator resolving
  // it, but this path never released the assigned team/volunteer back to
  // AVAILABLE, leaving them permanently stuck DEPLOYED with no active job
  // pointing at them. Confirmed live: reproducible on the very first
  // tourist-side false-alarm of an already-assigned SOS.
  const updated = await withTransaction(async (client) => {
    const sosRepo_t = new SOSRepository(client)
    const rescueRepo_t = new RescueRepository(client)

    const updated = await sosRepo_t.updateStatus(sosId, SOS_STATUSES.FALSE_ALARM)
    // The findById check above is TOCTOU-racy against a concurrent resolve/
    // false-alarm; the DB-level guard in updateStatus is the real source of
    // truth, so re-check its result rather than trusting the pre-check alone.
    if (!updated) return null

    const assignment = await rescueRepo_t.resolveAssignment(sosId)
    if (assignment?.team_id) {
      await rescueRepo_t.updateTeamStatus(assignment.team_id, TEAM_STATUSES.AVAILABLE)
    } else if (assignment?.volunteer_id) {
      const volunteerRepo_t = new VolunteerRepository(client)
      await volunteerRepo_t.updateStatus(assignment.volunteer_id, VOLUNTEER_STATUSES.AVAILABLE)
    }
    // Same gap as the rescuer-release fix above, one layer out: every OTHER
    // volunteer who was broadcast an ALERTED notification but never
    // responded (not just the one who was actually assigned) needs that
    // notification closed out too, or it sits in their "Active alerts"
    // list forever pointing at an emergency that's already over.
    await new VolunteerDispatchRepository(client).declineAllPendingForSOS(sosId)
    return updated
  })
  if (!updated) throw Object.assign(new Error(ERRORS.SOS_ALREADY_CLOSED), { statusCode: 400 })

  emitSOSResolved(updated, 'Tourist confirmed false alarm')
  logger.info({ sosId, touristId }, 'SOS marked false alarm')
  return updated
}

module.exports = { createSOS, getSOSHistory, markFalseAlarm, getActiveRescueInfo }
