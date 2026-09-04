// src/repositories/localOperatorReview.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class LocalOperatorReviewRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO local_operator_reviews (local_operator_id, tourist_id, trip_id, rating, review_text)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *`,
      [data.localOperatorId, data.touristId, data.tripId ?? null, data.rating, data.reviewText ?? null]
    )
  }

  async findByOperatorId(operatorId, limit = 20, offset = 0) {
    const rows = await this.query(`
      SELECT lor.*, t.full_name as tourist_name
      FROM local_operator_reviews lor
      JOIN tourists t ON t.id = lor.tourist_id
      WHERE lor.local_operator_id = $1
      ORDER BY lor.created_at DESC
      LIMIT $2 OFFSET $3`,
      [operatorId, limit, offset]
    )
    const total = await this.queryCount(
      `SELECT COUNT(*) FROM local_operator_reviews WHERE local_operator_id = $1`, [operatorId]
    )
    return { rows, total }
  }

  // Batched the same way localOperator.repository.js#getSummariesByDestinationIds
  // batches operators — one query for every operator on a stop list, not
  // N+1, so attaching ratings to a StopDetailSheet's provider cards doesn't
  // cost a round-trip per card.
  async getAggregatesByOperatorIds(operatorIds) {
    if (!operatorIds.length) return new Map()
    const rows = await this.query(`
      SELECT local_operator_id,
        COUNT(*)::int as review_count,
        ROUND(AVG(rating)::numeric, 1) as avg_rating
      FROM local_operator_reviews
      WHERE local_operator_id = ANY($1::uuid[])
      GROUP BY local_operator_id`,
      [operatorIds]
    )
    return new Map(rows.map((r) => [r.local_operator_id, { reviewCount: r.review_count, avgRating: Number(r.avg_rating) }]))
  }

  async existsForTourist(operatorId, touristId) {
    const row = await this.queryOne(
      `SELECT id FROM local_operator_reviews WHERE local_operator_id=$1 AND tourist_id=$2`,
      [operatorId, touristId]
    )
    return !!row
  }
}

module.exports = { LocalOperatorReviewRepository }
