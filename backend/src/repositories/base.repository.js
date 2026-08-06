// src/repositories/base.repository.js
'use strict'

const { getPool } = require('../database/pool')

class BaseRepository {
  // Pass a transaction client to participate in a transaction.
  // Pass null to use the pool directly (auto-commit).
  constructor(client = null) {
    this._client = client
  }

  get db() {
    return this._client || getPool()
  }

  async query(text, params = []) {
    const { rows } = await this.db.query(text, params)
    return rows
  }

  async queryOne(text, params = []) {
    const rows = await this.query(text, params)
    return rows[0] || null
  }

  async queryCount(text, params = []) {
    const row = await this.queryOne(text, params)
    return parseInt(row?.count ?? row?.total ?? 0, 10)
  }
}

module.exports = { BaseRepository }
