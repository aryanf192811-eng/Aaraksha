// src/cron/index.js
'use strict'

const { startDMSJobs }     = require('./jobs/dms.job')
const { startWeatherJobs } = require('./jobs/weather.job')
const logger = require('../utils/logger')

function startCrons() {
  startDMSJobs()
  startWeatherJobs()
  logger.info('All cron jobs started')
}

module.exports = { startCrons }
