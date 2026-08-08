// src/services/review.service.js
'use strict'

const { ReviewRepository } = require('../repositories/review.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

async function createReview(touristId, destinationId, data, uploadedFiles = []) {
  const destRepo = new DestinationRepository()
  const destination = await destRepo.findById(destinationId)
  if (!destination) throw Object.assign(new Error(ERRORS.DESTINATION_NOT_FOUND), { statusCode: 404 })

  const reviewRepo = new ReviewRepository()
  if (await reviewRepo.existsForTourist(destinationId, touristId)) {
    throw Object.assign(new Error(ERRORS.REVIEW_ALREADY_EXISTS), { statusCode: 409 })
  }

  const photoUrls = uploadedFiles.map(f => `/uploads/reviews/${f.filename}`)

  const review = await reviewRepo.create({
    destinationId, touristId,
    tripId: data.tripId,
    rating: data.rating,
    reviewText: data.reviewText,
    photoUrls,
    videoUrl: data.videoUrl,
    actualCostInr: data.actualCostInr,
    timeSpentHours: data.timeSpentHours,
    crowdLevel: data.crowdLevel,
    cleanlinessRating: data.cleanlinessRating,
    feltSafe: data.feltSafe,
    transportRating: data.transportRating,
    foodAvailabilityRating: data.foodAvailabilityRating,
    accessibilityRating: data.accessibilityRating,
    likedText: data.likedText,
    dislikedText: data.dislikedText,
    tipsText: data.tipsText,
    visitedDate: data.visitedDate,
  })

  logger.info({ reviewId: review.id, destinationId, touristId, photoCount: photoUrls.length }, 'Destination review created')
  return review
}

async function getReviewsForDestination(destinationId, filters = {}) {
  const reviewRepo = new ReviewRepository()
  const { rows, total } = await reviewRepo.findByDestinationId(destinationId, filters.limit || 20, filters.offset || 0)
  const aggregate = await reviewRepo.getAggregate(destinationId)
  return { reviews: rows, total, aggregate }
}

module.exports = { createReview, getReviewsForDestination }
