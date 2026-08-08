// src/validators/trip.validator.js
'use strict'

const { z } = require('zod')
const { TRAVEL_TYPES, TRIP_STATUSES, CONNECTIVITY, DIFFICULTY,
        ZONE_TYPES, ACTIVITY_TYPES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')

const ActivitySchema = z.object({
  name:     z.string().min(1).max(255),
  type:     z.enum(Object.values(ACTIVITY_TYPES)).optional().default('ACTIVITY'),
  cost:     z.number().min(0).optional().default(0),
  duration: z.string().max(50).optional(),
  notes:    z.string().max(500).optional(),
})

const StopSchema = z.object({
  city:          z.string().min(1).max(255),
  state:         z.string().min(1).max(100),
  destinationId: z.string().uuid().optional().nullable(),
  lat:           z.number().min(-90).max(90).optional().nullable(),
  lng:           z.number().min(-180).max(180).optional().nullable(),
  days:          z.number().int().min(1).max(365),
  arrivalDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  activities:    z.array(ActivitySchema).optional().default([]),
  notes:         z.string().max(1000).optional(),
  // Risk-related fields (populated from destinations table or provided manually)
  connectivity:  z.enum(Object.values(CONNECTIVITY)).optional().default('MODERATE'),
  difficulty:    z.enum(Object.values(DIFFICULTY)).optional().default('EASY'),
  altitude_m:    z.number().int().min(0).optional().default(0),
  zone_type:     z.enum(Object.values(ZONE_TYPES)).optional().default('SAFE'),
  hospital_km:   z.number().min(0).optional().default(0),
  eta_minutes:   z.number().int().min(0).optional().nullable(),
})

const PackingItemSchema = z.object({
  id:       z.string().uuid().optional(),
  item:     z.string().min(1).max(255),
  category: z.string().max(50).optional().default('OTHER'),
  packed:   z.boolean().optional().default(false),
})

const TripFieldsSchema = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  travelType:  z.enum(Object.values(TRAVEL_TYPES)).optional().default('SOLO'),
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  stops:       z.array(StopSchema).optional().default([]),
  budgetInr:   z.number().int().min(0).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  isPublic:    z.boolean().optional().default(false),
})

// .refine() returns a ZodEffects, which has no .partial() — keep the plain
// object schema (TripFieldsSchema) around so UpdateTripSchema can derive from it.
const CreateTripSchema = TripFieldsSchema.refine(
  data => new Date(data.startDate) < new Date(data.endDate),
  { message: ERRORS.TRIP_DATE_INVALID, path: ['endDate'] }
)

const UpdateTripSchema = TripFieldsSchema.partial()

const UpdateTripStatusSchema = z.object({
  status: z.enum([TRIP_STATUSES.ACTIVE, TRIP_STATUSES.COMPLETED, TRIP_STATUSES.CANCELLED]),
})

const UpdateChecklistSchema = z.object({
  packingChecklist: z.array(PackingItemSchema),
})

const JoinTripSchema = z.object({
  inviteCode: z.string().min(4).max(8),
})

module.exports = {
  CreateTripSchema, UpdateTripSchema, UpdateTripStatusSchema,
  UpdateChecklistSchema, StopSchema, PackingItemSchema, JoinTripSchema,
}
