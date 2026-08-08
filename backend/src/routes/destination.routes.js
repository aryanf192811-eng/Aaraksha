// src/routes/destination.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/destination.controller')
router.get('/',              ctrl.getAllDestinations)
router.get('/risk-overview', ctrl.getRiskOverview) // before /:id — otherwise "risk-overview" matches as an id param
router.get('/:id',           ctrl.getDestinationById)
router.get('/:id/news',      ctrl.getDestinationNews)
module.exports = router
