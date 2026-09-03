// src/repositories/localOperator.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

const SAFE_COLS = `
  id, business_name, category, destination_id, district, state,
  contact_phone, description, price_range_text, source,
  is_verified, verified_by, verified_at, is_active, created_at`

class LocalOperatorRepository extends BaseRepository {
  // --- Tourist-facing reads. These are the ONLY two methods any
  // tourist-facing code path may call — WHERE is_verified = true AND
  // is_active = true is hard-coded, not a parameter, so there is no way to
  // widen this from a caller. Rows here are contactable third-party
  // businesses, not just facts, so this is a security invariant, not a
  // convenience default.

  // Single-destination — mirrors review.repository.js#findByDestinationId.
  async findByDestinationId(destinationId) {
    return this.query(
      `SELECT ${SAFE_COLS} FROM local_operators
       WHERE destination_id = $1 AND is_verified = TRUE AND is_active = TRUE
       ORDER BY category ASC, business_name ASC`,
      [destinationId]
    )
  }

  // Batch, Map<destinationId, LocalOperator[]> — mirrors
  // travelPlanner.repository.js#getReviewSummaries's ANY($1::uuid[]) batching,
  // used by buildJourney/getRoutesBetween so a multi-stop journey is one
  // query, not N+1.
  async getSummariesByDestinationIds(destinationIds) {
    if (!destinationIds || destinationIds.length === 0) return new Map()
    const rows = await this.query(
      `SELECT ${SAFE_COLS} FROM local_operators
       WHERE destination_id = ANY($1::uuid[]) AND is_verified = TRUE AND is_active = TRUE
       ORDER BY destination_id, category ASC, business_name ASC`,
      [destinationIds]
    )
    const map = new Map()
    for (const row of rows) {
      if (!map.has(row.destination_id)) map.set(row.destination_id, [])
      map.get(row.destination_id).push(row)
    }
    return map
  }

  // --- Govt-only reads/writes. Only ever reachable from govt.service.js,
  // behind authenticateGovt + requireGovtRole — mirrors
  // volunteer.repository.js's findPendingVerification/verify/reject exactly.

  async findPendingVerification() {
    return this.query(
      `SELECT ${SAFE_COLS} FROM local_operators
       WHERE is_verified = FALSE AND is_active = TRUE ORDER BY created_at ASC`
    )
  }

  // All verified+active providers — powers the govt "All Providers" roster
  // tab, same shape as volunteer.repository.js#findAll.
  async findAll() {
    return this.query(
      `SELECT ${SAFE_COLS} FROM local_operators
       WHERE is_active = TRUE ORDER BY created_at DESC`
    )
  }

  async verify(id, govtUserId) {
    return this.queryOne(
      `UPDATE local_operators
       SET is_verified = TRUE, verified_by = $2, verified_at = NOW()
       WHERE id = $1 AND is_active = TRUE
       RETURNING ${SAFE_COLS}`,
      [id, govtUserId]
    )
  }

  // Rejecting a pending candidate reuses is_active — same soft-hide flag
  // every query above already filters on — so a rejected row disappears
  // from both the pending queue and the roster immediately, no extra state.
  async reject(id) {
    return this.queryOne(
      `UPDATE local_operators SET is_active = FALSE WHERE id = $1 AND is_active = TRUE RETURNING ${SAFE_COLS}`,
      [id]
    )
  }
}

module.exports = { LocalOperatorRepository }
