// src/validators/checkin.validator.js
'use strict'

const { z } = require('zod')
const { LatitudeSchema, LongitudeSchema } = require('./common.validator')

const CreateCheckinSchema = z.object({
  latitude:   LatitudeSchema,
  longitude:  LongitudeSchema,
  batteryPct: z.number().int().min(0).max(100).optional().nullable(),
  message:    z.string().max(500).optional().nullable(),
  tripId:     z.string().uuid().optional().nullable(),
  dmsId:      z.string().uuid().optional().nullable(),
  accuracyM:  z.number().min(0).optional().nullable(),
})

module.exports = { CreateCheckinSchema }
