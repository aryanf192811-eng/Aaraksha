// src/controllers/localOperatorReview.controller.js
'use strict'

const service = require('../services/localOperatorReview.service')
const { sendSuccess } = require('../utils/response')

const createReview = async (req, res, next) => {
  try {
    const review = await service.createReview(req.tourist.id, req.params.id, req.validatedBody)
    sendSuccess(res, review, 'Review submitted', 201)
  } catch (err) { next(err) }
}

const getReviews = async (req, res, next) => {
  try { sendSuccess(res, await service.getReviewsForOperator(req.params.id, req.query)) }
  catch (err) { next(err) }
}

module.exports = { createReview, getReviews }
