// src/routes/incident.routes.js — tourist-facing E-FIR filing
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/incident.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { FileIncidentSchema } = require('../validators/incident.validator')

router.use(authenticateTourist)
router.get('/me', ctrl.getMyIncidents)
router.get('/:id', ctrl.getIncident)
router.post('/', validate(FileIncidentSchema), ctrl.fileIncident)

module.exports = router
