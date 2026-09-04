// src/repositories/news.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class NewsRepository extends BaseRepository {
  async create({ destinationId, category, severity, headline, body, source, postedByGovtUserId }) {
    return this.queryOne(`
      INSERT INTO destination_news (destination_id, category, severity, headline, body, source, posted_by_govt_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [destinationId, category, severity, headline, body ?? null, source || 'Aaraksha Curated', postedByGovtUserId ?? null]
    )
  }

  async findByDestinationId(destinationId, limit = 20) {
    return this.query(`
      SELECT * FROM destination_news
      WHERE destination_id = $1
      ORDER BY published_at DESC
      LIMIT $2`,
      [destinationId, limit]
    )
  }

  // For a trip's own dashboard/itinerary — news across every stop at once.
  async findByDestinationIds(destinationIds, limit = 30) {
    if (destinationIds.length === 0) return []
    return this.query(`
      SELECT dn.*, d.name as destination_name
      FROM destination_news dn
      JOIN destinations d ON d.id = dn.destination_id
      WHERE dn.destination_id = ANY($1::uuid[])
      ORDER BY dn.published_at DESC
      LIMIT $2`,
      [destinationIds, limit]
    )
  }

  // General "all destinations" feed for the /news page — filterable by
  // destination, state (needs the destinations join since state only lives
  // there), severity and category, with real LIMIT/OFFSET + a parallel
  // COUNT(*) so the frontend can page. Same conditions/params incremental-
  // build pattern as trip.repository.js#findByTouristId and
  // destination.repository.js#findAll.
  async findAllFiltered(filters = {}) {
    const conditions = ['1=1']
    const params = []
    let idx = 1

    if (filters.destinationId) { conditions.push(`dn.destination_id = $${idx}`); params.push(filters.destinationId); idx++ }
    if (filters.state) { conditions.push(`d.state = $${idx}`); params.push(filters.state); idx++ }
    if (filters.severity) { conditions.push(`dn.severity = $${idx}`); params.push(filters.severity); idx++ }
    if (filters.category) { conditions.push(`dn.category = $${idx}`); params.push(filters.category); idx++ }

    const whereClause = conditions.join(' AND ')

    const total = await this.queryCount(
      `SELECT COUNT(*) FROM destination_news dn
       JOIN destinations d ON d.id = dn.destination_id
       WHERE ${whereClause}`,
      params
    )

    const rows = await this.query(`
      SELECT dn.*, d.name as destination_name, d.state as destination_state
      FROM destination_news dn
      JOIN destinations d ON d.id = dn.destination_id
      WHERE ${whereClause}
      ORDER BY dn.published_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit || 20, filters.offset || 0]
    )

    return { rows, total }
  }
}

module.exports = { NewsRepository }
