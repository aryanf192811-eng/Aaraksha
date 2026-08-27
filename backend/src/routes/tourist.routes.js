// src/routes/tourist.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/tourist.controller')
const dataRightsCtrl = require('../controllers/dataRights.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { z } = require('zod')
const { PhoneSchema } = require('../validators/common.validator')

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
router.get('/guardian/:token',       ctrl.getGuardianView)  // Public — no auth

// DPDP Act 2023 data rights — see services/dataRights.service.js.
router.get('/me/privacy-notice',     authenticateTourist, dataRightsCtrl.getPrivacyNotice)
router.get('/me/data-export',        authenticateTourist, dataRightsCtrl.exportMyData)
router.get('/me/deletion-requests',  authenticateTourist, dataRightsCtrl.getMyDeletionRequests)
router.post('/me/deletion-request',  authenticateTourist, dataRightsCtrl.requestDeletion)

module.exports = router
