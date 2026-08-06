// src/database/transaction.js
// withTransaction: wraps a function in a BEGIN/COMMIT/ROLLBACK block.
// Use for ANY operation that touches more than one table.
//
// Usage:
//   const result = await withTransaction(async (client) => {
//     const row = await someRepo.create(client, data)
//     await otherRepo.update(client, row.id, updates)
//     return row
//   })
//   // Side effects (socket, SMS) happen HERE — outside withTransaction
'use strict'

const { getPool } = require('./pool')
const logger = require('../utils/logger')

async function withTransaction(fn) {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    logger.error({ err: { message: err.message, code: err.code } }, 'Transaction rolled back')
    throw err
  } finally {
    client.release()
  }
}

// Use for read-only queries that don't need a transaction
async function query(text, params = []) {
  const pool = getPool()
  const { rows } = await pool.query(text, params)
  return rows
}

// Use for single-row queries
async function queryOne(text, params = []) {
  const rows = await query(text, params)
  return rows[0] || null
}

module.exports = { withTransaction, query, queryOne }
