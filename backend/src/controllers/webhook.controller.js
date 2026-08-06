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

    // Always respond with TwiML within 5 seconds (Twilio requirement)
    res.set('Content-Type', 'text/xml')
    res.send([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      '  <Message>',
      '    Aaraksha received your SOS.',
      '    Emergency contacts and government rescue teams are being notified.',
      '    Stay safe. Help is coming.',
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
