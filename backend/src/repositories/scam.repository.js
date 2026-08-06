// src/repositories/scam.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class ScamRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO scam_reports (destination_id, tourist_id, category, description, incident_date)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.destinationId, data.touristId, data.category, data.description, data.incidentDate ?? null]
    )
  }

  async findByDestination(destinationId, limit = 50) {
    return this.query(`
      SELECT id, category, description, incident_date, verified, created_at
      FROM scam_reports
      WHERE destination_id=$1
      ORDER BY created_at DESC LIMIT $2`,
      [destinationId, limit]
    )
  }

  async countByDestination(destinationId) {
    const rows = await this.query(
      `SELECT category, COUNT(*)::int as count FROM scam_reports
       WHERE destination_id=$1 GROUP BY category`,
      [destinationId]
    )
    const total = rows.reduce((s, r) => s + r.count, 0)
    const byCategory = rows.reduce((acc, r) => ({ ...acc, [r.category]: r.count }), {})
    return { total, byCategory }
  }
}

module.exports = { ScamRepository }
