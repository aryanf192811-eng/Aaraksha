// src/routes/sos.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/sos.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { CreateSOSSchema } = require('../validators/sos.validator')

router.use(authenticateTourist)

router.post('/',                  validate(CreateSOSSchema), ctrl.createSOS)
router.get('/mine',               ctrl.getMySOSHistory)
router.get('/active-rescue',      ctrl.getActiveRescueInfo)
router.patch('/:id/false-alarm',  ctrl.markFalseAlarm)

module.exports = router
