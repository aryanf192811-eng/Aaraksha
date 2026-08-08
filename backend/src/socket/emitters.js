// src/socket/emitters.js
// All Socket.IO emit functions. Always use constants from events.js — never string literals.
// All functions are wrapped in try/catch — a socket error must NEVER crash the process.
'use strict'

const { getIO } = require('./index')
const { SOCKET_EVENTS, SOCKET_ROOMS } = require('../constants/events')
const { estimateRescueEtaMinutes } = require('../utils/geo')
const logger = require('../utils/logger')

function safeEmit(room, event, payload) {
  try {
    const io = getIO()
    io.to(room).emit(event, { ...payload, emittedAt: new Date().toISOString() })
    logger.debug({ room, event }, 'Socket event emitted')
  } catch (err) {
    logger.error({ err: err.message, room, event }, 'Socket emit failed')
  }
}

// Govt dashboard: new SOS arrived
function emitSOSReceived(sosEvent, tourist) {
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.SOS_RECEIVED, {
    sosId:          sosEvent.id,
    touristId:      sosEvent.tourist_id,
    touristName:    tourist?.full_name,
    phone:          tourist?.phone,
    bloodGroup:     tourist?.blood_group,
    emergencyContacts: tourist?.emergency_contacts,
    category:       sosEvent.category,
    triggerType:    sosEvent.trigger_type,
    latitude:       sosEvent.latitude,
    longitude:      sosEvent.longitude,
    locationAccuracyM: sosEvent.location_accuracy_m,
    isStaleLocation:sosEvent.is_stale_location,
    batteryPct:     sosEvent.battery_pct,
    tripId:         sosEvent.trip_id,
    status:         sosEvent.status,
    createdAt:      sosEvent.created_at,
  })
}

// Govt dashboard + the reporting tourist's own room: SOS resolved or marked
// false alarm. sosEvent is the post-update row (RETURNING *), so its status
// reflects which of the two actually happened rather than assuming RESOLVED.
function emitSOSResolved(sosEvent, resolutionNotes) {
  const payload = {
    sosId: sosEvent.id, status: sosEvent.status, resolutionNotes,
    resolvedAt: sosEvent.resolved_at || new Date().toISOString(),
  }
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.SOS_RESOLVED, payload)
  if (sosEvent.tourist_id) {
    safeEmit(SOCKET_ROOMS.tourist(sosEvent.tourist_id), SOCKET_EVENTS.SOS_STATUS_UPDATED, payload)
  }
}

// Govt dashboard + the reporting tourist's own room: rescue assigned to SOS.
// The tourist side needs to know help is on the way — without this they had
// no way to find out an SOS they sent was actually being acted on.
function emitRescueAssigned(assignment, sosEvent, team) {
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.RESCUE_ASSIGNED, {
    assignmentId: assignment.id,
    sosId:        sosEvent.id,
    teamId:       team.id,
    teamName:     team.name,
    teamType:     team.type,
    district:     team.district,
    status:       assignment.status,
    assignedAt:   assignment.assigned_at,
  })
  if (sosEvent.tourist_id) {
    const eta = estimateRescueEtaMinutes(team.latitude, team.longitude, sosEvent.latitude, sosEvent.longitude)
    safeEmit(SOCKET_ROOMS.tourist(sosEvent.tourist_id), SOCKET_EVENTS.SOS_STATUS_UPDATED, {
      sosId: sosEvent.id, status: 'ASSIGNED', teamName: team.name, teamType: team.type,
      teamPhone: team.contact_phone, teamLat: team.latitude, teamLng: team.longitude,
      distanceKm: eta?.distanceKm ?? null, etaMinutes: eta?.etaMinutes ?? null,
    })
  }
}

// Govt dashboard + Tourist room: DMS triggered
function emitDMSTriggered(sosEvent, tourist) {
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.DMS_TRIGGERED, {
    sosId:       sosEvent.id,
    touristId:   sosEvent.tourist_id,
    touristName: tourist?.full_name,
    phone:       tourist?.phone,
    category:    sosEvent.category,
    triggerType: sosEvent.trigger_type,
    latitude:    sosEvent.latitude,
    longitude:   sosEvent.longitude,
    createdAt:   sosEvent.created_at,
  })
  // Also notify the tourist's own room
  if (tourist?.id) {
    safeEmit(SOCKET_ROOMS.tourist(tourist.id), SOCKET_EVENTS.DMS_TRIGGERED_OWN, {
      message: 'Your Dead Man\'s Switch triggered — SOS has been sent automatically.',
      sosId:   sosEvent.id,
    })
  }
}

// Tourist room: TSI recalculated (weather update or manual recalc)
function emitTSIUpdated(touristId, tripId, tsiScore, tsiLabel, tsiFactors) {
  safeEmit(SOCKET_ROOMS.tourist(touristId), SOCKET_EVENTS.TSI_UPDATED, {
    tripId, tsiScore, tsiLabel, tsiFactors, updatedAt: new Date().toISOString(),
  })
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.TSI_BULK_UPDATE, {
    touristId, tripId, tsiScore, tsiLabel,
  })
}

// Guardian room + Govt dashboard: tourist checked in
function emitCheckinUpdate(touristId, guardianToken, location, batteryPct, eta) {
  const payload = {
    touristId,
    latitude:   location?.latitude,
    longitude:  location?.longitude,
    batteryPct,
    eta,
    updatedAt:  new Date().toISOString(),
  }
  if (guardianToken) {
    safeEmit(SOCKET_ROOMS.guardian(guardianToken), SOCKET_EVENTS.GUARDIAN_LOCATION_UPDATE, payload)
  }
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.LIVE_MAP_UPDATE, { ...payload })
}

// Guardian room: SOS alert for guardian
function emitGuardianSOSAlert(guardianToken, sosEvent, tourist) {
  if (!guardianToken) return
  safeEmit(SOCKET_ROOMS.guardian(guardianToken), SOCKET_EVENTS.GUARDIAN_SOS_ALERT, {
    sosId:     sosEvent.id,
    category:  sosEvent.category,
    latitude:  sosEvent.latitude,
    longitude: sosEvent.longitude,
    createdAt: sosEvent.created_at,
    touristFirstName: tourist?.full_name?.split(' ')[0],
  })
}

module.exports = {
  emitSOSReceived, emitSOSResolved, emitRescueAssigned, emitDMSTriggered,
  emitTSIUpdated, emitCheckinUpdate, emitGuardianSOSAlert,
}
