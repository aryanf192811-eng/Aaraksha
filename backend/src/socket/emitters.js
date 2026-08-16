// src/socket/emitters.js
// All Socket.IO emit functions. Always use constants from events.js — never string literals.
// All functions are wrapped in try/catch — a socket error must NEVER crash the process.
'use strict'

const { getIO } = require('./index')
const { SOCKET_EVENTS, SOCKET_ROOMS } = require('../constants/events')
const { estimateRescueEtaMinutes } = require('../utils/geo')
const { sendPushToTourist } = require('../services/notification/push.service')
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
    sendPushToTourist(sosEvent.tourist_id, {
      title: 'Aaraksha — SOS Update',
      body: sosEvent.status === 'FALSE_ALARM' ? 'Your SOS was marked as a false alarm.' : 'Your SOS has been marked resolved.',
      url: '/sos',
    })
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
    sendPushToTourist(sosEvent.tourist_id, {
      title: 'Aaraksha — Rescue Dispatched',
      body: `${team.name} is on the way${eta?.etaMinutes ? ` — ETA ${eta.etaMinutes} min` : ''}.`,
      url: '/sos',
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
    sendPushToTourist(tourist.id, {
      title: 'Aaraksha — Dead Man\'s Switch Triggered',
      body: 'You missed a check-in, so an SOS was sent automatically to your contacts and authorities.',
      url: '/sos',
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

// Tourist room: weather risk got WORSE for a destination on their active
// trip since the last hourly poll — distinct from TSI_UPDATED, which fires
// every hour regardless of whether anything actually changed, so a
// tourist would have to go check their trip to notice. This only fires on
// an actual increase.
function emitWeatherRiskIncreased(touristId, tripId, cityName, fromRisk, toRisk, reason) {
  safeEmit(SOCKET_ROOMS.tourist(touristId), SOCKET_EVENTS.WEATHER_RISK_INCREASED, {
    tripId, city: cityName, fromRisk, toRisk, reason, updatedAt: new Date().toISOString(),
  })
  sendPushToTourist(touristId, {
    title: 'Aaraksha — Weather Risk Rising',
    body: `${cityName}: ${fromRisk} → ${toRisk}${reason ? ` — ${reason}` : ''}`,
    url: '/trips',
  })
}

// Tourist room (one per co-traveler): another member of the same group trip
// sent an SOS. Distinct from emitSOSReceived (govt-only) and emitGuardianSOSAlert
// (the sender's own emergency contacts) — this is the sender's travel group,
// who may be nearby and best placed to physically help.
function emitGroupSOSAlert(touristIds, sosEvent, tourist) {
  for (const touristId of touristIds) {
    safeEmit(SOCKET_ROOMS.tourist(touristId), SOCKET_EVENTS.GROUP_SOS_ALERT, {
      sosId: sosEvent.id, tripId: sosEvent.trip_id,
      touristName: tourist?.full_name, category: sosEvent.category,
      latitude: sosEvent.latitude, longitude: sosEvent.longitude,
      createdAt: sosEvent.created_at,
    })
    sendPushToTourist(touristId, {
      title: 'Aaraksha — Group SOS Alert',
      body: `${tourist?.full_name ?? 'A group member'} sent an SOS (${sosEvent.category}).`,
      url: `/trips/${sosEvent.trip_id}`,
    })
  }
}

// Volunteer room (one per nearby verified volunteer): a new SOS landed
// within alert radius. Mirrors emitGroupSOSAlert's loop-based fan-out
// shape. distanceKm travels with each volunteer's own emit — not a shared
// broadcast — since it differs per recipient.
function emitVolunteerSOSAlert(volunteers, sosEvent, tourist) {
  for (const volunteer of volunteers) {
    safeEmit(SOCKET_ROOMS.volunteer(volunteer.id), SOCKET_EVENTS.VOLUNTEER_SOS_ALERT, {
      sosId: sosEvent.id,
      category: sosEvent.category,
      latitude: sosEvent.latitude,
      longitude: sosEvent.longitude,
      distanceKm: volunteer.distanceKm,
      touristFirstName: tourist?.full_name?.split(' ')[0],
      createdAt: sosEvent.created_at,
    })
  }
}

// Govt dashboard: a volunteer moved their own dispatch forward
// (RESPONDED/COMPLETED/DECLINED) — lets operators see volunteer activity
// on an SOS alongside official rescue team status.
function emitVolunteerAssignmentUpdated(dispatch, volunteer) {
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.VOLUNTEER_ASSIGNMENT_UPDATED, {
    dispatchId: dispatch.id,
    sosId: dispatch.sos_event_id,
    volunteerId: dispatch.volunteer_id,
    volunteerName: volunteer?.full_name,
    status: dispatch.status,
    pointsAwarded: dispatch.points_awarded,
  })
}

// Tourist room: a govt-authored CRITICAL news item was posted for a
// destination on this tourist's active trip. INFO/WARNING items don't push
// — only CRITICAL is urgent enough to interrupt, everything else is
// pull-based (visible on the trip's News tab whenever they check).
function emitDestinationNewsCritical(touristId, tripId, destinationName, news) {
  safeEmit(SOCKET_ROOMS.tourist(touristId), SOCKET_EVENTS.DESTINATION_NEWS_CRITICAL, {
    tripId, destinationName,
    newsId: news.id, headline: news.headline, category: news.category, source: news.source,
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

// Guardian room: a rescue team was dispatched to this tourist's SOS — the
// guardian sees the same "help is on the way" state the tourist does,
// instead of just a static red SOS banner until their next 30s poll.
function emitGuardianRescueAssigned(guardianToken, sosEvent, team) {
  if (!guardianToken) return
  const eta = estimateRescueEtaMinutes(team.latitude, team.longitude, sosEvent.latitude, sosEvent.longitude)
  safeEmit(SOCKET_ROOMS.guardian(guardianToken), SOCKET_EVENTS.GUARDIAN_ETA_UPDATE, {
    sosId:      sosEvent.id,
    status:     'ASSIGNED',
    teamName:   team.name,
    teamType:   team.type,
    distanceKm: eta?.distanceKm ?? null,
    etaMinutes: eta?.etaMinutes ?? null,
  })
}

module.exports = {
  emitSOSReceived, emitSOSResolved, emitRescueAssigned, emitDMSTriggered,
  emitTSIUpdated, emitCheckinUpdate, emitGuardianSOSAlert, emitGuardianRescueAssigned,
  emitWeatherRiskIncreased, emitGroupSOSAlert, emitDestinationNewsCritical,
  emitVolunteerSOSAlert, emitVolunteerAssignmentUpdated,
}
