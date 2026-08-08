// src/routes/destination.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/destination.controller')
const reviewCtrl = require('../controllers/review.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { uploadReviewPhotos } = require('../config/upload')
const { CreateReviewSchema } = require('../validators/review.validator')

router.get('/',              ctrl.getAllDestinations)
router.get('/risk-overview', ctrl.getRiskOverview) // before /:id — otherwise "risk-overview" matches as an id param
router.get('/:id',           ctrl.getDestinationById)
router.get('/:id/news',      ctrl.getDestinationNews)
router.get('/:id/reviews',   reviewCtrl.getReviews)
router.post('/:id/reviews',  authenticateTourist, uploadReviewPhotos, validate(CreateReviewSchema), reviewCtrl.createReview)

module.exports = router
