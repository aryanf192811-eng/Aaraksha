// src/cron/jobs/dms.job.js
'use strict'

const cron   = require('node-cron')
const logger = require('../../utils/logger')
const { processDMSTriggers, processDMSWarnings } = require('../../services/dms.service')

function startDMSJobs() {
  // ── DMS Warning: every minute ──────────────────────────────────────
  // Fires SMS to tourist 10 minutes before their DMS would auto-trigger
  cron.schedule('* * * * *', async () => {
    try {
      const result = await processDMSWarnings()
      if (result.processed > 0) {
        logger.info({ processed: result.processed }, 'DMS warnings sent')
      }
    } catch (err) {
      logger.error({ err: { message: err.message } }, 'DMS warning cron crashed')
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' })

  // ── DMS Trigger: every minute ─────────────────────────────────────
  // Auto-creates SOS for tourists who missed their check-in deadline
  cron.schedule('* * * * *', async () => {
    try {
      const result = await processDMSTriggers()
      if (result.processed > 0) {
        logger.warn({ processed: result.processed }, 'DMS triggers fired — SOSes created')
      }
    } catch (err) {
      logger.error({ err: { message: err.message } }, 'DMS trigger cron crashed')
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' })

  logger.info('DMS cron jobs started (warn + trigger every minute)')
}

module.exports = { startDMSJobs }
