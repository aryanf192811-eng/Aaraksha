// src/repositories/travelPlanner.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

// Named explicitly (no SELECT *, per this project's own DB rule -- these
// two queries predate the rule being enforced here; fixed while adding
// findDestinationsByIds below rather than repeating the same mistake).
const DESTINATION_COLUMNS = `
  id, name, state, latitude, longitude, connectivity, difficulty, altitude_m,
  zone_type, ilp_required, nearest_hospital_name, nearest_hospital_km,
  nearest_hospital_phone, nearest_police_km, govt_advisory, popularity_index,
  description, best_months, source, created_at`

class TravelPlannerRepository extends BaseRepository {
  // Candidates for a journey: same shape DestinationRepository.findAll
  // already queries (state filter), kept separate rather than imported
  // because this query intentionally skips the weather/scam joins that
  // endpoint carries -- the planner scores safety itself via tsi.service's
  // calculateStopRisk, it doesn't need live weather for a not-yet-committed
  // itinerary.
  async findCandidateDestinations({ state, excludeZoneTypes = [] } = {}) {
    const conditions = ['1=1']
    const params = []
    let idx = 1
    if (state) { conditions.push(`state ILIKE $${idx}`); params.push(state); idx++ }
    if (excludeZoneTypes.length > 0) {
      conditions.push(`zone_type != ALL($${idx}::varchar[])`)
      params.push(excludeZoneTypes)
      idx++
    }
    return this.query(
      `SELECT ${DESTINATION_COLUMNS} FROM destinations WHERE ${conditions.join(' AND ')} ORDER BY popularity_index DESC`,
      params
    )
  }

  // Pulls a trip's already-committed stops back out as real destination
  // rows, so an AI-proposed adjustment can be re-scored against the same
  // deterministic pipeline a fresh journey uses -- see
  // travelPlanner.service.js#adjustTrip.
  async findDestinationsByIds(ids) {
    if (!ids || ids.length === 0) return []
    return this.query(
      `SELECT ${DESTINATION_COLUMNS} FROM destinations WHERE id = ANY($1::uuid[])`,
      [ids]
    )
  }

  // All curated legs among a candidate set, as a lookup map the pure
  // scorer can consult by "fromId_toId" -- built here (one query) rather
  // than N+1 queries per leg.
  async findRoutesAmong(destinationIds) {
    if (!destinationIds || destinationIds.length === 0) return new Map()
    const rows = await this.query(
      `SELECT id, from_destination_id, to_destination_id, mode, duration_minutes,
              cost_min_inr, cost_max_inr, notes, source, created_at
       FROM typical_routes
       WHERE from_destination_id = ANY($1::uuid[]) AND to_destination_id = ANY($1::uuid[])`,
      [destinationIds]
    )
    return new Map(rows.map((r) => [`${r.from_destination_id}_${r.to_destination_id}`, r]))
  }

  // Real traveller cost/experience data from destination_reviews -- the
  // "human experience, no hardcoded data" layer both source proposals
  // wanted to scrape from the internet already exists as this table.
  async getReviewSummaries(destinationIds) {
    if (!destinationIds || destinationIds.length === 0) return new Map()
    const rows = await this.query(
      `SELECT destination_id,
         ROUND(AVG(rating)::numeric, 1) as avg_rating,
         ROUND(AVG(actual_cost_inr)::numeric, 0) as avg_cost_inr,
         COUNT(*)::int as review_count,
         (ARRAY_AGG(tips_text) FILTER (WHERE tips_text IS NOT NULL AND tips_text != ''))[1:3] as sample_tips,
         MODE() WITHIN GROUP (ORDER BY felt_safe) as common_felt_safe
       FROM destination_reviews
       WHERE destination_id = ANY($1::uuid[])
       GROUP BY destination_id`,
      [destinationIds]
    )
    return new Map(rows.map((r) => [r.destination_id, {
      avgRating: r.avg_rating ? Number(r.avg_rating) : null,
      avgCostInr: r.avg_cost_inr ? Number(r.avg_cost_inr) : null,
      reviewCount: r.review_count,
      sampleTips: r.sample_tips || [],
      commonFeltSafe: r.common_felt_safe,
    }]))
  }
}

module.exports = { TravelPlannerRepository }
