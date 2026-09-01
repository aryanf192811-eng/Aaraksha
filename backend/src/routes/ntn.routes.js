// src/routes/ntn.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/ntn.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { NTNUplinkSchema, NTNStatusQuerySchema } = require('../validators/ntn.validator')

router.use(authenticateTourist)

router.get('/status', validate(NTNStatusQuerySchema, 'query'), ctrl.getStatus)
router.post('/uplink', validate(NTNUplinkSchema), ctrl.uplink)

module.exports = router
