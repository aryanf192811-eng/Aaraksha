// src/routes/tourist.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/tourist.controller')
const dataRightsCtrl = require('../controllers/dataRights.controller')
const messageCtrl = require('../controllers/message.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { createMessageLimiter, createGuardianViewLimiter, createGuardianPinLimiter } = require('../middleware/rateLimiter')
const { SendMessageSchema } = require('../validators/message.validator')
const { z } = require('zod')
const { PhoneSchema } = require('../validators/common.validator')

const messageLimiter = createMessageLimiter()
const guardianViewLimiter = createGuardianViewLimiter()
const guardianPinLimiter = createGuardianPinLimiter()

const SubmitTrustAppealSchema = z.object({
  message: z.string().trim().min(20, 'Explain your situation (at least 20 characters)').max(1000),
})

const UpdateProfileSchema = z.object({
  fullName:          z.string().min(2).max(255).optional(),
  email:             z.string().email().optional(),
  bloodGroup:        z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
  medicalInfo:       z.string().max(1000).optional(),
  emergencyContacts: z.array(z.object({
    id:          z.string().uuid().optional(),
    name:        z.string().min(2).max(100),
    phone:       PhoneSchema,
    relation:    z.string().min(2).max(50),
    tier:        z.number().int().min(1).max(2).optional().default(1),
    notifyOnSOS: z.boolean().optional().default(true),
  })).max(3).optional(),
  profilePhotoUrl: z.string().url().optional().nullable(),
})

const SendEmergencyContactOTPSchema = z.object({ phone: PhoneSchema })
const VerifyEmergencyContactOTPSchema = z.object({ phone: PhoneSchema, otp: z.string().length(6) })

router.get('/me',                    authenticateTourist, ctrl.getMe)
router.patch('/me',                  authenticateTourist, validate(UpdateProfileSchema), ctrl.updateMe)
router.post('/emergency-contacts/send-otp',   authenticateTourist, validate(SendEmergencyContactOTPSchema),   ctrl.sendEmergencyContactOTP)
router.post('/emergency-contacts/verify-otp', authenticateTourist, validate(VerifyEmergencyContactOTPSchema), ctrl.verifyEmergencyContactOTP)
router.get('/checkpoint-qr',         authenticateTourist, ctrl.getCheckpointQR)
router.get('/guardian/:token',       guardianViewLimiter, guardianPinLimiter, ctrl.getGuardianView)  // Public — no auth

// Tourist <-> Guardian messaging. Guardian side is public — no auth,
// mirrors getGuardianView's own token-in-URL model exactly — but every
// send re-validates the token against guardian_token_expires inside the
// service, same enforcement point getGuardianView already uses.
router.get('/me/guardian-messages',  authenticateTourist, messageCtrl.getGuardianThreadAsTourist)
router.post('/me/guardian-messages', authenticateTourist, messageLimiter, validate(SendMessageSchema), messageCtrl.sendGuardianMessageAsTourist)
router.get('/guardian/:token/messages',  guardianViewLimiter, guardianPinLimiter, messageCtrl.getGuardianThreadAsGuardian)  // Public — no auth
router.post('/guardian/:token/messages', messageLimiter, guardianPinLimiter, validate(SendMessageSchema), messageCtrl.sendGuardianMessageAsGuardian)  // Public — no auth

// DPDP Act 2023 data rights — see services/dataRights.service.js.
router.get('/me/privacy-notice',     authenticateTourist, dataRightsCtrl.getPrivacyNotice)
router.get('/me/data-export',        authenticateTourist, dataRightsCtrl.exportMyData)
router.get('/me/deletion-requests',  authenticateTourist, dataRightsCtrl.getMyDeletionRequests)
router.post('/me/deletion-request',  authenticateTourist, dataRightsCtrl.requestDeletion)

// Trust score never gates this route's own existence -- a restricted
// tourist can always see their status and submit an appeal, same as they
// can always still trigger an SOS.
router.get('/me/trust-status',  authenticateTourist, ctrl.getMyTrustStatus)
router.post('/me/trust-appeal', authenticateTourist, validate(SubmitTrustAppealSchema), ctrl.submitTrustAppeal)

module.exports = router
