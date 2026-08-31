// src/services/sosCluster.service.js
// Priority signal for govt triage, never an auto-verdict. Multiple SOS
// firing from the same nearby location within a short window could be a
// real mass-incident (a landslide, a bus crash) just as easily as
// coordinated fake-SOS abuse -- this only flags "needs human triage,"
// status starts OPEN, and nothing here ever penalizes anyone. Only a govt
// decision (see resolveCluster below) can turn a flag into a trust-score
// consequence, via trustScore.service.js#applyTrustEvent, same
// human-in-the-loop posture as the fraud-confirmation flow.
'use strict'

const { SOSClusterRepository } = require('../repositories/sosCluster.repository')
const { haversineKm } = require('../utils/geo')
const { emitSOSClusterFlagged } = require('../socket/emitters')
const { applyTrustEvent } = require('./trustScore.service')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

// 0.5km/15min is deliberately tight -- this should only fire for SOS that
// are genuinely close together in both space and time, not just "the same
// busy trekking route on the same day."
const CLUSTER_RADIUS_KM = 0.5
const CLUSTER_WINDOW_MINUTES = 15
const CLUSTER_MIN_COUNT = 3
// Generous bounding-box pre-filter for "is there already an open cluster
// near here" -- wider than CLUSTER_RADIUS_KM on purpose so a cluster that's
// drifted slightly (a second wave of SOS a bit further off) still merges
// into the same flag instead of spawning a duplicate.
const NEARBY_CLUSTER_BBOX_DEGREES = 0.02

// Run synchronously at the end of sos.service.js#createSOS -- immediate,
// not on a cron cadence, since a forming cluster is urgent the moment it
// exists. Best-effort: a detection failure must never affect the SOS
// itself (called with .catch() at the call site).
async function checkForCluster(newSos) {
  const repo = new SOSClusterRepository()
  // pg returns NUMERIC/DECIMAL columns as strings, not numbers -- left
  // uncoerced, `centerLat + radiusDegrees` below silently string-
  // concatenates instead of adding (e.g. "26.1442" + 0.02 ->
  // "26.14420.02"), which Postgres then rejects as invalid numeric input.
  // Coerce once, here, so every downstream use (haversine, insert,
  // bounding-box math) is consistently a real number.
  const lat = Number(newSos.latitude)
  const lng = Number(newSos.longitude)

  const sinceIso = new Date(Date.now() - CLUSTER_WINDOW_MINUTES * 60_000).toISOString()
  const recent = await repo.findRecentActive(sinceIso, newSos.id)

  const nearby = recent.filter((r) =>
    haversineKm(lat, lng, Number(r.latitude), Number(r.longitude)) <= CLUSTER_RADIUS_KM
  )
  const involved = [newSos, ...nearby]
  if (involved.length < CLUSTER_MIN_COUNT) return null

  const sosEventIds = involved.map((s) => s.id)
  const existingNearby = await repo.findOpenNear(lat, lng, NEARBY_CLUSTER_BBOX_DEGREES)
  const match = existingNearby.find((c) => c.sos_event_ids.some((id) => sosEventIds.includes(id)))

  let cluster
  if (match) {
    const mergedIds = Array.from(new Set([...match.sos_event_ids, ...sosEventIds]))
    const mergedRows = await repo.findSosByIds(mergedIds)
    cluster = await repo.extend(match.id, {
      sosEventIds: mergedIds,
      touristCount: new Set(mergedRows.map((r) => r.tourist_id)).size,
      categoryDiversity: new Set(mergedRows.map((r) => r.category)).size,
    })
  } else {
    cluster = await repo.create({
      sosEventIds,
      centerLatitude: lat,
      centerLongitude: lng,
      touristCount: new Set(involved.map((s) => s.tourist_id)).size,
      categoryDiversity: new Set(involved.map((s) => s.category)).size,
    })
  }

  if (cluster) {
    emitSOSClusterFlagged(cluster)
    logger.warn({ clusterId: cluster.id, sosEventIds: cluster.sos_event_ids, touristCount: cluster.tourist_count }, 'SOS proximity cluster flagged')
  }
  return cluster
}

async function getOpenClusters() {
  return new SOSClusterRepository().findOpen()
}

// The bridge between detection and Part F's trust scoring -- detection
// never directly penalizes anyone, only this explicit govt decision does.
// CONFIRMED_INCIDENT costs nobody anything (a real mass-casualty event is
// not fraud); only CONFIRMED_ABUSE applies a trust deduction, and only to
// the tourists actually in this specific cluster.
async function resolveCluster(clusterId, decision, govtUserId, resolutionNotes) {
  const repo = new SOSClusterRepository()
  const statusMap = { CONFIRMED_INCIDENT: 'CONFIRMED_INCIDENT', CONFIRMED_ABUSE: 'CONFIRMED_ABUSE', DISMISS: 'DISMISSED' }
  const status = statusMap[decision]
  if (!status) throw Object.assign(new Error(ERRORS.VALIDATION_FAILED), { statusCode: 400 })

  const cluster = await repo.resolve(clusterId, status, govtUserId, resolutionNotes)
  if (!cluster) throw Object.assign(new Error(ERRORS.CLUSTER_NOT_FOUND), { statusCode: 404 })

  if (status === 'CONFIRMED_ABUSE') {
    const rows = await repo.findSosByIds(cluster.sos_event_ids)
    const touristIds = new Set(rows.map((r) => r.tourist_id))
    for (const touristId of touristIds) {
      await applyTrustEvent(touristId, 'CLUSTER_ABUSE_CONFIRMED', { govtUserId, note: resolutionNotes })
        .catch((err) => logger.error({ err: { message: err.message }, touristId, clusterId }, 'Trust event (cluster abuse) failed'))
    }
  }

  logger.info({ clusterId, status, govtUserId }, 'SOS cluster resolved')
  return cluster
}

module.exports = { CLUSTER_MIN_COUNT, checkForCluster, getOpenClusters, resolveCluster }
