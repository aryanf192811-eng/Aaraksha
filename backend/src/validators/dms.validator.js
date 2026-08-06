// src/validators/dms.validator.js
'use strict'

const { z } = require('zod')
const { DMS_STATUSES } = require('../constants/enums')
const { LatitudeSchema, LongitudeSchema } = require('./common.validator')
const { ERRORS } = require('../constants/errors')

const CreateDMSSchema = z.object({
  intervalMinutes: z.number().int().min(15, ERRORS.DMS_INTERVAL_RANGE).max(480, ERRORS.DMS_INTERVAL_RANGE),
  tripId:          z.string().uuid().optional().nullable(),
})

const ResetDMSSchema = z.object({
  latitude:   LatitudeSchema.optional().nullable(),
  longitude:  LongitudeSchema.optional().nullable(),
  batteryPct: z.number().int().min(0).max(100).optional().nullable(),
  message:    z.string().max(500).optional().nullable(),
})

const UpdateDMSStatusSchema = z.object({
  status: z.enum([DMS_STATUSES.PAUSED, DMS_STATUSES.RESOLVED]),
})

module.exports = { CreateDMSSchema, ResetDMSSchema, UpdateDMSStatusSchema }
