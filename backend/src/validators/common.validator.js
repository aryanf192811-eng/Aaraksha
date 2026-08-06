// src/validators/common.validator.js
'use strict'

const { z } = require('zod')
const { normalizePhone } = require('../utils/crypto')

const UUIDSchema = z.string().uuid({ message: 'Must be a valid UUID' })

// Accepts the same formats normalizePhone() does (9876543210, +919876543210,
// 09876543210) and rejects everything else with a clean 400 — without this,
// non-digit input reaches normalizePhone() downstream, which throws a plain
// Error with no statusCode and surfaces as an unhandled 500.
const PhoneSchema = z.string().min(10).max(15).refine(
  (val) => { try { normalizePhone(val); return true } catch { return false } },
  { message: 'Invalid phone number format' }
)

const UUIDParamSchema = z.object({
  id: UUIDSchema,
})

const PaginationQuerySchema = z.object({
  page:  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1)).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional().default('20'),
})

// Latitude/longitude validation used in multiple schemas
const LatitudeSchema  = z.number().min(-90).max(90)
const LongitudeSchema = z.number().min(-180).max(180)

module.exports = { UUIDSchema, UUIDParamSchema, PaginationQuerySchema, LatitudeSchema, LongitudeSchema, PhoneSchema }
