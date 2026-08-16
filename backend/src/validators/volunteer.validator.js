// src/validators/volunteer.validator.js
'use strict'

const { z } = require('zod')
const { GOVT_ID_TYPES, VOLUNTEER_STATUSES, VOLUNTEER_DISPATCH_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const { PhoneSchema, LatitudeSchema, LongitudeSchema } = require('./common.validator')

// Same govt ID format check as auth.validator.js's RegisterTouristSchema —
// identity verification for a volunteer uses the identical HMAC-hash
// pattern, so the input shape it validates has to match.
const govtIdNumberRefinement = (type) => (num, ctx) => {
  const cleaned = num.toUpperCase().replace(/\s|-/g, '')
  const patterns = {
    AADHAAR:         /^\d{12}$/,
    PASSPORT:        /^[A-Z]\d{7}$/,
    VOTER_ID:        /^[A-Z]{3}\d{7}$/,
    DRIVING_LICENSE: /^[A-Z0-9]{8,20}$/,
  }
  if (type && patterns[type] && !patterns[type].test(cleaned)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: ERRORS.GOVTID_INVALID_FORMAT })
  }
}

const RegisterVolunteerSchema = z.object({
  fullName:     z.string().min(2).max(255),
  phone:        PhoneSchema,
  password:     z.string().min(8).max(128),
  govtIdType:   z.enum(Object.values(GOVT_ID_TYPES), { errorMap: () => ({ message: ERRORS.GOVTID_INVALID_TYPE }) }),
  govtIdNumber: z.string().min(8).max(20),
  district:     z.string().min(2).max(100),
  state:        z.string().min(2).max(100),
  latitude:     LatitudeSchema.optional(),
  longitude:    LongitudeSchema.optional(),
}).superRefine((data, ctx) => {
  govtIdNumberRefinement(data.govtIdType)(data.govtIdNumber, ctx)
})

const LoginVolunteerSchema = z.object({
  phone:    PhoneSchema,
  password: z.string().min(1),
})

const UpdateVolunteerStatusSchema = z.object({
  status:    z.enum(Object.values(VOLUNTEER_STATUSES)),
  latitude:  LatitudeSchema.optional(),
  longitude: LongitudeSchema.optional(),
})

// ALERTED is server-only (set at dispatch creation) — a volunteer can only
// move a dispatch forward to one of these three from the app.
const UpdateDispatchStatusSchema = z.object({
  status: z.enum([
    VOLUNTEER_DISPATCH_STATUSES.RESPONDED,
    VOLUNTEER_DISPATCH_STATUSES.COMPLETED,
    VOLUNTEER_DISPATCH_STATUSES.DECLINED,
  ]),
})

module.exports = {
  RegisterVolunteerSchema, LoginVolunteerSchema,
  UpdateVolunteerStatusSchema, UpdateDispatchStatusSchema,
}
