// src/services/tsi.service.js
// TSI = Travel Safety Index (0–100, higher = safer)
// Rules: worst stop drives the penalty, not average.
'use strict'

const TRAVEL_TYPE_DELTA = {
  SOLO: -12, ADVENTURE: -15, FAMILY: 0, FRIENDS: -5, PILGRIMAGE: -3, BUSINESS: 0,
}
const CONNECTIVITY_PENALTY = { NONE: 20, POOR: 10, MODERATE: 4, GOOD: 0, EXCELLENT: 0 }
const DIFFICULTY_PENALTY = { EASY: 0, MODERATE: 5, HARD: 15, EXTREME: 25 }
const ZONE_PENALTY = { SAFE: 0, CAUTION: 5, ILP_REQUIRED: 10, HIGH_RISK: 20, RESTRICTED: 25 }
const WEATHER_PENALTY = { CLEAR: 0, CLOUDY: 0, FOG: 5, RAIN: 5, HEAVY_RAIN: 15, SNOW: 10, STORM: 20 }

function calculateTSI(trip, weatherCacheMap = {}) {
  let score = 100
  const factors = {}

  // 1. Travel type adjustment
  factors.travelType = TRAVEL_TYPE_DELTA[trip.travel_type || trip.travelType] || 0
  score += factors.travelType

  // 2. Duration penalty (long trips = more exposure to risk)
  const days = Math.ceil((new Date(trip.end_date || trip.endDate) - new Date(trip.start_date || trip.startDate)) / 86400000)
  factors.duration = days > 30 ? -10 : days > 14 ? -5 : 0
  score += factors.duration

  // 3. NER monsoon season penalty (June-September)
  const startMonth = new Date(trip.start_date || trip.startDate).getMonth() + 1
  factors.season = [6, 7, 8, 9].includes(startMonth) ? -10 : 0
  score += factors.season

  // 4. Per-stop analysis — WORST stop drives the penalty
  const stops = Array.isArray(trip.stops) ? trip.stops : (JSON.parse(trip.stops || '[]'))
  let worstPenalty = 0

  for (const stop of stops) {
    let penalty = 0
    penalty += CONNECTIVITY_PENALTY[stop.connectivity] || 0
    const hKm = parseFloat(stop.hospital_km) || 0
    penalty += hKm > 50 ? 15 : hKm > 20 ? 8 : hKm < 5 ? -5 : 0
    const alt = parseInt(stop.altitude_m) || 0
    penalty += alt > 4000 ? 20 : alt > 3000 ? 10 : alt > 2000 ? 4 : 0
    penalty += ZONE_PENALTY[stop.zone_type] || 0
    penalty += DIFFICULTY_PENALTY[stop.difficulty] || 0

    // Weather from cache (by destinationId)
    const destId = stop.destinationId || stop.destination_id
    const weatherEntry = destId && weatherCacheMap[destId]
    if (weatherEntry) {
      penalty += WEATHER_PENALTY[weatherEntry.condition] || 0
      factors.weather = -(WEATHER_PENALTY[weatherEntry.condition] || 0)
    }

    if (penalty > worstPenalty) worstPenalty = penalty
  }

  factors.worstStop = -worstPenalty
  score -= worstPenalty

  // 5. Clamp to [10, 100]
  const finalScore = Math.max(10, Math.min(100, Math.round(score)))
  const label =
    finalScore >= 80 ? 'Low Risk'      :
    finalScore >= 60 ? 'Moderate Risk' :
    finalScore >= 40 ? 'High Risk'     : 'Extreme Risk'

  return {
    score: finalScore,
    label,
    factors,
    recommendations: generateRecommendations(finalScore, trip, stops),
  }
}

function generateRecommendations(score, trip, stops) {
  const recs = []
  recs.push('Share your itinerary with your Guardian contact before departure')
  if (score < 70) recs.push("Enable Dead Man's Switch — set to 2-hour intervals for this route")
  if (score < 70) recs.push('Download offline maps for all destinations before departing')
  if ((trip.travel_type || trip.travelType) === 'SOLO') recs.push('Solo travel detected: set shorter DMS intervals and notify 2 contacts')
  if (stops.some(s => parseInt(s.altitude_m) > 3000)) recs.push('High altitude stops: carry altitude medication (Diamox) — consult doctor')
  if (stops.some(s => s.zone_type === 'ILP_REQUIRED')) recs.push('Inner Line Permit required — verify documentation 7 days in advance')
  if (stops.some(s => ['NONE','POOR'].includes(s.connectivity))) recs.push('Poor/no connectivity zones: save emergency numbers in phone memory (not only contacts app)')
  if (stops.some(s => s.zone_type === 'RESTRICTED')) recs.push('Restricted zone: register with district authorities and provide hotel details')
  if (score < 40) recs.push('Extreme risk: consider travelling with a registered local guide')
  if (stops.some(s => parseFloat(s.hospital_km) > 50)) recs.push('Nearest hospital is far: carry a comprehensive first aid kit and basic medication')
  return recs
}

// Rescue Readiness Score: 6-item checklist → percentage
function computeRescueReadiness(tourist, trip, hasDMSActive = false) {
  const contacts = tourist.emergency_contacts
  const hasContacts = Array.isArray(contacts) ? contacts.length > 0 : false
  const items = {
    emergencyContacts: hasContacts,
    medicalInfo:       !!tourist.blood_group,
    govtIdComplete:    !!tourist.govt_id_suffix,
    dmsEnabled:        hasDMSActive,
    tsiReviewed:       !!(trip && trip.tsi_score),
    offlineMaps:       !!(trip && trip.rescue_readiness && trip.rescue_readiness.offlineMaps),
  }
  const trueCount = Object.values(items).filter(Boolean).length
  const score = Math.round((trueCount / 6) * 100)
  return { items, score }
}

module.exports = { calculateTSI, computeRescueReadiness }
