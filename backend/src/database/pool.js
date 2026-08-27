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
      // Managed Postgres (Render, Heroku, etc.) terminates plaintext
      // connections and presents a certificate not in Node's default CA
      // bundle — rejectUnauthorized:false trusts it without verifying the
      // chain, which is the standard accepted tradeoff for these hosts.
      // Local/dev Postgres has no SSL listener at all, so this must stay
      // off outside production.
      ssl: config.isProd ? { rejectUnauthorized: false } : false,
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
