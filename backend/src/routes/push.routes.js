// src/routes/push.routes.js
'use strict'

const router = require('express').Router()
const ctrl = require('../controllers/push.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { SubscribeSchema, UnsubscribeSchema } = require('../validators/push.validator')

// Public — the VAPID public key is not secret, it's embedded in the subscribe request
router.get('/vapid-public-key', ctrl.getPublicKey)

router.use(authenticateTourist)
router.post('/subscribe',   validate(SubscribeSchema),   ctrl.subscribe)
router.delete('/subscribe', validate(UnsubscribeSchema), ctrl.unsubscribe)

module.exports = router
