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

  // Cross-destination ranking — a tourist has no way to discover "which
  // destinations have active reports right now" without already knowing to
  // look at one specific place. Same underlying data as findByDestination/
  // countByDestination, just aggregated the other way. `top category` per
  // destination uses DISTINCT ON (Postgres-specific) ordered by count desc
  // to pick the single most common category cheaply, without a second query.
  async getHotspots(recentDays = 90, limit = 10) {
    return this.query(`
      WITH recent AS (
        SELECT destination_id, category, created_at
        FROM scam_reports
        WHERE created_at >= NOW() - ($1 || ' days')::interval
      ),
      top_category AS (
        SELECT DISTINCT ON (destination_id) destination_id, category
        FROM (SELECT destination_id, category, COUNT(*)::int as cnt FROM recent GROUP BY destination_id, category) c
        ORDER BY destination_id, cnt DESC
      )
      SELECT d.id as destination_id, d.name, d.state,
        COUNT(r.*)::int as recent_count,
        MAX(r.created_at) as last_reported_at,
        tc.category as top_category
      FROM recent r
      JOIN destinations d ON d.id = r.destination_id
      LEFT JOIN top_category tc ON tc.destination_id = r.destination_id
      GROUP BY d.id, d.name, d.state, tc.category
      ORDER BY recent_count DESC, last_reported_at DESC
      LIMIT $2`,
      [recentDays, limit]
    )
  }
}

module.exports = { ScamRepository }
