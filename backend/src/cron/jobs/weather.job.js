// src/cron/jobs/weather.job.js
'use strict'

const cron   = require('node-cron')
const logger = require('../../utils/logger')
const { updateWeatherForActiveTrips } = require('../../services/weather.service')
const { emitTSIUpdated, emitWeatherRiskIncreased } = require('../../socket/emitters')

function startWeatherJobs() {
  // ── Weather + TSI update: every hour ──────────────────────────────
  // Fetches OWM data for active trip destinations, recalculates TSI,
  // emits TSI_UPDATED to affected tourist + govt dashboard
  cron.schedule('0 * * * *', async () => {
    logger.info('Weather + TSI cron starting')
    try {
      const result = await updateWeatherForActiveTrips(emitTSIUpdated, emitWeatherRiskIncreased)
      logger.info(result, 'Weather + TSI cron complete')
    } catch (err) {
      logger.error({ err: { message: err.message } }, 'Weather cron crashed')
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' })

  logger.info('Weather cron job started (hourly)')
}

module.exports = { startWeatherJobs }
