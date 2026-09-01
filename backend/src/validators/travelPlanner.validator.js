// src/validators/travelPlanner.validator.js
'use strict'

const { z } = require('zod')

const INTEREST_TAGS = ['NATURE', 'ADVENTURE', 'CULTURE', 'WILDLIFE', 'RELAXATION']
const TRANSPORT_MODES = ['TRAIN', 'FLIGHT', 'BUS', 'SHARED_TAXI']

const BuildJourneySchema = z.object({
  fromCity:      z.string().min(1).max(100),
  region:        z.string().min(1).max(100), // an NE state, e.g. "Meghalaya"
  days:          z.number().int().min(1).max(30),
  budgetInr:     z.number().int().min(0).optional().nullable(),
  travelType:    z.string().max(30).optional(),
  interests:     z.array(z.enum(INTEREST_TAGS)).max(5).optional().default([]),
  transportPref: z.array(z.enum(TRANSPORT_MODES)).max(4).optional().default([]),
})

const AskFollowUpSchema = z.object({
  question: z.string().min(1).max(500),
  currentContext: z.object({
    fromCity:      z.string().max(100).optional().nullable(),
    region:        z.string().max(100).optional().nullable(),
    days:          z.number().int().min(1).max(30).optional().nullable(),
    budgetInr:     z.number().int().min(0).optional().nullable(),
    interests:     z.array(z.enum(INTEREST_TAGS)).optional().default([]),
    transportPref: z.array(z.enum(TRANSPORT_MODES)).optional().default([]),
    stopNames:     z.array(z.string()).optional().default([]),
  }),
})

const CommitJourneySchema = z.object({
  title:      z.string().min(1).max(255),
  startDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  travelType: z.string().max(30).optional(),
  totalCostInr: z.number().int().min(0),
  itinerary: z.object({
    orderedStops: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      state: z.string(),
    }).passthrough()).min(1),
    daysNeeded: z.number().int().min(1),
  }).passthrough(),
})

const ExtractIntentSchema = z.object({
  text: z.string().min(1).max(500),
})

const AdjustTripSchema = z.object({
  freeText: z.string().min(1).max(500),
})

// Deliberately NOT { itinerary, totalCostInr } -- see
// travelPlanner.service.js#applyTripAdjustment's own header comment for
// why this endpoint only ever accepts destination IDENTITY from the
// client and recomputes everything else (cost, TSI, readiness)
// server-side, never trusting a client-supplied number for any of them.
const ApplyTripAdjustmentSchema = z.object({
  orderedStopIds: z.array(z.string().uuid()).min(1),
  days: z.number().int().min(1).max(30),
})

module.exports = {
  BuildJourneySchema, AskFollowUpSchema, CommitJourneySchema,
  ExtractIntentSchema, AdjustTripSchema, ApplyTripAdjustmentSchema,
  INTEREST_TAGS, TRANSPORT_MODES,
}
