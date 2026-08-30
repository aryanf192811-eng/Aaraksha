// src/validators/volunteer.validator.js
'use strict'

const { z } = require('zod')
const { GOVT_ID_TYPES, VOLUNTEER_STATUSES, VOLUNTEER_DISPATCH_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const { PhoneSchema, LatitudeSchema, LongitudeSchema } = require('./common.validator')
const { isValidVerhoeff } = require('../utils/verhoeff')

// Same govt ID format check as auth.validator.js's RegisterTouristSchema —
// identity verification for a volunteer uses the identical HMAC-hash
// pattern, so the input shape it validates has to match, including the
// Verhoeff checksum pass on Aadhaar (see that file's comment for why this
// is a real math check, not a claim of live UIDAI verification).
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
    return
  }
  if (type === 'AADHAAR' && !isValidVerhoeff(cleaned)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: ERRORS.GOVTID_CHECKSUM_FAILED })
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

// Govt-provisioned volunteer — same identity fields as self-registration,
// minus `password` (the server generates a one-time credential; see
// govt.service#createVolunteer) since there's no one at a keyboard to pick
// one at account-creation time.
const CreateVolunteerByGovtSchema = z.object({
  fullName:     z.string().min(2).max(255),
  phone:        PhoneSchema,
  govtIdType:   z.enum(Object.values(GOVT_ID_TYPES), { errorMap: () => ({ message: ERRORS.GOVTID_INVALID_TYPE }) }),
  govtIdNumber: z.string().min(8).max(20),
  district:     z.string().min(2).max(100),
  state:        z.string().min(2).max(100),
  latitude:     LatitudeSchema.optional(),
  longitude:    LongitudeSchema.optional(),
  // Optional link to an official rescue_teams unit -- present only when
  // provisioning a team's on-duty responder rather than a citizen
  // volunteer (see volunteer.repository.js#create).
  teamId:       z.string().uuid().optional(),
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

const UpdateLocationSchema = z.object({
  latitude:  LatitudeSchema,
  longitude: LongitudeSchema,
})

// Deliberately excludes RESOLVED — closing an SOS stays a govt-operator
// action (see the comment on RescueRepository#updateAssignmentStatus).
const UpdateAssignmentStatusSchema = z.object({
  status: z.enum(['EN_ROUTE', 'ARRIVED']),
})
const VerifyHandoffSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})
// A reason is required, not optional — this both gives govt something
// real to act on when reassigning and discourages a reflexive "never mind"
// tap for what should be a considered decision.
const ExitAssignmentSchema = z.object({
  reason: z.string().trim().min(5, 'Briefly say why (at least 5 characters)').max(500),
})

module.exports = {
  RegisterVolunteerSchema, LoginVolunteerSchema, CreateVolunteerByGovtSchema,
  UpdateVolunteerStatusSchema, UpdateDispatchStatusSchema, UpdateLocationSchema,
  UpdateAssignmentStatusSchema, VerifyHandoffSchema, ExitAssignmentSchema,
}
