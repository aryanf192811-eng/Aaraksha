// src/routes/webhook.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/webhook.controller')
const { verifyTwilioSignature } = require('../middleware/verifyTwilioSignature')
// Twilio sends application/x-www-form-urlencoded — already handled by express.urlencoded in app.js
router.post('/twilio-inbound', verifyTwilioSignature, ctrl.twilioInbound)
module.exports = router
