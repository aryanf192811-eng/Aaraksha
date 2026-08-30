// src/routes/sos.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/sos.controller')
const messageCtrl = require('../controllers/message.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { createMessageLimiter } = require('../middleware/rateLimiter')
const { CreateSOSSchema } = require('../validators/sos.validator')
const { SendMessageSchema } = require('../validators/message.validator')

router.use(authenticateTourist)

router.post('/',                  validate(CreateSOSSchema), ctrl.createSOS)
router.get('/mine',               ctrl.getMySOSHistory)
router.get('/active-rescue',      ctrl.getActiveRescueInfo)
router.patch('/:id/false-alarm',  ctrl.markFalseAlarm)
router.get('/:id/handoff-code',              ctrl.getHandoffCode)
router.post('/:id/handoff-code/regenerate',  ctrl.regenerateHandoffCode)

// Tourist <-> Rescuer messaging, scoped to this one active assignment —
// extends the tel: link already on RescueTrackingCard.tsx, not a
// general-purpose thread with a stranger.
router.get('/:id/messages',  messageCtrl.getRescueThreadAsTourist)
router.post('/:id/messages', createMessageLimiter(), validate(SendMessageSchema), messageCtrl.sendRescueMessageAsTourist)

module.exports = router
