// src/repositories/govt.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class GovtRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO govt_users (name, email, password_hash, role, district, state)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, name, email, role, district, state, is_active, created_at`,
      [data.name, data.email, data.passwordHash, data.role, data.district ?? null, data.state ?? null]
    )
  }

  async findByEmail(email) {
    return this.queryOne(`
      SELECT id, name, email, role, district, state, is_active, password_hash
      FROM govt_users WHERE email=$1`,
      [email]
    )
  }

  async findById(id) {
    return this.queryOne(`
      SELECT id, name, email, role, district, state, is_active
      FROM govt_users WHERE id=$1 AND is_active=TRUE`,
      [id]
    )
  }
}

module.exports = { GovtRepository }
