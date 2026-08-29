// src/middleware/verifyTwilioSignature.js
// Twilio signs every inbound webhook request with an X-Twilio-Signature
// header (HMAC-SHA1 of the full URL + sorted POST params, keyed by the
// account's auth token) — verifying it is the ONLY thing standing between
// this endpoint and anyone who can reach it and knows/guesses a tourist's
// UUID being able to forge a real SOS or a false "SAFE" check-in (which
// would silently reset an active Dead Man's Switch). Found unimplemented
// during Phase 9's security audit — webhookLimiter (rate limiting) was the
// only protection this route had.
'use strict'

const twilio = require('twilio')
const config = require('../config/env')
const logger = require('../utils/logger')

function verifyTwilioSignature(req, res, next) {
  // No real Twilio account configured (local/demo mode without credentials,
  // per config/twilio.js's existing graceful-degradation pattern) — nothing
  // to verify against, and no real Twilio traffic will ever reach this
  // endpoint in that mode. Skip rather than hard-fail startup or every request.
  if (!config.twilio.enabled) return next()

  const signature = req.headers['x-twilio-signature']
  // req.protocol reflects the real scheme behind Render's proxy because
  // app.js already sets `trust proxy` — without that this would see
  // 'http' even when the actual public request was 'https' and every
  // signature would fail to validate.
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`

  const valid = signature && twilio.validateRequest(config.twilio.authToken, signature, url, req.body)

  if (!valid) {
    logger.warn({ from: req.body?.From, url }, 'Twilio inbound signature verification failed — request rejected')
    // Reply with valid empty TwiML rather than a 4xx — matches the
    // controller's own "never give Twilio (or anyone) a reason to learn
    // what a correct signature looks like via distinct error responses"
    // posture, and avoids an error-driven retry storm on a real
    // misconfiguration (e.g. TWILIO_AUTH_TOKEN rotated).
    res.set('Content-Type', 'text/xml')
    return res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  }

  next()
}

module.exports = { verifyTwilioSignature }
