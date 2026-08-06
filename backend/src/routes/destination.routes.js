// src/routes/destination.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/destination.controller')
router.get('/',    ctrl.getAllDestinations)
router.get('/:id', ctrl.getDestinationById)
module.exports = router
