// src/routes/passport.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/passport.controller')
const { authenticateTourist } = require('../middleware/auth')
router.post('/:tripId', authenticateTourist, ctrl.generatePassport)
module.exports = router
