// src/routes/tourist.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/tourist.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { z } = require('zod')

const UpdateProfileSchema = z.object({
  fullName:          z.string().min(2).max(255).optional(),
  email:             z.string().email().optional(),
  bloodGroup:        z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
  medicalInfo:       z.string().max(1000).optional(),
  emergencyContacts: z.array(z.object({
    id:          z.string().uuid().optional(),
    name:        z.string().min(2).max(100),
    phone:       z.string().min(10).max(15),
    relation:    z.string().min(2).max(50),
    tier:        z.number().int().min(1).max(2).optional().default(1),
    notifyOnSOS: z.boolean().optional().default(true),
  })).max(3).optional(),
  profilePhotoUrl: z.string().url().optional().nullable(),
})

router.get('/me',                    authenticateTourist, ctrl.getMe)
router.patch('/me',                  authenticateTourist, validate(UpdateProfileSchema), ctrl.updateMe)
router.get('/guardian/:token',       ctrl.getGuardianView)  // Public — no auth

module.exports = router
