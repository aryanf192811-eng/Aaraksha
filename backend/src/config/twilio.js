// src/config/twilio.js
// Lazy-init: Twilio client is only created when first needed.
// If credentials missing, returns null — callers check before using.
'use strict'

const config = require('./env')
const logger = require('../utils/logger')

let _client = null

function getTwilioClient() {
  if (!config.twilio.enabled) {
    logger.warn('Twilio not configured — SMS features are in no-op mode')
    return null
  }
  if (!_client) {
    const twilio = require('twilio')
    _client = twilio(config.twilio.accountSid, config.twilio.authToken)
    logger.info('Twilio client initialized')
  }
  return _client
}

module.exports = { getTwilioClient }
