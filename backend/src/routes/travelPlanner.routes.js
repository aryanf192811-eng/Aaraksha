// src/routes/travelPlanner.routes.js
'use strict'

const router = require('express').Router()
const ctrl = require('../controllers/travelPlanner.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { BuildJourneySchema, AskFollowUpSchema, CommitJourneySchema } = require('../validators/travelPlanner.validator')

router.use(authenticateTourist)

router.post('/build-journey', validate(BuildJourneySchema), ctrl.buildJourney)
router.post('/ask', validate(AskFollowUpSchema), ctrl.askFollowUp)
router.post('/commit', validate(CommitJourneySchema), ctrl.commitJourney)

module.exports = router
