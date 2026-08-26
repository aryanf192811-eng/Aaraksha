// src/cron/jobs/anomaly.job.js
'use strict'

const cron   = require('node-cron')
const logger = require('../../utils/logger')
const { detectAnomalies } = require('../../services/anomaly.service')

function startAnomalyJobs() {
  // Every minute — cheap query (one scan over ACTIVE trips), and a
  // minute-scale cadence keeps this demoable (seed a stale location, wait
  // under a minute) without being wastefully frequent for a signal whose
  // own thresholds are hours/tens-of-km, not seconds.
  cron.schedule('* * * * *', async () => {
    try {
      const result = await detectAnomalies()
      if (result.created > 0) {
        logger.warn({ created: result.created, scanned: result.candidates }, 'Safety anomalies flagged')
      }
    } catch (err) {
      logger.error({ err: { message: err.message } }, 'Anomaly detection cron crashed')
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' })

  logger.info('Anomaly detection cron job started (every minute)')
}

module.exports = { startAnomalyJobs }
