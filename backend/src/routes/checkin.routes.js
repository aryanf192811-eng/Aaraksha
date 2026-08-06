// src/routes/checkin.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/checkin.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { CreateCheckinSchema } = require('../validators/checkin.validator')

router.use(authenticateTourist)

router.post('/',    validate(CreateCheckinSchema), ctrl.createCheckin)
router.get('/recent', ctrl.getRecentCheckins)

module.exports = router
