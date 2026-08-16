// src/services/tourist.service.js
'use strict'

const { TouristRepository } = require('../repositories/tourist.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { SOSRepository }      = require('../repositories/sos.repository')
const { TripRepository }     = require('../repositories/trip.repository')
const { normalizePhone } = require('../utils/crypto')
const { estimateRescueEtaMinutes } = require('../utils/geo')
const { ERRORS } = require('../constants/errors')

// tourists.rescue_readiness_score is a DB column that nothing ever wrote —
// TouristRepository.create() doesn't set it, so it always sat at its
// schema default (0) regardless of how complete the profile actually was.
// Compute it fresh on every read instead of trusting the stored value, so
// it can never go stale as the profile changes.
function computeProfileReadiness(tourist) {
  const contacts = Array.isArray(tourist.emergency_contacts) ? tourist.emergency_contacts : []
  const items = {
    bloodGroup:           !!tourist.blood_group,
    medicalInfo:          !!tourist.medical_info,
    emergencyContact:     contacts.length >= 1,
    twoEmergencyContacts: contacts.length >= 2,
  }
  const trueCount = Object.values(items).filter(Boolean).length
  return Math.round((trueCount / Object.keys(items).length) * 100)
}

async function getProfile(touristId) {
  const repo    = new TouristRepository()
  const tourist = await repo.findById(touristId)
  if (!tourist) throw Object.assign(new Error(ERRORS.NOT_FOUND), { statusCode: 404 })
  return { ...tourist, rescue_readiness_score: computeProfileReadiness(tourist) }
}

async function updateProfile(touristId, data) {
  const repo    = new TouristRepository()
  const dbFields = {}
  if (data.fullName)          dbFields.full_name          = data.fullName
  if (data.email !== undefined) dbFields.email            = data.email
  if (data.bloodGroup)        dbFields.blood_group        = data.bloodGroup
  if (data.medicalInfo)       dbFields.medical_info       = data.medicalInfo
  if (data.profilePhotoUrl !== undefined) dbFields.profile_photo_url = data.profilePhotoUrl

  if (data.emergencyContacts) {
    // Preserve verified status for contacts whose phone number didn't
    // change — the client never sends verified/verifiedAt (server-set
    // only), so without this, every profile save would silently un-verify
    // every contact, even ones the tourist never touched.
    const existing = await repo.findById(touristId)
    const existingByPhone = new Map(
      (Array.isArray(existing?.emergency_contacts) ? existing.emergency_contacts : [])
        .map(c => [normalizePhone(c.phone), c])
    )
    dbFields.emergency_contacts = data.emergencyContacts.map(c => {
      const prior = existingByPhone.get(normalizePhone(c.phone))
      return prior?.verified
        ? { ...c, verified: true, verifiedAt: prior.verifiedAt }
        : { ...c, verified: false, verifiedAt: null }
    })
  }

  const updated = await repo.update(touristId, dbFields)
  return { ...updated, rescue_readiness_score: computeProfileReadiness(updated) }
}

// Called by otp.service.js after a successful emergency-contact OTP check.
async function markEmergencyContactVerified(touristId, rawPhone) {
  const repo = new TouristRepository()
  const tourist = await repo.findById(touristId)
  if (!tourist) throw Object.assign(new Error(ERRORS.NOT_FOUND), { statusCode: 404 })

  const targetPhone = normalizePhone(rawPhone)
  const contacts = Array.isArray(tourist.emergency_contacts) ? tourist.emergency_contacts : []
  let found = false
  const updatedContacts = contacts.map(c => {
    if (normalizePhone(c.phone) === targetPhone) {
      found = true
      return { ...c, verified: true, verifiedAt: new Date().toISOString() }
    }
    return c
  })
  if (!found) throw Object.assign(new Error('Emergency contact not found on this profile'), { statusCode: 404 })

  const updated = await repo.update(touristId, { emergency_contacts: updatedContacts })
  return { ...updated, rescue_readiness_score: computeProfileReadiness(updated) }
}

async function getGuardianView(token) {
  const touristRepo  = new TouristRepository()
  const locationRepo = new LocationRepository()
  const sosRepo      = new SOSRepository()
  const tripRepo     = new TripRepository()

  const tourist = await touristRepo.findByGuardianToken(token)
  if (!tourist) throw Object.assign(new Error(ERRORS.GUARDIAN_TOKEN_INVALID), { statusCode: 404 })

  const [location, activeTrip] = await Promise.all([
    locationRepo.findByTouristId(tourist.id),
    tripRepo.findActiveByTouristId(tourist.id),
  ])

  // Joins to the current (non-resolved) rescue assignment, if any, so the
  // guardian can see "help is on the way" instead of just a static "SOS
  // active" — the same detail the tourist's own app already gets.
  const activeSOS = location ? await sosRepo.findActiveWithRescueInfo(tourist.id) : null
  const hasVolunteer = !!activeSOS?.volunteer_id
  const rescuerBaseLat = activeSOS?.team_id ? activeSOS.team_lat : activeSOS?.volunteer_base_lat
  const rescuerBaseLng = activeSOS?.team_id ? activeSOS.team_lng : activeSOS?.volunteer_base_lng
  const rescuerLat = activeSOS?.rescuer_latitude ?? rescuerBaseLat
  const rescuerLng = activeSOS?.rescuer_longitude ?? rescuerBaseLng
  const rescueEta = (activeSOS?.team_id || hasVolunteer)
    ? estimateRescueEtaMinutes(rescuerLat, rescuerLng, activeSOS.latitude, activeSOS.longitude)
    : null

  // node-postgres auto-parses JSONB columns into real JS values, so `stops`
  // arrives as an already-parsed array, not a string — JSON.parse on it
  // throws ("[object Object]" is not valid JSON). Every other place in this
  // codebase that reads trip.stops guards against that; this one didn't.
  const activeStops = activeTrip
    ? (Array.isArray(activeTrip.stops) ? activeTrip.stops : JSON.parse(activeTrip.stops || '[]'))
    : []

  // Return privacy-safe subset — first name only
  return {
    firstName:    tourist.full_name.split(' ')[0],
    bloodGroup:   tourist.blood_group,
    medicalInfo:  tourist.medical_info,
    location:     location ? {
      latitude:   location.latitude,
      longitude:  location.longitude,
      batteryPct: location.battery_pct,
      updatedAt:  location.updated_at,
    } : null,
    activeSOS:    activeSOS ? {
      id: activeSOS.id, category: activeSOS.category, status: activeSOS.status, createdAt: activeSOS.created_at,
      rescueTeam: activeSOS.team_id ? {
        name: activeSOS.team_name, type: activeSOS.team_type,
        etaMinutes: rescueEta?.etaMinutes ?? null,
      } : null,
      // Live rescuer marker — only populated once a rescuer (volunteer or
      // team) is assigned. latitude/longitude tracks the rescuer's last
      // reported GPS fix (falls back to their registered base if they
      // haven't sent one yet); isLive tells the client which it's showing.
      rescuer: (activeSOS.team_id || hasVolunteer) ? {
        kind: activeSOS.team_id ? 'TEAM' : 'VOLUNTEER',
        name: activeSOS.team_id ? activeSOS.team_name : activeSOS.volunteer_name,
        latitude: rescuerLat,
        longitude: rescuerLng,
        isLive: activeSOS.rescuer_latitude != null,
      } : null,
    } : null,
    activeTripCity: activeStops[0]?.city ?? null,
    tsiScore:     activeTrip?.tsi_score ?? null,
    tsiLabel:     activeTrip?.tsi_label ?? null,
  }
}

module.exports = { getProfile, updateProfile, getGuardianView, computeProfileReadiness, markEmergencyContactVerified }
