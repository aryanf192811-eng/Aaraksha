// src/services/auth.service.js
'use strict'

const jwt = require('jsonwebtoken')
const { v4: uuid } = require('uuid')
const config = require('../config/env')
const logger = require('../utils/logger')
const { TouristRepository } = require('../repositories/tourist.repository')
const { GovtRepository } = require('../repositories/govt.repository')
const { hashPassword, verifyPassword, hashGovtId, generateGuardianToken,
        normalizePhone, extractSuffix } = require('../utils/crypto')
const { computeProfileReadiness } = require('./tourist.service')
const { ERRORS } = require('../constants/errors')

function generateJWT(id, role) {
  return jwt.sign({ id, role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn })
}

async function registerTourist(data) {
  const repo = new TouristRepository()

  const phone = normalizePhone(data.phone)
  const existing = await repo.findByPhone(phone)
  if (existing) throw Object.assign(new Error(ERRORS.PHONE_TAKEN), { statusCode: 409 })

  const govtIdHash = hashGovtId(data.govtIdNumber)
  const govtIdTaken = await repo.govtIdHashExists(govtIdHash)
  if (govtIdTaken) throw Object.assign(new Error(ERRORS.GOVTID_TAKEN), { statusCode: 409 })

  const passwordHash = await hashPassword(data.password)
  const guardianToken = generateGuardianToken()
  const guardianTokenExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days

  const contacts = (data.emergencyContacts || []).map((c, i) => ({
    id:          uuid(),
    name:        c.name,
    phone:       normalizePhone(c.phone),
    relation:    c.relation,
    tier:        c.tier || (i === 0 ? 1 : 2),
    notifyOnSOS: c.notifyOnSOS !== false,
  }))

  const tourist = await repo.create({
    fullName: data.fullName, phone,
    email: data.email || null, bloodGroup: data.bloodGroup || null,
    medicalInfo: data.medicalInfo || null, emergencyContacts: contacts,
    govtIdType: data.govtIdType, govtIdHash,
    govtIdSuffix: extractSuffix(data.govtIdNumber),
    guardianToken, guardianTokenExpires, passwordHash,
  })

  const token = generateJWT(tourist.id, 'tourist')
  logger.info({ touristId: tourist.id }, 'Tourist registered')
  return { tourist: { ...tourist, rescue_readiness_score: computeProfileReadiness(tourist) }, token }
}

async function loginTourist(data) {
  const repo = new TouristRepository()
  const phone = normalizePhone(data.phone)
  const tourist = await repo.findByPhone(phone)

  if (!tourist) throw Object.assign(new Error(ERRORS.INVALID_CREDENTIALS), { statusCode: 401 })
  if (!tourist.is_active) throw Object.assign(new Error(ERRORS.ACCOUNT_INACTIVE), { statusCode: 401 })

  const valid = await verifyPassword(data.password, tourist.password_hash)
  if (!valid) throw Object.assign(new Error(ERRORS.INVALID_CREDENTIALS), { statusCode: 401 })

  const { password_hash, ...safeTourist } = tourist
  const token = generateJWT(tourist.id, 'tourist')
  logger.info({ touristId: tourist.id }, 'Tourist logged in')
  return { tourist: { ...safeTourist, rescue_readiness_score: computeProfileReadiness(safeTourist) }, token }
}

// Provisions a new govt account — called by an authenticated SUPER_ADMIN
// (see auth.routes.js), not a self-signup, so this deliberately does NOT
// issue a session JWT for the new account. The admin doing the
// provisioning stays logged in as themselves; the new officer logs in
// separately with the credentials they're handed.
async function registerGovt(data) {
  const repo = new GovtRepository()
  const existing = await repo.findByEmail(data.email)
  if (existing) throw Object.assign(new Error(ERRORS.EMAIL_TAKEN), { statusCode: 409 })
  const passwordHash = await hashPassword(data.password)
  const user = await repo.create({ ...data, passwordHash })
  logger.info({ govtUserId: user.id, role: data.role }, 'Govt user provisioned')
  return { user }
}

async function loginGovt(data) {
  const repo = new GovtRepository()
  const user = await repo.findByEmail(data.email)
  if (!user) throw Object.assign(new Error(ERRORS.INVALID_CREDENTIALS), { statusCode: 401 })
  if (!user.is_active) throw Object.assign(new Error(ERRORS.ACCOUNT_INACTIVE), { statusCode: 401 })
  const valid = await verifyPassword(data.password, user.password_hash)
  if (!valid) throw Object.assign(new Error(ERRORS.INVALID_CREDENTIALS), { statusCode: 401 })
  const { password_hash, ...safeUser } = user
  const token = generateJWT(user.id, 'govt')
  logger.info({ govtUserId: user.id }, 'Govt user logged in')
  return { user: safeUser, token }
}

module.exports = { registerTourist, loginTourist, registerGovt, loginGovt, generateJWT }
