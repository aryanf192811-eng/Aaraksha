// src/cron/index.js
'use strict'

const { startDMSJobs }     = require('./jobs/dms.job')
const { startWeatherJobs } = require('./jobs/weather.job')
const { startNewsJobs }    = require('./jobs/news.job')
const { startAnomalyJobs } = require('./jobs/anomaly.job')
const logger = require('../utils/logger')

function startCrons() {
  startDMSJobs()
  startWeatherJobs()
  startNewsJobs()
  startAnomalyJobs()
  logger.info('All cron jobs started')
}

module.exports = { startCrons }
