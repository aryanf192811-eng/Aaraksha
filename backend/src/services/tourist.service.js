// src/services/tourist.service.js
'use strict'

const { TouristRepository } = require('../repositories/tourist.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { SOSRepository }      = require('../repositories/sos.repository')
const { TripRepository }     = require('../repositories/trip.repository')
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
  if (data.emergencyContacts) dbFields.emergency_contacts = data.emergencyContacts
  const updated = await repo.update(touristId, dbFields)
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

  const activeSOS = location ? await sosRepo.findLatestActiveByTouristId(tourist.id) : null

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
    activeSOS:    activeSOS ? { id: activeSOS.id, category: activeSOS.category, createdAt: activeSOS.created_at } : null,
    activeTripCity: activeTrip ? JSON.parse(activeTrip.stops || '[]')[0]?.city : null,
    tsiScore:     activeTrip?.tsi_score || null,
    tsiLabel:     activeTrip?.tsi_label || null,
  }
}

module.exports = { getProfile, updateProfile, getGuardianView, computeProfileReadiness }
