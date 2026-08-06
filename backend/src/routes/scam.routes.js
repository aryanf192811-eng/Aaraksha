// src/routes/scam.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/scam.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { CreateScamReportSchema } = require('../validators/scam.validator')
router.get('/:destinationId', ctrl.getByDestination)
router.post('/', authenticateTourist, validate(CreateScamReportSchema), ctrl.createReport)
module.exports = router
