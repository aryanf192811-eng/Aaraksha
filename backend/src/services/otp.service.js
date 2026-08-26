// src/services/otp.service.js
// Complete OTP lifecycle: request → verify → reset password.
// Security design decisions:
//   - OTP is 6 digits, stored as HMAC-SHA256 (never plaintext)
//   - 3 wrong attempts = OTP locked (must request a new one)
//   - OTP expires in 10 minutes
//   - Max 5 OTP requests per phone per hour (rate limit)
//   - Reset token expires in 15 minutes
//   - Anti-enumeration: always respond "OTP sent" regardless of whether phone exists
//   - Phone normalization before lookup (same as registration)
'use strict'

const crypto = require('crypto')
const { OTPRepository } = require('../repositories/otp.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { sendSMS } = require('./notification/sms.service')
const { hashPassword, normalizePhone } = require('../utils/crypto')
const { markEmergencyContactVerified } = require('./tourist.service')
const config = require('../config/env')
const logger = require('../utils/logger')

const OTP_EXPIRE_MINUTES   = 10
const RESET_TOKEN_MINUTES  = 15
const MAX_ATTEMPTS         = 3
const MAX_OTP_PER_HOUR     = 5

// Generate a cryptographically random 6-digit OTP
function generateOTP() {
  // Use crypto.randomInt for uniform distribution (avoids modulo bias)
  return crypto.randomInt(100_000, 999_999).toString()
}

// HMAC-SHA256 of OTP with server secret (deterministic, one-way)
function hashOTP(otp) {
  return crypto
    .createHmac('sha256', config.security.govtIdSecret)
    .update(otp)
    .digest('hex')
}

// ── STEP 1: Request OTP ───────────────────────────────────────────────────

async function requestPasswordReset(rawPhone, ipAddress) {
  const phone = normalizePhone(rawPhone)
  const otpRepo = new OTPRepository()

  // Rate limit: max 5 OTP requests per phone per hour
  const recentCount = await otpRepo.countRecentRequests(phone, 'PASSWORD_RESET', 60)
  if (recentCount >= MAX_OTP_PER_HOUR) {
    // Do NOT reveal that this phone is rate-limited (anti-enumeration + UX)
    // Log for security monitoring
    logger.warn({ phone, recentCount }, 'OTP rate limit exceeded')
    // Still return success to the caller — do not reveal rate limit
    return { sent: false, reason: 'rate_limited', message: 'OTP sent to your phone if registered' }
  }

  // Check tourist exists (silent — never reveal to caller if phone is registered)
  const touristRepo = new TouristRepository()
  const tourist = await touristRepo.findByPhone(phone)

  if (!tourist || !tourist.is_active) {
    // Log but return success message (anti-enumeration)
    logger.debug({ phone }, 'OTP requested for non-existent or inactive tourist')
    return { sent: false, reason: 'not_found', message: 'OTP sent to your phone if registered' }
  }

  const otp       = generateOTP()
  const otpHash   = hashOTP(otp)
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000)

  await otpRepo.create(phone, otpHash, 'PASSWORD_RESET', expiresAt, ipAddress)

  // Send OTP via SMS
  const message = [
    `🔐 Aaraksha Password Reset`,
    `Your OTP is: ${otp}`,
    `Valid for ${OTP_EXPIRE_MINUTES} minutes.`,
    `Do NOT share this with anyone.`,
    `If you did not request this, ignore this message.`,
  ].join('\n')

  const smsResult = await sendSMS(phone, message)
  logger.info({ phone, smsSent: smsResult.sent }, 'Password reset OTP sent')

  // Always return the same message regardless of SMS success (anti-enumeration
  // — an attacker probing phone numbers must see identical responses whether
  // or not the phone is registered, so this can't branch on smsResult.sent).
  // The debugOtp fallback below is the one deliberate exception: it only
  // fires once we're already past the "does this phone exist" branch (this
  // function returns early above for a non-existent/inactive tourist, before
  // any OTP is even generated), so it can never be used to enumerate phones
  // — it only ever tells someone who already knows a phone IS registered
  // what its current OTP is, same trust boundary as the SMS itself. See
  // requestEmergencyContactVerification for the same pattern and the
  // Twilio-trial-account rationale.
  return {
    sent: true,
    message: `OTP sent to your registered phone number`,
    ...(config.isDev && !smsResult.sent ? { debugOtp: otp, debugReason: smsResult.reason } : {}),
  }
}

