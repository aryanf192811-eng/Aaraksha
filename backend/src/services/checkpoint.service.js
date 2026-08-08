// src/services/checkpoint.service.js
// QR check-in at govt checkpoints. The tourist app shows a short-lived
// (5-minute) signed QR code; a checkpoint officer scans/enters it to pull up
// the tourist's safety profile and log the pass-through. The token is a JWT
// with role:'checkpoint' — a distinct role from 'tourist'/'govt' so it's
// rejected outright by authenticateTourist/authenticateGovt if anyone tried
// to reuse it as a session token instead of a one-time checkpoint code.
'use strict'

const jwt = require('jsonwebtoken')
const QRCode = require('qrcode')
const config = require('../config/env')
const { TouristRepository } = require('../repositories/tourist.repository')
const { TripRepository } = require('../repositories/trip.repository')
const { CheckpointRepository } = require('../repositories/checkpoint.repository')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

const CHECKPOINT_TOKEN_TTL = '5m'
const CHECKPOINT_TOKEN_TTL_SECONDS = 5 * 60

function generateCheckpointToken(touristId) {
  return jwt.sign({ id: touristId, role: 'checkpoint' }, config.jwt.secret, { expiresIn: CHECKPOINT_TOKEN_TTL })
}

async function getCheckpointQR(touristId) {
  const token = generateCheckpointToken(touristId)
  const qrDataUri = await QRCode.toDataURL(token, { width: 320, margin: 2 })
  return { token, qrDataUri, expiresInSeconds: CHECKPOINT_TOKEN_TTL_SECONDS }
}

async function scanCheckpoint(rawToken, govtUserId, checkpointName, district) {
  let payload
  try {
    payload = jwt.verify(rawToken, config.jwt.secret)
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'This QR code has expired — ask the tourist to refresh it.'
      : 'QR code is invalid.'
    throw Object.assign(new Error(message), { statusCode: 400 })
  }
  if (payload.role !== 'checkpoint') {
    throw Object.assign(new Error('This is not a checkpoint QR code.'), { statusCode: 400 })
  }

  const touristRepo = new TouristRepository()
  const tripRepo     = new TripRepository()
  const checkpointRepo = new CheckpointRepository()

  const tourist = await touristRepo.findById(payload.id)
  if (!tourist || !tourist.is_active) throw Object.assign(new Error(ERRORS.NOT_FOUND), { statusCode: 404 })

  const activeTrip = await tripRepo.findActiveByTouristId(tourist.id)
  const scan = await checkpointRepo.create({ touristId: tourist.id, govtUserId, checkpointName, district })

  logger.info({ touristId: tourist.id, govtUserId, checkpointName }, 'Checkpoint scan recorded')

  return {
    scan: { id: scan.id, checkpointName: scan.checkpoint_name, district: scan.district, scannedAt: scan.scanned_at },
    tourist: {
      id:               tourist.id,
      fullName:         tourist.full_name,
      phone:            tourist.phone,
      bloodGroup:       tourist.blood_group,
      medicalInfo:      tourist.medical_info,
      govtIdType:       tourist.govt_id_type,
      govtIdSuffix:     tourist.govt_id_suffix,
      profilePhotoUrl:  tourist.profile_photo_url,
      emergencyContacts:tourist.emergency_contacts,
    },
    activeTrip: activeTrip ? {
      id: activeTrip.id,
      city: (Array.isArray(activeTrip.stops) ? activeTrip.stops : [])[0]?.city ?? null,
      tsiScore: activeTrip.tsi_score,
      tsiLabel: activeTrip.tsi_label,
    } : null,
  }
}

async function getRecentScans(limit) {
  return new CheckpointRepository().findRecent(limit)
}

module.exports = { getCheckpointQR, scanCheckpoint, getRecentScans }
