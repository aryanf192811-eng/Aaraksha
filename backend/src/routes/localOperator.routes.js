// src/routes/localOperator.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/localOperatorReview.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { CreateOperatorReviewSchema } = require('../validators/localOperatorReview.validator')

router.get('/:id/reviews',  ctrl.getReviews)
router.post('/:id/reviews', authenticateTourist, validate(CreateOperatorReviewSchema), ctrl.createReview)

module.exports = router
