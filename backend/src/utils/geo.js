// src/utils/geo.js
'use strict'

const EARTH_RADIUS_KM = 6371

// Great-circle distance between two points, in km.
function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Rough rescue ETA from straight-line distance. Two fudge factors account
// for what haversine can't know: (1) mountain/rural roads in Northeast
// India aren't straight, so actual travel distance runs well over
// straight-line — 1.4x is a conservative multiplier, not a routing engine;
// (2) average sustained speed on those roads, not highway speed.
const ROUTE_INEFFICIENCY_FACTOR = 1.4
const AVG_RESCUE_SPEED_KMH = 30

function estimateRescueEtaMinutes(fromLat, fromLng, toLat, toLng) {
  if ([fromLat, fromLng, toLat, toLng].some((v) => v == null)) return null
  const straightLineKm = haversineKm(fromLat, fromLng, toLat, toLng)
  const roadKm = straightLineKm * ROUTE_INEFFICIENCY_FACTOR
  const hours = roadKm / AVG_RESCUE_SPEED_KMH
  return { distanceKm: Math.round(roadKm * 10) / 10, etaMinutes: Math.max(2, Math.round(hours * 60)) }
}

module.exports = { haversineKm, estimateRescueEtaMinutes }
