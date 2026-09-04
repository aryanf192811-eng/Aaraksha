// src/validators/localOperatorReview.validator.js
// Plain JSON body, not multipart (no photos on this one, unlike
// review.validator.js's destination reviews) — real numbers, not z.coerce.
'use strict'

const { z } = require('zod')

const CreateOperatorReviewSchema = z.object({
  tripId:     z.string().uuid().optional().nullable(),
  rating:     z.number().int().min(1).max(5),
  reviewText: z.string().max(2000).optional(),
})

module.exports = { CreateOperatorReviewSchema }
