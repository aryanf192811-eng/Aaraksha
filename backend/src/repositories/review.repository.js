// src/repositories/review.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class ReviewRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO destination_reviews (
        destination_id, tourist_id, trip_id, rating, review_text, photo_urls, video_url,
        actual_cost_inr, time_spent_hours, crowd_level, cleanliness_rating, felt_safe,
        transport_rating, food_availability_rating, accessibility_rating,
        liked_text, disliked_text, tips_text, visited_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *`,
      [
        data.destinationId, data.touristId, data.tripId ?? null,
        data.rating, data.reviewText ?? null, JSON.stringify(data.photoUrls || []), data.videoUrl ?? null,
        data.actualCostInr ?? null, data.timeSpentHours ?? null, data.crowdLevel ?? null,
        data.cleanlinessRating ?? null, data.feltSafe ?? null,
        data.transportRating ?? null, data.foodAvailabilityRating ?? null, data.accessibilityRating ?? null,
        data.likedText ?? null, data.dislikedText ?? null, data.tipsText ?? null,
        data.visitedDate ?? null,
      ]
    )
  }

  async findByDestinationId(destinationId, limit = 20, offset = 0) {
    const rows = await this.query(`
      SELECT dr.*, t.full_name as tourist_name
      FROM destination_reviews dr
      JOIN tourists t ON t.id = dr.tourist_id
      WHERE dr.destination_id = $1
      ORDER BY dr.created_at DESC
      LIMIT $2 OFFSET $3`,
      [destinationId, limit, offset]
    )
    const total = await this.queryCount(
      `SELECT COUNT(*) FROM destination_reviews WHERE destination_id = $1`, [destinationId]
    )
    return { rows, total }
  }

  // Flat, cross-destination feed for the community tab's "All destinations"
  // view — same row shape as findByDestinationId, with the destination
  // attached since it's no longer implicit from a single selection.
  async findRecent(limit = 30) {
    return this.query(`
      SELECT dr.*, t.full_name as tourist_name,
             d.name as destination_name, d.state as destination_state
      FROM destination_reviews dr
      JOIN tourists t ON t.id = dr.tourist_id
      JOIN destinations d ON d.id = dr.destination_id
      ORDER BY dr.created_at DESC
      LIMIT $1`,
      [limit]
    )
  }

  async getAggregate(destinationId) {
    return this.queryOne(`
      SELECT
        COUNT(*)::int as review_count,
        ROUND(AVG(rating)::numeric, 1) as avg_rating,
        ROUND(AVG(actual_cost_inr)::numeric, 0) as avg_cost_inr,
        ROUND(AVG(time_spent_hours)::numeric, 1) as avg_time_spent_hours,
        MODE() WITHIN GROUP (ORDER BY crowd_level) as common_crowd_level,
        COUNT(*) FILTER (WHERE felt_safe = 'YES')::int as felt_safe_count
      FROM destination_reviews
      WHERE destination_id = $1`,
      [destinationId]
    )
  }

  async existsForTourist(destinationId, touristId) {
    const row = await this.queryOne(
      `SELECT id FROM destination_reviews WHERE destination_id=$1 AND tourist_id=$2`,
      [destinationId, touristId]
    )
    return !!row
  }
}

module.exports = { ReviewRepository }
