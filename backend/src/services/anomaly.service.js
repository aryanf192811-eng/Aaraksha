// src/services/anomaly.service.js
// Rule-based, always-on safety net — SIH25002 calls for detecting "sudden
// location drop-offs, prolonged inactivity, or deviation from planned
// routes" independent of whether a tourist opted into a Dead Man's Switch.
// Deliberately rule-based and explainable (distance/time thresholds), not
// a black-box model — same "TSI is rule-based, not AI" honesty this
// codebase already holds itself to elsewhere. A govt operator can see
// exactly why something was flagged, not just that a model said so.
'use strict'

const { AnomalyRepository } = require('../repositories/anomaly.repository')
const { haversineKm } = require('../utils/geo')
const { emitAnomalyDetected, emitAnomalyResolved } = require('../socket/emitters')
const { ANOMALY_TYPES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

// Long enough that a phone dying overnight or a genuinely quiet stretch in
// a low-connectivity valley doesn't false-positive; short enough to still
// matter for a real safety net. Only evaluated when we HAVE at least one
// past location ping — a tourist who never once reported a location has no
// baseline to measure "went quiet" against, so that case is left to
// ROUTE_DEVIATION / DMS instead rather than guessed at.
const INACTIVITY_THRESHOLD_HOURS = 6

// Generous on purpose — Northeast India's mountain road network means the
// straight-line gap between "at a planned stop" and "on the connecting
// road between two stops" can legitimately run tens of km. This is tuned
// to catch someone who's genuinely off-itinerary, not someone en route.
const ROUTE_DEVIATION_KM = 60

async function detectAnomalies() {
  const repo = new AnomalyRepository()
  const candidates = await repo.findActiveTripCandidates()
  let created = 0

  for (const row of candidates) {
    try {
      const hasLocation = row.latitude != null && row.longitude != null
      const hoursSinceUpdate = row.location_updated_at
        ? (Date.now() - new Date(row.location_updated_at).getTime()) / 3_600_000
        : null

      // ── Inactivity ────────────────────────────────────────────────
      if (hoursSinceUpdate != null && hoursSinceUpdate >= INACTIVITY_THRESHOLD_HOURS) {
        if (await flagIfNotAlreadyOpen(repo, row, ANOMALY_TYPES.INACTIVITY, {
          lastLatitude: row.latitude, lastLongitude: row.longitude,
          lastLocationAt: row.location_updated_at,
          details: `No location update in ${Math.floor(hoursSinceUpdate)}h (threshold: ${INACTIVITY_THRESHOLD_HOURS}h)`,
        })) created++
      }

      // ── Route deviation ──────────────────────────────────────────
      if (hasLocation) {
        const stops = Array.isArray(row.stops) ? row.stops : JSON.parse(row.stops || '[]')
        const stopsWithCoords = stops.filter(s => s.lat != null && s.lng != null)
        if (stopsWithCoords.length > 0) {
          const nearestKm = Math.min(
            ...stopsWithCoords.map(s => haversineKm(row.latitude, row.longitude, s.lat, s.lng))
          )
          if (nearestKm > ROUTE_DEVIATION_KM) {
            if (await flagIfNotAlreadyOpen(repo, row, ANOMALY_TYPES.ROUTE_DEVIATION, {
              lastLatitude: row.latitude, lastLongitude: row.longitude,
              lastLocationAt: row.location_updated_at,
              distanceFromRouteKm: Math.round(nearestKm * 10) / 10,
              details: `${Math.round(nearestKm)}km from the nearest planned stop (threshold: ${ROUTE_DEVIATION_KM}km)`,
            })) created++
          }
        }
      }
    } catch (err) {
      logger.error({ err: { message: err.message }, touristId: row.tourist_id }, 'Anomaly detection failed for tourist')
    }
  }

  return { candidates: candidates.length, created }
}

async function flagIfNotAlreadyOpen(repo, row, type, fields) {
  const existing = await repo.findOpenByTouristAndType(row.tourist_id, type)
  if (existing) return false

  // A govt operator resolving an anomaly is itself a real check performed
  // on the tourist — re-flagging every single minute afterward purely
  // because the same stale location timestamp still hasn't moved is pure
  // noise, not a new signal, and reads as broken on a demo ("I resolved
  // that, why is it back"). Only reopen once genuinely new information
  // exists — a location update newer than the one already resolved
  // against. A tourist who never pings again stays quiet at the operator's
  // discretion; DMS/SOS remain the actual escalation path for that case.
  const mostRecent = await repo.findMostRecentByTouristAndType(row.tourist_id, type)
  if (mostRecent && mostRecent.status !== 'OPEN') {
    const sameReading = mostRecent.last_location_at && fields.lastLocationAt
      && new Date(mostRecent.last_location_at).getTime() === new Date(fields.lastLocationAt).getTime()
    if (sameReading) return false
  }

  const anomaly = await repo.create({
    touristId: row.tourist_id, tripId: row.trip_id, type, ...fields,
  })
  emitAnomalyDetected(anomaly, {
    id: row.tourist_id, full_name: row.full_name, phone: row.phone,
    blood_group: row.blood_group, emergency_contacts: row.emergency_contacts,
  })
  logger.warn({ touristId: row.tourist_id, type, details: fields.details }, 'Safety anomaly detected')
  return true
}

async function getOpenAnomalies() {
  return new AnomalyRepository().findOpen()
}

async function resolveAnomaly(anomalyId, govtUserId) {
  const repo = new AnomalyRepository()
  const resolved = await repo.resolve(anomalyId, govtUserId)
  if (!resolved) throw Object.assign(new Error(ERRORS.ANOMALY_NOT_FOUND), { statusCode: 404 })
  emitAnomalyResolved(resolved)
  logger.info({ anomalyId, govtUserId }, 'Safety anomaly resolved')
  return resolved
}

module.exports = { detectAnomalies, getOpenAnomalies, resolveAnomaly }
