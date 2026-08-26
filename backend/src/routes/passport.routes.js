// src/routes/passport.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/passport.controller')
const { authenticateTourist } = require('../middleware/auth')
router.post('/:tripId', authenticateTourist, ctrl.generatePassport)
// GET alias for direct browser-navigation downloads (see auth.js's ?token=
// fallback) — a plain <a href> download can't be a POST or carry a header.
router.get('/:tripId', authenticateTourist, ctrl.generatePassport)
router.get('/:tripId/hash', authenticateTourist, ctrl.getIntegrityHash)
module.exports = router
