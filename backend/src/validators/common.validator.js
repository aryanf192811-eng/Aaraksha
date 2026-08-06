// src/validators/common.validator.js
'use strict'

const { z } = require('zod')

const UUIDSchema = z.string().uuid({ message: 'Must be a valid UUID' })

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

module.exports = { UUIDSchema, UUIDParamSchema, PaginationQuerySchema, LatitudeSchema, LongitudeSchema }
