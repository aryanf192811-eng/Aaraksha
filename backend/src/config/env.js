// src/config/env.js
// Called once at startup. Throws if any required var is missing.
// Exports a typed config object — use this instead of process.env directly.
'use strict'

require('dotenv').config()

function requireEnv(key) {
  const val = process.env[key]
  if (!val || val.trim() === '') {
    throw new Error(`[ENV] Required environment variable "${key}" is missing or empty.\n    Set it in .env and run: node scripts/preflight.js`)
  }
  return val.trim()
}

function optionalEnv(key, defaultVal = null) {
  return process.env[key]?.trim() || defaultVal
}

const config = {
  // Core
  nodeEnv:     requireEnv('NODE_ENV'),
  port:        parseInt(optionalEnv('PORT', '5000'), 10),
  isDev:       process.env.NODE_ENV === 'development',
  isProd:      process.env.NODE_ENV === 'production',

  // Database
  db: {
    url:                requireEnv('DATABASE_URL'),
    testUrl:            optionalEnv('DATABASE_TEST_URL'),
    maxConnections:     parseInt(optionalEnv('DATABASE_MAX_CONNECTIONS', '20'), 10),
    idleTimeoutMs:      parseInt(optionalEnv('DATABASE_IDLE_TIMEOUT_MS', '30000'), 10),
    connectionTimeoutMs:parseInt(optionalEnv('DATABASE_CONNECTION_TIMEOUT_MS', '2000'), 10),
  },

  // CORS — frontend origins. volunteerUrl is optional (not required) so an
  // existing .env from before the volunteer portal existed doesn't fail
  // startup — falls back to the dev localhost allowlist in cors.js.
  cors: {
    touristUrl:   requireEnv('TOURIST_FRONTEND_URL'),
    govtUrl:      requireEnv('GOVT_FRONTEND_URL'),
    guardianUrl:  requireEnv('GUARDIAN_FRONTEND_URL'),
    volunteerUrl: optionalEnv('VOLUNTEER_FRONTEND_URL'),
  },

  // JWT
  jwt: {
    secret:    requireEnv('JWT_SECRET'),
    expiresIn: optionalEnv('JWT_EXPIRES_IN', '24h'),
  },

  // Security
  security: {
    bcryptRounds: parseInt(optionalEnv('BCRYPT_ROUNDS', '12'), 10),
    govtIdSecret: requireEnv('GOVT_ID_SECRET'),
    guardianSecret: requireEnv('GUARDIAN_SECRET'),
  },

  // Rate limiting
  rateLimit: {
    windowMs:        parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max:             parseInt(optionalEnv('RATE_LIMIT_MAX', '100'), 10),
    authMax:         parseInt(optionalEnv('AUTH_RATE_LIMIT_MAX', '5'), 10),
    webhookMax:      parseInt(optionalEnv('WEBHOOK_RATE_LIMIT_MAX', '1000'), 10),
  },

  // Twilio (optional — graceful fallback if missing)
  twilio: {
    accountSid:       optionalEnv('TWILIO_ACCOUNT_SID'),
    authToken:        optionalEnv('TWILIO_AUTH_TOKEN'),
    fromNumber:       optionalEnv('TWILIO_FROM_NUMBER'),
    emergencyNumber:  optionalEnv('TWILIO_EMERGENCY_NUMBER'),
    enabled:          !!(optionalEnv('TWILIO_ACCOUNT_SID') && optionalEnv('TWILIO_AUTH_TOKEN')),
  },

  // Gemini (optional — fallback packing list if missing)
  gemini: {
    apiKey:  optionalEnv('GEMINI_API_KEY'),
    model:   optionalEnv('GEMINI_MODEL', 'gemini-1.5-flash'),
    enabled: !!optionalEnv('GEMINI_API_KEY'),
  },

  // OpenWeatherMap (optional — TSI weather factor disabled if missing)
  owm: {
    apiKey:        optionalEnv('OWM_API_KEY'),
    baseUrl:       optionalEnv('OWM_BASE_URL', 'https://api.openweathermap.org/data/2.5'),
    cacheTtlMins:  parseInt(optionalEnv('OWM_CACHE_TTL_MINUTES', '60'), 10),
    enabled:       !!optionalEnv('OWM_API_KEY'),
  },

  // Logging
  log: {
    level: optionalEnv('LOG_LEVEL', 'info'),
  },

  // Web Push (optional — push notifications silently no-op if missing)
  vapid: {
    publicKey:  optionalEnv('VAPID_PUBLIC_KEY'),
    privateKey: optionalEnv('VAPID_PRIVATE_KEY'),
    subject:    optionalEnv('VAPID_SUBJECT', 'mailto:aaraksha@example.com'),
    enabled:    !!(optionalEnv('VAPID_PUBLIC_KEY') && optionalEnv('VAPID_PRIVATE_KEY')),
  },
}

module.exports = config
