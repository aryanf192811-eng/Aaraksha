// src/validators/sos.validator.js
'use strict'

const { z } = require('zod')
const { SOS_CATEGORIES } = require('../constants/enums')
const { LatitudeSchema, LongitudeSchema } = require('./common.validator')

const CreateSOSSchema = z.object({
  latitude:          LatitudeSchema,
  longitude:         LongitudeSchema,
  category:          z.enum(Object.values(SOS_CATEGORIES)).optional().default('OTHER'),
  message:           z.string().max(1000).optional().nullable(),
  batteryPct:        z.number().int().min(0).max(100).optional().nullable(),
  tripId:            z.string().uuid().optional().nullable(),
  locationAccuracyM: z.number().min(0).optional().nullable(),
  isStaleLocation:   z.boolean().optional().default(false),
})

const FalseAlarmSchema = z.object({})  // No body needed

module.exports = { CreateSOSSchema, FalseAlarmSchema }
