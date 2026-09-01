// src/routes/travelPlanner.routes.js
'use strict'

const router = require('express').Router()
const ctrl = require('../controllers/travelPlanner.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const {
  BuildJourneySchema, AskFollowUpSchema, CommitJourneySchema,
  ExtractIntentSchema, AdjustTripSchema, ApplyTripAdjustmentSchema,
} = require('../validators/travelPlanner.validator')

router.use(authenticateTourist)

router.post('/build-journey', validate(BuildJourneySchema), ctrl.buildJourney)
router.post('/ask', validate(AskFollowUpSchema), ctrl.askFollowUp)
router.post('/commit', validate(CommitJourneySchema), ctrl.commitJourney)
router.post('/extract-intent', validate(ExtractIntentSchema), ctrl.extractIntent)
router.post('/trips/:tripId/adjust', validate(AdjustTripSchema), ctrl.adjustTrip)
router.post('/trips/:tripId/apply-adjustment', validate(ApplyTripAdjustmentSchema), ctrl.applyTripAdjustment)

module.exports = router
