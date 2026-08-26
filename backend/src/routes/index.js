// src/routes/index.js
'use strict'

const { Router } = require('express')
const router = Router()

router.use('/auth',            require('./auth.routes'))
router.use('/tourists',        require('./tourist.routes'))
router.use('/trips',           require('./trip.routes'))
router.use('/sos',             require('./sos.routes'))
router.use('/dms',             require('./dms.routes'))
router.use('/checkins',        require('./checkin.routes'))
router.use('/destinations',    require('./destination.routes'))
router.use('/scam-reports',    require('./scam.routes'))
router.use('/incidents',       require('./incident.routes'))
router.use('/packing',         require('./packing.routes'))
router.use('/journey-passport',require('./passport.routes'))
router.use('/govt',            require('./govt.routes'))
router.use('/volunteers',      require('./volunteer.routes'))
router.use('/webhooks',        require('./webhook.routes'))
router.use('/push',            require('./push.routes'))

module.exports = router
