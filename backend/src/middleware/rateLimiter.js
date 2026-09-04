// src/middleware/rateLimiter.js
'use strict'

const rateLimit = require('express-rate-limit')
const config    = require('../config/env')

const limiterDefaults = {
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests — please try again later.' },
}

const generalLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.max,
})

// A factory, not a singleton: each auth-sensitive route (register, login,
// govt login, govt register, reset-password) needs its OWN counter. A single
// shared authLimiter instance means unrelated actions from the same IP drain
// each other's budget — e.g. a few registrations would lock out govt login.
// `max` defaults to the tight brute-force budget (login-style routes); pass
// an override for lower-risk routes like registration, where every attempt
// — including recoverable validation/conflict errors — still counts against
// the same instance's counter, so a too-tight budget locks out legitimate
// multi-try signups, not just abuse.
const createAuthLimiter = (max = config.rateLimit.authMax) => rateLimit({
  ...limiterDefaults,
  windowMs: config.rateLimit.windowMs,
  max,
  message:  { success: false, message: 'Too many login attempts — please try again in 15 minutes.' },
})

// OTP endpoints need tighter limits than general auth. Also a factory —
// forgot-password, verify-otp, resend-otp, and send-verification-otp are
// distinct actions and must not drain one shared counter. Shares the same
// configurable window as the other limiters (was hardcoded to 15 minutes
// here, independent of RATE_LIMIT_WINDOW_MS, which meant relaxing that var
// alone didn't actually relax OTP testing — a real gap this was found and
// fixed to close).
const createOtpLimiter = () => rateLimit({
  ...limiterDefaults,
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.otpMax,
  message:  { success: false, message: 'Too many OTP requests — wait 15 minutes.' },
  keyGenerator: (req) => `${req.ip}-${req.body?.phone || ''}`,  // per IP + per phone
})

const webhookLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 1000,
  max:      config.rateLimit.webhookMax,
})

// Per-conversation, not just per-IP — copies createOtpLimiter's composite
// keyGenerator precedent so one noisy conversation can't drain another
// tourist's messaging budget on the same IP (e.g. a shared govt-office
// connection, or two demo tourists on the same test network). Identifies
// the conversation from whichever route param is present rather than
// requiring the caller to know which thread type it's rate-limiting —
// guardian messaging has no JWT identity to key on otherwise.
const createMessageLimiter = () => rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 1000,
  max:      20,
  message:  { success: false, message: 'Too many messages — please slow down.' },
  keyGenerator: (req) => `${req.ip}-${req.params.sosId || req.params.token || req.tourist?.id || ''}`,
})

// Guardian view/thread endpoints take a bare token in the URL with no
// account behind it to lock out — the only real defense against someone
// enumerating tokens is throttling by IP. Deliberately keyed on IP alone,
// NOT IP+token like createMessageLimiter/createOtpLimiter: composite keying
// would give every guessed token its own fresh budget, which stops nothing.
// max is sized well above one legitimate guardian's own 30s auto-refresh
// poll (≈30 requests/15min) so a real family member is never rate-limited,
// while a rapid multi-token guessing pass still trips it fast.
const createGuardianViewLimiter = () => rateLimit({
  ...limiterDefaults,
  windowMs: config.rateLimit.windowMs,
  max:      80,
  message:  { success: false, message: 'Too many requests — please try again later.' },
  keyGenerator: (req) => req.ip,
})

// A 4-digit PIN is only a 10,000-value space — this is the actual
// brute-force defense for it, separate from createGuardianViewLimiter's
// broader enumeration throttle above. Keyed by IP+token (like
// createOtpLimiter/createMessageLimiter) so guessing one traveler's PIN
// doesn't burn another traveler's budget on a shared IP, and
// skipSuccessfulRequests means a guardian who already knows the right PIN
// never gets throttled by their own legitimate 30s auto-refresh polling —
// only wrong-PIN attempts count against the window.
const createGuardianPinLimiter = () => rateLimit({
  ...limiterDefaults,
  windowMs: config.rateLimit.windowMs,
  max:      8,
  skipSuccessfulRequests: true,
  message:  { success: false, message: 'Too many incorrect PIN attempts — please try again later.' },
  keyGenerator: (req) => `${req.ip}-${req.params.token}`,
})

module.exports = { generalLimiter, createAuthLimiter, createOtpLimiter, webhookLimiter, createMessageLimiter, createGuardianViewLimiter, createGuardianPinLimiter }
