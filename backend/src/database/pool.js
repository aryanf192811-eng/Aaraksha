// src/database/pool.js
'use strict'

const { Pool } = require('pg')
const config = require('../config/env')
const logger = require('../utils/logger')

let pool

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.db.url,
      max:                  config.db.maxConnections,
      idleTimeoutMillis:    config.db.idleTimeoutMs,
      connectionTimeoutMillis: config.db.connectionTimeoutMs,
      // Deliberately no explicit `ssl` option: Render's DATABASE_URL
      // already encodes the right sslmode itself, and pg negotiates off
      // that. Passing a second, separate ssl object here fought that
      // negotiation and produced real "SSL error: unexpected eof while
      // reading" failures server-side on every app-originated connection
      // (confirmed live in the Postgres logs) — every query timed out.
    })

    pool.on('connect', () => {
      logger.debug('New database client connected')
    })

    pool.on('error', (err) => {
      logger.error({ err: { message: err.message, code: err.code } }, 'Unexpected database pool error')
    })
  }
  return pool
}

module.exports = { getPool }
