// src/services/notification/sms.service.js
// Single-responsibility: send one SMS via Twilio.
// NEVER throws — callers fire-and-forget.
'use strict'

const { getTwilioClient } = require('../../config/twilio')
const config = require('../../config/env')
const logger = require('../../utils/logger')

async function sendSMS(toPhone, message) {
  const client = getTwilioClient()
  if (!client) {
    logger.debug({ toPhone }, 'SMS skipped — Twilio not configured')
    return { sent: false, reason: 'Twilio not configured' }
  }

  // Ensure E.164 format
  const to = toPhone.startsWith('+') ? toPhone : `+91${toPhone}`

  try {
    const msg = await client.messages.create({
      body: message,
      from: config.twilio.fromNumber,
      to,
    })
    logger.info({ sid: msg.sid, to }, 'SMS sent successfully')
    return { sent: true, sid: msg.sid }
  } catch (err) {
    // Log but never throw — SMS failure must not block SOS response
    logger.error({ err: { message: err.message, code: err.code }, to }, 'Twilio SMS failed')
    return { sent: false, reason: err.message }
  }
}

module.exports = { sendSMS }
