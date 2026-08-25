// src/routes/trip.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/trip.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { CreateTripSchema, UpdateTripSchema, UpdateTripStatusSchema, UpdateChecklistSchema, JoinTripSchema } = require('../validators/trip.validator')

// Public route (no auth)
router.get('/public/:token', ctrl.getPublicTrip)

// All below require auth
router.use(authenticateTourist)

router.get('/',            ctrl.getMyTrips)
router.post('/',           validate(CreateTripSchema),        ctrl.createTrip)
router.post('/join',       validate(JoinTripSchema),          ctrl.joinTrip)
router.get('/:id',         ctrl.getTripById)
router.put('/:id',         validate(UpdateTripSchema),        ctrl.updateTrip)
router.patch('/:id/status',    validate(UpdateTripStatusSchema), ctrl.updateTripStatus)
router.patch('/:id/checklist', validate(UpdateChecklistSchema),  ctrl.updateChecklist)
router.post('/:id/invite', ctrl.getInviteCode)
router.get('/:id/members', ctrl.getTripMembers)
router.delete('/:id/leave',ctrl.leaveTrip)
router.get('/:id/news',    ctrl.getTripNews)
router.get('/:id/safety-advisory', ctrl.getSafetyAdvisory)
router.delete('/:id',      ctrl.deleteTrip)

module.exports = router
