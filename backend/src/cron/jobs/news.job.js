// src/cron/jobs/news.job.js
'use strict'

const cron   = require('node-cron')
const logger = require('../../utils/logger')
const { rotateNewsForAllDestinations } = require('../../services/news.service')

function startNewsJobs() {
  // ── Curated news rotation: every 20 minutes ───────────────────────
  // Checks each destination's rotation slot (a 3-hour window, see
  // news.service.js) and posts the slot's item if it isn't already live.
  // Running more often than the window just means a new slot goes live
  // promptly after it rolls over, not that duplicates get created.
  cron.schedule('*/20 * * * *', async () => {
    logger.info('Destination news rotation cron starting')
    try {
      const result = await rotateNewsForAllDestinations()
      logger.info(result, 'Destination news rotation cron complete')
    } catch (err) {
      logger.error({ err: { message: err.message } }, 'News rotation cron crashed')
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' })

  logger.info('Destination news rotation cron job started (every 20 min)')
}

module.exports = { startNewsJobs }
