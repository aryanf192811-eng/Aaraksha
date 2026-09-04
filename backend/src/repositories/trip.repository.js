// src/repositories/trip.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class TripRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO trips (
        tourist_id, title, description, travel_type, start_date, end_date,
        stops, budget_inr, cover_image_url, packing_checklist, is_public, public_token,
        tsi_score, tsi_label, tsi_factors, tsi_recommendations, tsi_updated_at,
        rescue_readiness, rescue_readiness_score
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *`,
      [
        data.touristId, data.title, data.description ?? null,
        data.travelType, data.startDate, data.endDate,
        JSON.stringify(data.stops || []),
        data.budgetInr ?? null, data.coverImageUrl ?? null,
        JSON.stringify(data.packingChecklist || []),
        data.isPublic ?? false, data.publicToken ?? null,
        data.tsiScore ?? null, data.tsiLabel ?? null,
        JSON.stringify(data.tsiFactors || {}),
        JSON.stringify(data.tsiRecommendations || []),
        data.tsiScore ? new Date() : null,
        JSON.stringify(data.rescueReadiness || {}),
        data.rescueReadinessScore ?? 0,
      ]
    )
  }

  async findByTouristId(touristId, filters = {}) {
    const conditions = ['tourist_id = $1']
    const params = [touristId]
    let idx = 2

    if (filters.status) {
      conditions.push(`status = $${idx}`)
      params.push(filters.status)
      idx++
    } else {
      conditions.push('status != \'CANCELLED\'')
    }

    const total = await this.queryCount(
      `SELECT COUNT(*) FROM trips WHERE ${conditions.join(' AND ')}`, params
    )

    const rows = await this.query(`
      SELECT id, title, travel_type, start_date, end_date, status,
        tsi_score, tsi_label, rescue_readiness_score, is_public,
        cover_image_url, budget_inr,
        jsonb_array_length(stops) as stop_count, created_at
      FROM trips
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit || 20, filters.offset || 0]
    )

    return { rows, total }
  }

  async findById(id, touristId = null) {
    const conditions = ['id = $1']
    const params = [id]
    if (touristId) { conditions.push('tourist_id = $2'); params.push(touristId) }
    return this.queryOne(`SELECT * FROM trips WHERE ${conditions.join(' AND ')}`, params)
  }

  async findByPublicToken(token) {
    return this.queryOne(`
      SELECT t.*, tu.full_name as author_name
      FROM trips t
      JOIN tourists tu ON tu.id = t.tourist_id
      WHERE t.public_token = $1 AND t.is_public = TRUE`,
      [token]
    )
  }

  async findActiveByTouristId(touristId) {
    // Guardian view needs stops/tsi_score/tsi_label to show the tourist's
    // destination and safety index — this used to select only `id`, so
    // those fields were always undefined and silently omitted from the
    // guardian response no matter what the trip actually contained.
    return this.queryOne(
      `SELECT id, stops, tsi_score, tsi_label FROM trips WHERE tourist_id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [touristId]
    )
  }

  async findAllActive() {
    return this.query(`SELECT * FROM trips WHERE status = 'ACTIVE'`)
  }

  async findByInviteCode(code) {
    return this.queryOne(`SELECT * FROM trips WHERE invite_code = $1`, [code])
  }

  async setInviteCode(id, touristId, code) {
    return this.queryOne(
      `UPDATE trips SET invite_code=$3 WHERE id=$1 AND tourist_id=$2 RETURNING id, invite_code`,
      [id, touristId, code]
    )
  }

  // Fleet-wide safety index for the govt dashboard: mean TSI across trips
  // currently in progress. NULL (no active trips with a score yet) rather
  // than 0, so the dashboard can distinguish "no data" from "genuinely 0".
  async getAverageActiveTSI() {
    const [row] = await this.query(`
      SELECT ROUND(AVG(tsi_score))::int AS avg_tsi, COUNT(*)::int AS trip_count
      FROM trips WHERE status = 'ACTIVE' AND tsi_score IS NOT NULL`)
    return { avgTsi: row?.avg_tsi ?? null, tripCount: row?.trip_count ?? 0 }
  }

  async update(id, touristId, data) {
    return this.queryOne(`
      UPDATE trips SET
        title=$3, description=$4, travel_type=$5, start_date=$6, end_date=$7,
        stops=$8, budget_inr=$9, cover_image_url=$10, is_public=$11,
        tsi_score=$12, tsi_label=$13, tsi_factors=$14, tsi_recommendations=$15,
        tsi_updated_at=$16, rescue_readiness=$17, rescue_readiness_score=$18
      WHERE id=$1 AND tourist_id=$2
      RETURNING *`,
      [
        id, touristId,
        data.title, data.description ?? null, data.travelType,
        data.startDate, data.endDate,
        JSON.stringify(data.stops || []),
        data.budgetInr ?? null, data.coverImageUrl ?? null, data.isPublic ?? false,
        data.tsiScore ?? null, data.tsiLabel ?? null,
        JSON.stringify(data.tsiFactors || {}),
        JSON.stringify(data.tsiRecommendations || []),
        data.tsiScore ? new Date() : null,
        JSON.stringify(data.rescueReadiness || {}),
        data.rescueReadinessScore ?? 0,
      ]
    )
  }

  async updateStatus(id, touristId, status) {
    return this.queryOne(
      `UPDATE trips SET status=$3 WHERE id=$1 AND tourist_id=$2 RETURNING id, status`,
      [id, touristId, status]
    )
  }

  async updateChecklist(id, touristId, checklist) {
    return this.queryOne(
      `UPDATE trips SET packing_checklist=$3 WHERE id=$1 AND tourist_id=$2 RETURNING id, packing_checklist`,
      [id, touristId, JSON.stringify(checklist)]
    )
  }

  async updateTSI(id, tsiScore, tsiLabel, tsiFactors, tsiRecommendations) {
    return this.queryOne(`
      UPDATE trips SET
        tsi_score=$2, tsi_label=$3, tsi_factors=$4, tsi_recommendations=$5,
        tsi_updated_at=NOW()
      WHERE id=$1 RETURNING id, tsi_score, tsi_label`,
      [id, tsiScore, tsiLabel, JSON.stringify(tsiFactors), JSON.stringify(tsiRecommendations)]
    )
  }

  async delete(id, touristId) {
    return this.queryOne(
      `DELETE FROM trips WHERE id=$1 AND tourist_id=$2 RETURNING id`,
      [id, touristId]
    )
  }
}

module.exports = { TripRepository }
