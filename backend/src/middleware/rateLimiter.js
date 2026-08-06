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
// distinct actions and must not drain one shared counter.
const createOtpLimiter = () => rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      3,               // max 3 OTP requests per 15 min per IP+phone
  message:  { success: false, message: 'Too many OTP requests — wait 15 minutes.' },
  keyGenerator: (req) => `${req.ip}-${req.body?.phone || ''}`,  // per IP + per phone
})

const webhookLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 1000,
  max:      config.rateLimit.webhookMax,
})

module.exports = { generalLimiter, createAuthLimiter, createOtpLimiter, webhookLimiter }
