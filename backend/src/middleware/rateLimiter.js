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

const authLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.authMax,
  message:  { success: false, message: 'Too many login attempts — please try again in 15 minutes.' },
})

// OTP endpoints need tighter limits than general auth
const otpLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      3,               // max 3 OTP requests per 15 min per IP
  message:  { success: false, message: 'Too many OTP requests — wait 15 minutes.' },
  keyGenerator: (req) => `${req.ip}-${req.body?.phone || ''}`,  // per IP + per phone
})

const webhookLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 1000,
  max:      config.rateLimit.webhookMax,
})

module.exports = { generalLimiter, authLimiter, otpLimiter, webhookLimiter }
