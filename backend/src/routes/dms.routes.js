// src/routes/dms.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/dms.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { CreateDMSSchema, ResetDMSSchema, UpdateDMSStatusSchema } = require('../validators/dms.validator')

router.use(authenticateTourist)

router.post('/',             validate(CreateDMSSchema),       ctrl.createDMS)
router.get('/active',        ctrl.getActiveDMS)
router.post('/:id/reset',    validate(ResetDMSSchema),        ctrl.resetDMS)
router.patch('/:id/status',  validate(UpdateDMSStatusSchema), ctrl.updateDMSStatus)

module.exports = router
