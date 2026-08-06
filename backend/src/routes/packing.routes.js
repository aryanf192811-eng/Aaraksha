// src/routes/packing.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/packing.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { GeneratePackingSchema } = require('../validators/packing.validator')
router.post('/generate', authenticateTourist, validate(GeneratePackingSchema), ctrl.generatePackingList)
module.exports = router
