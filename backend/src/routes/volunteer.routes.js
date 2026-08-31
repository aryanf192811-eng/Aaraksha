// src/routes/volunteer.routes.js
'use strict'

const router = require('express').Router()
const ctrl = require('../controllers/volunteer.controller')
const messageCtrl = require('../controllers/message.controller')
const { validate } = require('../middleware/validate')
const { authenticateVolunteer } = require('../middleware/auth')
const { createAuthLimiter, createMessageLimiter } = require('../middleware/rateLimiter')
const { UUIDParamSchema } = require('../validators/common.validator')
const { SendMessageSchema } = require('../validators/message.validator')
const {
  RegisterVolunteerSchema, LoginVolunteerSchema,
  UpdateVolunteerStatusSchema, UpdateDispatchStatusSchema, UpdateLocationSchema,
  UpdateAssignmentStatusSchema, VerifyHandoffSchema, ExitAssignmentSchema, UpdateNavigatingStateSchema,
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
router.patch('/me/assignment/navigating', validate(UpdateNavigatingStateSchema), ctrl.updateNavigatingState)
router.post('/me/assignment/verify-handoff', validate(VerifyHandoffSchema), ctrl.verifyHandoff)
router.post('/me/assignment/exit', validate(ExitAssignmentSchema), ctrl.exitAssignment)
router.get('/me/assignment/messages',  messageCtrl.getRescueThreadAsVolunteer)
router.post('/me/assignment/messages', createMessageLimiter(), validate(SendMessageSchema), messageCtrl.sendRescueMessageAsVolunteer)
router.patch('/dispatches/:id/status',
  validate(UUIDParamSchema, 'params'), validate(UpdateDispatchStatusSchema), ctrl.updateDispatchStatus)

module.exports = router
