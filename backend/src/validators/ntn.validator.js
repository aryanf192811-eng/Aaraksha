// src/validators/ntn.validator.js
'use strict'

const { z } = require('zod')
const { SOS_CATEGORIES, NTN_SCENARIOS } = require('../constants/enums')
const { LatitudeSchema, LongitudeSchema } = require('./common.validator')

// Same SOS-payload fields as CreateSOSSchema (sos.validator.js) — an NTN
// uplink carries the same information a POST /api/sos would, just over a
// different simulated transport.
const NTNUplinkSchema = z.object({
  scenario:          z.enum(Object.values(NTN_SCENARIOS)).optional().default(NTN_SCENARIOS.CLEAR_SKY),
  latitude:          LatitudeSchema,
  longitude:         LongitudeSchema,
  category:          z.enum(Object.values(SOS_CATEGORIES)).optional().default('OTHER'),
  message:           z.string().max(1000).optional().nullable(),
  batteryPct:        z.number().int().min(0).max(100).optional().nullable(),
  tripId:            z.string().uuid().optional().nullable(),
  locationAccuracyM: z.number().min(0).optional().nullable(),
  isStaleLocation:   z.boolean().optional().default(false),
})

const NTNStatusQuerySchema = z.object({
  scenario: z.enum(Object.values(NTN_SCENARIOS)).optional().default(NTN_SCENARIOS.CLEAR_SKY),
})

module.exports = { NTNUplinkSchema, NTNStatusQuerySchema }
