// src/routes/volunteer.routes.js
'use strict'

const router = require('express').Router()
const ctrl = require('../controllers/volunteer.controller')
const { validate } = require('../middleware/validate')
const { authenticateVolunteer } = require('../middleware/auth')
const { createAuthLimiter } = require('../middleware/rateLimiter')
const { UUIDParamSchema } = require('../validators/common.validator')
const {
  RegisterVolunteerSchema, LoginVolunteerSchema,
  UpdateVolunteerStatusSchema, UpdateDispatchStatusSchema, UpdateLocationSchema,
  UpdateAssignmentStatusSchema,
} = require('../validators/volunteer.validator')

const registerLimiter = createAuthLimiter(20)
const loginLimiter    = createAuthLimiter()

router.post('/register', registerLimiter, validate(RegisterVolunteerSchema), ctrl.register)
router.post('/login',    loginLimiter,    validate(LoginVolunteerSchema),    ctrl.login)

router.use(authenticateVolunteer)

router.get('/me',                  ctrl.getProfile)
router.patch('/me/status',         validate(UpdateVolunteerStatusSchema), ctrl.updateStatus)
router.get('/me/dispatches',       ctrl.getMyDispatches)
router.get('/me/active-assignment',ctrl.getActiveAssignment)
router.patch('/me/location',       validate(UpdateLocationSchema), ctrl.updateLocation)
router.patch('/me/assignment/status', validate(UpdateAssignmentStatusSchema), ctrl.updateAssignmentStatus)
router.patch('/dispatches/:id/status',
  validate(UUIDParamSchema, 'params'), validate(UpdateDispatchStatusSchema), ctrl.updateDispatchStatus)

module.exports = router
