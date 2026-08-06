// src/server.js
'use strict'

const http = require('http')
const app    = require('./app')
const { initSocket }  = require('./socket/index')
const { startCrons }  = require('./cron/index')
const { getPool }     = require('./database/pool')
const logger = require('./utils/logger')
const config = require('./config/env')

const server = http.createServer(app)

// Initialize Socket.IO
initSocket(server)

// Start listening
server.listen(config.port, () => {
  logger.info({
    port:    config.port,
    env:     config.nodeEnv,
    tourist: config.cors.touristUrl,
    govt:    config.cors.govtUrl,
    guardian:config.cors.guardianUrl,
  }, '🚀 Aaraksha backend running')

  // Start cron jobs AFTER server is listening
  startCrons()
})

// ── Graceful shutdown ─────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received — closing gracefully')
  server.close(async () => {
    try {
      await getPool().end()
      logger.info('Database pool closed')
    } catch (err) {
      logger.error({ err: err.message }, 'Error closing database pool')
    }
    logger.info('Server closed — goodbye')
    process.exit(0)
  })

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

process.on('uncaughtException', (err) => {
  logger.fatal({ err: { message: err.message, stack: err.stack } }, 'Uncaught exception — shutting down')
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection — shutting down')
  process.exit(1)
})