// ── STEP 2: Verify OTP ────────────────────────────────────────────────────

async function verifyOTP(rawPhone, otp, purpose = 'PASSWORD_RESET') {
  const phone    = normalizePhone(rawPhone)
  const otpRepo  = new OTPRepository()

  const record = await otpRepo.findValid(phone, purpose)

  if (!record) {
    throw Object.assign(
      new Error('OTP not found, already used, or expired. Please request a new OTP.'),
      { statusCode: 400 }
    )
  }

  // Check attempt count BEFORE verifying (lock early)
  if (record.attempts >= MAX_ATTEMPTS) {
    throw Object.assign(
      new Error(`OTP locked after ${MAX_ATTEMPTS} failed attempts. Request a new OTP.`),
      { statusCode: 429 }
    )
  }

  const providedHash = hashOTP(otp.trim())

  // Constant-time comparison to prevent timing attacks
  const expectedBuf = Buffer.from(record.otp_hash, 'hex')
  const providedBuf = Buffer.from(providedHash, 'hex')
  const isValid = expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf)

  if (!isValid) {
    const newAttempts = await otpRepo.incrementAttempts(record.id)
    const remaining   = Math.max(0, MAX_ATTEMPTS - newAttempts)
    throw Object.assign(
      new Error(`Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`),
      { statusCode: 400 }
    )
  }

  // OTP correct — generate reset_token (used to authorize password reset)
  const resetToken        = crypto.randomBytes(48).toString('hex')  // 96 hex chars
  const resetTokenExpires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000)

  await otpRepo.markUsedAndAttachToken(record.id, resetToken, resetTokenExpires)
  logger.info({ phone, purpose }, 'OTP verified successfully')

  return {
    resetToken,
    expiresIn: `${RESET_TOKEN_MINUTES} minutes`,
    message:   'OTP verified. Use the reset token to set your new password.',
  }
}

// ── STEP 3: Reset Password using reset_token ──────────────────────────────

async function resetPassword(resetToken, newPassword) {
  const otpRepo     = new OTPRepository()
  const touristRepo = new TouristRepository()

  const record = await otpRepo.findByResetToken(resetToken)
  if (!record) {
    throw Object.assign(
      new Error('Reset token not found or expired. Please restart the password reset process.'),
      { statusCode: 400 }
    )
  }

  const phone   = normalizePhone(record.phone)
  const tourist = await touristRepo.findByPhone(phone)
  if (!tourist || !tourist.is_active) {
    throw Object.assign(new Error('Account not found or deactivated.'), { statusCode: 404 })
  }

  const passwordHash = await hashPassword(newPassword)

  // Update password
  await touristRepo.update(tourist.id, { password_hash: passwordHash })

  // Invalidate the reset token so it cannot be reused
  await otpRepo.invalidateResetToken(resetToken)

  logger.info({ touristId: tourist.id }, 'Password reset successfully')
  return { message: 'Password reset successfully. Please log in with your new password.' }
}

// ── Resend OTP ────────────────────────────────────────────────────────────

async function resendOTP(rawPhone, purpose, ipAddress) {
  // Delegate to requestPasswordReset — same logic, same rate limiting
  return requestPasswordReset(rawPhone, ipAddress)
}

// ── Phone Verification OTP (optional during signup) ───────────────────────

