// src/utils/crypto.js
'use strict'

const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const config = require('../config/env')

// Guardian tracking token: 64 bytes = 128 hex chars, URL-safe
function generateGuardianToken() {
  return crypto.randomBytes(64).toString('hex')
}

// Public share token for trips: shorter, URL-safe
function generatePublicToken() {
  return crypto.randomBytes(16).toString('hex')
}

// Guardian PIN: a 4-digit code the tourist shares with a guardian over a
// SEPARATE channel (voice call, in person) from the tracking link itself —
// the point is that anyone who intercepts the link alone (e.g. it gets
// posted publicly) still can't open live tracking without it. Deliberately
// stored in plaintext, not hashed like OTPs: it's meant to be re-displayed
// on the tourist's own profile indefinitely so they can re-share it, not
// a single-use secret — the guardian-view rate limiter (IP-keyed) plus a
// tight per-token PIN-attempt limiter are the actual brute-force defense
// for a 4-digit (10,000-combination) space.
function generateGuardianPin() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0')
}

// Group-trip invite code: short enough to read aloud/type on a second
// phone. Excludes 0/O/1/I — easy to mis-type and mis-read on a small screen.
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateInviteCode(length = 6) {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_CHARS[crypto.randomInt(INVITE_CODE_CHARS.length)]
  }
  return code
}

// One-time credential handed to a volunteer a govt operator provisions
// directly (see govt.service#createVolunteer) — same excluded-character
// set as generateInviteCode (no 0/O/1/I) since an operator reads this
// aloud or writes it down for someone standing in front of them. 12 chars
// clears the account password schema's 8-char minimum with room to spare.
function generateTempPassword(length = 12) {
  let password = ''
  for (let i = 0; i < length; i++) {
    password += INVITE_CODE_CHARS[crypto.randomInt(INVITE_CODE_CHARS.length)]
  }
  return password
}

// Govt ID HMAC-SHA256 with server secret
// NOT bcrypt — we need deterministic lookup to detect duplicate registrations
// AND to add a UNIQUE constraint on the hash column
function hashGovtId(idNumber) {
  return crypto
    .createHmac('sha256', config.security.govtIdSecret)
    .update(idNumber.toUpperCase().replace(/\s|-/g, ''))
    .digest('hex')
}

// Standard bcrypt password hashing
async function hashPassword(password) {
  return bcrypt.hash(password, config.security.bcryptRounds)
}

// Constant-time password verification
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

// Normalize Indian phone numbers to 10-digit string
// Accepts: 9876543210, +919876543210, 09876543210
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  if (digits.length === 10) return digits
  throw new Error('Invalid phone number format')
}

// Get last N characters of a string (for govt ID suffix)
function extractSuffix(str, n = 4) {
  return str.slice(-n).toUpperCase()
}

// Plain (non-HMAC) SHA-256 — for content fingerprints like the Journey
// Passport's integrity hash chain, where the point is reproducibility from
// public record data, not a server-secret-gated lookup (that's what
// hashGovtId's HMAC is for).
function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

module.exports = {
  generateGuardianToken,
  generateGuardianPin,
  generatePublicToken,
  generateInviteCode,
  generateTempPassword,
  hashGovtId,
  hashPassword,
  verifyPassword,
  normalizePhone,
  extractSuffix,
  sha256Hex,
}
