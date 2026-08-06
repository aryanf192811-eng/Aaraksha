// src/validators/auth.validator.js
'use strict'

const { z } = require('zod')
const { GOVT_ID_TYPES, GOVT_ROLES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const { PhoneSchema } = require('./common.validator')

// Govt ID number format validator
const govtIdNumberRefinement = (type) => (num, ctx) => {
  const cleaned = num.toUpperCase().replace(/\s|-/g, '')
  const patterns = {
    AADHAAR:         /^\d{12}$/,
    PASSPORT:        /^[A-Z]\d{7}$/,
    VOTER_ID:        /^[A-Z]{3}\d{7}$/,
    DRIVING_LICENSE: /^[A-Z0-9]{8,20}$/,
  }
  if (type && patterns[type] && !patterns[type].test(cleaned)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: ERRORS.GOVTID_INVALID_FORMAT,
    })
  }
}

const EmergencyContactSchema = z.object({
  name:        z.string().min(2).max(100),
  phone:       PhoneSchema,
  relation:    z.string().min(2).max(50),
  tier:        z.number().int().min(1).max(2).optional().default(1),
  notifyOnSOS: z.boolean().optional().default(true),
})

const RegisterTouristSchema = z.object({
  fullName:          z.string().min(2).max(255),
  phone:             PhoneSchema,
  email:             z.string().email().optional(),
  bloodGroup:        z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
  medicalInfo:       z.string().max(1000).optional(),
  emergencyContacts: z.array(EmergencyContactSchema)
                      .min(1, 'At least one emergency contact is required')
                      .max(3, 'Maximum 3 emergency contacts allowed'),
  govtIdType:        z.enum(Object.values(GOVT_ID_TYPES), { errorMap: () => ({ message: ERRORS.GOVTID_INVALID_TYPE }) }),
  govtIdNumber:      z.string().min(8).max(20),
  password:          z.string().min(8).max(128),
}).superRefine((data, ctx) => {
  govtIdNumberRefinement(data.govtIdType)(data.govtIdNumber, ctx)
})

const LoginTouristSchema = z.object({
  phone:    PhoneSchema,
  password: z.string().min(1),
})

const RegisterGovtSchema = z.object({
  name:     z.string().min(2).max(255),
  email:    z.string().email(),
  password: z.string().min(8).max(128),
  role:     z.enum(Object.values(GOVT_ROLES)).optional().default('TOURISM_OFFICER'),
  district: z.string().max(100).optional(),
  state:    z.string().max(100).optional(),
})

const LoginGovtSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

const ForgotPasswordSchema = z.object({
  phone: PhoneSchema,
})

const VerifyOTPSchema = z.object({
  phone:   PhoneSchema,
  otp:     z.string().length(6).regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  purpose: z.enum(['PASSWORD_RESET', 'PHONE_VERIFY']).optional().default('PASSWORD_RESET'),
})

const ResetPasswordSchema = z.object({
  resetToken:  z.string().min(64).max(128),
  newPassword: z.string().min(8).max(128),
})

const ResendOTPSchema = z.object({
  phone:   PhoneSchema,
  purpose: z.enum(['PASSWORD_RESET', 'PHONE_VERIFY']).optional().default('PASSWORD_RESET'),
})

module.exports = {
  RegisterTouristSchema, LoginTouristSchema, RegisterGovtSchema, LoginGovtSchema,
  ForgotPasswordSchema, VerifyOTPSchema, ResetPasswordSchema, ResendOTPSchema,
}