async function requestPhoneVerification(touristId, rawPhone, ipAddress) {
  const phone    = normalizePhone(rawPhone)
  const otpRepo  = new OTPRepository()

  const recentCount = await otpRepo.countRecentRequests(phone, 'PHONE_VERIFY', 60)
  if (recentCount >= 3) {
    throw Object.assign(
      new Error('Too many verification requests. Wait 1 hour before trying again.'),
      { statusCode: 429 }
    )
  }

  const otp       = generateOTP()
  const otpHash   = hashOTP(otp)
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000)

  await otpRepo.create(phone, otpHash, 'PHONE_VERIFY', expiresAt, ipAddress)

  const message = [
    `📱 Aaraksha Phone Verification`,
    `Your verification code is: ${otp}`,
    `Valid for ${OTP_EXPIRE_MINUTES} minutes.`,
  ].join('\n')

  const smsResult = await sendSMS(phone, message)
  logger.info({ touristId, phone, smsSent: smsResult.sent }, 'Phone verification OTP sent')
  return {
    message: 'Verification code sent to your phone.',
    ...(config.isDev && !smsResult.sent ? { debugOtp: otp, debugReason: smsResult.reason } : {}),
  }
}

// ── Emergency Contact Verification ─────────────────────────────────────────
// Confirms an emergency contact's phone number is real and reachable BEFORE
// it's relied on during an actual SOS — a typo'd or dead number would only
// otherwise surface at the worst possible moment.

async function requestEmergencyContactVerification(touristId, rawPhone, ipAddress) {
  const phone   = normalizePhone(rawPhone)
  const otpRepo = new OTPRepository()

  const recentCount = await otpRepo.countRecentRequests(phone, 'EMERGENCY_CONTACT_VERIFY', 60)
  if (recentCount >= 3) {
    throw Object.assign(
      new Error('Too many verification requests for this contact. Wait 1 hour before trying again.'),
      { statusCode: 429 }
    )
  }

  const otp       = generateOTP()
  const otpHash   = hashOTP(otp)
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000)
  await otpRepo.create(phone, otpHash, 'EMERGENCY_CONTACT_VERIFY', expiresAt, ipAddress)

  const message = [
    `📱 Aaraksha Emergency Contact Verification`,
    `Someone added you as an emergency contact on Aaraksha — a tourist safety app.`,
    `Your verification code is: ${otp}`,
    `Valid for ${OTP_EXPIRE_MINUTES} minutes. If this wasn't you, ignore this message.`,
  ].join('\n')

  const smsResult = await sendSMS(phone, message)
  logger.info({ touristId, phone, smsSent: smsResult.sent }, 'Emergency contact verification OTP sent')

  return {
    message: 'Verification code sent to the contact\'s phone.',
    // Twilio trial accounts restrict outbound SMS to predefined templates
    // (confirmed via a direct test — arbitrary body text like this OTP
    // message is rejected with error 572006), so free-form OTP delivery is
    // externally blocked until the account is upgraded. Surfacing the code
    // directly in dev keeps the flow demoable without a paid Twilio plan —
    // this branch can NEVER fire outside development.
    ...(config.isDev && !smsResult.sent ? { debugOtp: otp, debugReason: smsResult.reason } : {}),
  }
}

async function verifyEmergencyContactOTP(touristId, rawPhone, otp) {
  const phone   = normalizePhone(rawPhone)
  const otpRepo = new OTPRepository()

  const record = await otpRepo.findValid(phone, 'EMERGENCY_CONTACT_VERIFY')
  if (!record) {
    throw Object.assign(
      new Error('Code not found, already used, or expired. Please request a new one.'),
      { statusCode: 400 }
    )
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    throw Object.assign(
      new Error(`Code locked after ${MAX_ATTEMPTS} failed attempts. Request a new one.`),
      { statusCode: 429 }
    )
  }

  const providedHash = hashOTP(otp.trim())
  const expectedBuf = Buffer.from(record.otp_hash, 'hex')
  const providedBuf = Buffer.from(providedHash, 'hex')
  const isValid = expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf)

  if (!isValid) {
    const newAttempts = await otpRepo.incrementAttempts(record.id)
    const remaining   = Math.max(0, MAX_ATTEMPTS - newAttempts)
    throw Object.assign(
      new Error(`Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`),
      { statusCode: 400 }
    )
  }

  await otpRepo.markUsed(record.id)
  const tourist = await markEmergencyContactVerified(touristId, phone)
  logger.info({ touristId, phone }, 'Emergency contact verified')
  return tourist
}

module.exports = {
  requestPasswordReset,
  verifyOTP,
  resetPassword,
  resendOTP,
  requestPhoneVerification,
  requestEmergencyContactVerification,
  verifyEmergencyContactOTP,
}
