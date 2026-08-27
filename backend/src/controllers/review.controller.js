// src/controllers/review.controller.js
'use strict'

const reviewService = require('../services/review.service')
const { sendSuccess } = require('../utils/response')

const createReview = async (req, res, next) => {
  try {
    const review = await reviewService.createReview(req.tourist.id, req.params.id, req.validatedBody, req.files || [])
    sendSuccess(res, review, 'Review submitted', 201)
  } catch (err) { next(err) }
}

const getReviews = async (req, res, next) => {
  try {
    const result = await reviewService.getReviewsForDestination(req.params.id, req.query)
    sendSuccess(res, result)
  } catch (err) { next(err) }
}

const getRecentReviews = async (req, res, next) => {
  try { sendSuccess(res, await reviewService.getRecentReviews()) }
  catch (err) { next(err) }
}

module.exports = { createReview, getReviews, getRecentReviews }
