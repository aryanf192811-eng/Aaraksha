// src/routes/incident.routes.js — tourist-facing E-FIR filing
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/incident.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { uploadIncidentPhoto } = require('../config/upload')
const { FileIncidentSchema } = require('../validators/incident.validator')

router.use(authenticateTourist)
router.get('/me', ctrl.getMyIncidents)
router.get('/:id', ctrl.getIncident)
// Photo is optional — uploadIncidentPhoto still runs (multer populates
// req.body's other fields from the multipart form either way), it just
// leaves req.file undefined when no photo was attached.
router.post('/', uploadIncidentPhoto, validate(FileIncidentSchema), ctrl.fileIncident)

module.exports = router
