// src/validators/review.validator.js
// Submitted as multipart/form-data (photos ride alongside), so every field
// arrives as a string — z.coerce is required on anything numeric.
'use strict'

const { z } = require('zod')

const CROWD_LEVELS = ['LOW', 'MEDIUM', 'HIGH']
const FELT_SAFE_OPTIONS = ['YES', 'NO', 'SOMEWHAT']

const CreateReviewSchema = z.object({
  tripId:            z.string().uuid().optional().nullable(),
  rating:            z.coerce.number().int().min(1).max(5),
  reviewText:        z.string().max(3000).optional(),
  videoUrl:          z.string().url().max(512).optional(),
  actualCostInr:     z.coerce.number().int().min(0).optional(),
  timeSpentHours:    z.coerce.number().min(0).max(240).optional(),
  crowdLevel:        z.enum(CROWD_LEVELS).optional(),
  cleanlinessRating: z.coerce.number().int().min(1).max(5).optional(),
  feltSafe:          z.enum(FELT_SAFE_OPTIONS).optional(),
  transportRating:   z.coerce.number().int().min(1).max(5).optional(),
  foodAvailabilityRating: z.coerce.number().int().min(1).max(5).optional(),
  accessibilityRating:    z.coerce.number().int().min(1).max(5).optional(),
  likedText:         z.string().max(1000).optional(),
  dislikedText:      z.string().max(1000).optional(),
  tipsText:          z.string().max(1000).optional(),
  visitedDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

module.exports = { CreateReviewSchema, CROWD_LEVELS, FELT_SAFE_OPTIONS }
