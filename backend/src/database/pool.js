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
