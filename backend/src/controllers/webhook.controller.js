// src/controllers/webhook.controller.js
'use strict'

const webhookService = require('../services/webhook.service')
const logger = require('../utils/logger')

// POST /api/webhooks/twilio-inbound
// Receives inbound SMS from Twilio — offline SOS from tourists in no-data zones
const twilioInbound = async (req, res, next) => {
  try {
    const { From, Body, MessageSid } = req.body
    logger.info({ from: From, sid: MessageSid, bodyLen: Body?.length }, 'Twilio inbound SMS received')

    // Process asynchronously — respond immediately so Twilio doesn't retry
    webhookService.processInboundSMS(From, Body).catch(err =>
      logger.error({ err: { message: err.message }, from: From }, 'Inbound SMS processing failed')
    )

    // classifyInboundSMS is a cheap synchronous regex test — safe to call
    // before the actual (async) processing above has resolved, so the
    // immediate reply actually matches what was sent instead of always
    // being the SOS-alarm text regardless of message type.
    // UNKNOWN must NOT reuse the SOS reply — that told anyone whose message
    // didn't parse ("just checking in, all is well" doesn't match either
    // pattern) that a real SOS was received and rescue teams were on the
    // way, which was never true. False reassurance about a nonexistent
    // emergency is worse than no reply at all.
    const kind = webhookService.classifyInboundSMS(Body)
    const replyLines = kind === 'CHECKIN'
      ? ['    Aaraksha received your check-in.', '    You\'re marked safe. Any active Dead Man\'s Switch has been reset.']
      : kind === 'SOS'
        ? ['    Aaraksha received your SOS.', '    Emergency contacts and government rescue teams are being notified.', '    Stay safe. Help is coming.']
        : ['    Aaraksha couldn\'t understand that message.', '    Text SAFE to check in, or use the app\'s SOS button for emergencies.']

    // Always respond with TwiML within 5 seconds (Twilio requirement)
    res.set('Content-Type', 'text/xml')
    res.send([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      '  <Message>',
      ...replyLines,
      '  </Message>',
      '</Response>',
    ].join('\n'))
  } catch (err) {
    // Even on crash — return valid TwiML (never 500 to Twilio)
    logger.error({ err: err.message }, 'Webhook handler crash')
    res.set('Content-Type', 'text/xml')
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  }
}

module.exports = { twilioInbound }
