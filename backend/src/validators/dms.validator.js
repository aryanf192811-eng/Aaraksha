// src/validators/dms.validator.js
'use strict'

const { z } = require('zod')
const { DMS_STATUSES } = require('../constants/enums')
const { LatitudeSchema, LongitudeSchema } = require('./common.validator')
const { ERRORS } = require('../constants/errors')

// demoSeconds is a judge-demo-only escape hatch — a real DMS interval below
// 15 minutes would just spam SOS alerts, but a live demo can't wait out a
// real countdown either, so this bypasses intervalMinutes entirely instead
// of lowering its real minimum.
const CreateDMSSchema = z.object({
  intervalMinutes: z.number().int().min(15, ERRORS.DMS_INTERVAL_RANGE).max(480, ERRORS.DMS_INTERVAL_RANGE).optional(),
  demoSeconds:     z.number().int().min(5, ERRORS.DMS_INTERVAL_RANGE).max(120, ERRORS.DMS_INTERVAL_RANGE).optional(),
  tripId:          z.string().uuid().optional().nullable(),
}).refine(d => d.intervalMinutes != null || d.demoSeconds != null, {
  message: ERRORS.DMS_INTERVAL_RANGE, path: ['intervalMinutes'],
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
