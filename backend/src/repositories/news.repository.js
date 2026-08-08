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
}

module.exports = { NewsRepository }
