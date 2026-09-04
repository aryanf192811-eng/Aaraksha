// src/services/localOperatorReview.service.js
'use strict'

const { LocalOperatorRepository } = require('../repositories/localOperator.repository')
const { LocalOperatorReviewRepository } = require('../repositories/localOperatorReview.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

// The "Vocal for Local" gamification loop (migration 030) — a real
// interaction proof (you reviewed a specific business), not a fabricated
// "you visited" claim this project has no booking system to actually
// verify. Deliberately a flat award, not tiered by rating: rewarding only
// high ratings would bias reviews positive, which defeats the point of a
// trust signal.
const POINTS_ON_REVIEW = 10

async function createReview(touristId, operatorId, data) {
  // findVerifiedById, not a plain findById -- a tourist can only review a
  // provider they could actually have seen and used, same invariant every
  // other tourist-facing local_operators read already enforces.
  const operator = await new LocalOperatorRepository().findVerifiedById(operatorId)
  if (!operator) throw Object.assign(new Error(ERRORS.LOCAL_OPERATOR_NOT_FOUND), { statusCode: 404 })

  const reviewRepo = new LocalOperatorReviewRepository()
  if (await reviewRepo.existsForTourist(operatorId, touristId)) {
    throw Object.assign(new Error(ERRORS.OPERATOR_REVIEW_ALREADY_EXISTS), { statusCode: 409 })
  }

  const review = await reviewRepo.create({
    localOperatorId: operatorId, touristId,
    tripId: data.tripId, rating: data.rating, reviewText: data.reviewText,
  })

  const tourist = await new TouristRepository().addLocalPoints(touristId, POINTS_ON_REVIEW)

  logger.info({ reviewId: review.id, operatorId, touristId, pointsAwarded: POINTS_ON_REVIEW }, 'Local operator review created')
  return { ...review, touristLocalPoints: tourist?.local_points ?? null, pointsAwarded: POINTS_ON_REVIEW }
}

async function getReviewsForOperator(operatorId, filters = {}) {
  const reviewRepo = new LocalOperatorReviewRepository()
  const { rows, total } = await reviewRepo.findByOperatorId(operatorId, filters.limit || 20, filters.offset || 0)
  const [aggregate] = [...(await reviewRepo.getAggregatesByOperatorIds([operatorId])).values()]
  return { reviews: rows, total, aggregate: aggregate || { reviewCount: 0, avgRating: null } }
}

module.exports = { createReview, getReviewsForOperator }
