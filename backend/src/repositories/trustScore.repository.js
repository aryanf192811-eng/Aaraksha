// src/repositories/trustScore.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

const TRUST_SCORE_MIN = 0
const TRUST_SCORE_MAX = 100

class TrustScoreRepository extends BaseRepository {
  // Clamps at the DB level (not just in JS) so a concurrent double-apply
  // can't push the score outside [0,100] even under a race.
  async applyDelta(touristId, delta) {
    return this.queryOne(
      `UPDATE tourists
       SET trust_score = LEAST($2, GREATEST($3, trust_score + $4))
       WHERE id = $1
       RETURNING id, trust_score, trust_restricted_at`,
      [touristId, TRUST_SCORE_MAX, TRUST_SCORE_MIN, delta]
    )
  }

  // Idempotent -- only stamps on the FIRST crossing below the threshold, so
  // a second confirmed-fraud event while already restricted doesn't reset
  // the "how long has this account been flagged" clock.
  async stampRestrictedIfUnset(touristId) {
    return this.queryOne(
      `UPDATE tourists SET trust_restricted_at = NOW()
       WHERE id = $1 AND trust_restricted_at IS NULL
       RETURNING id, trust_restricted_at`,
      [touristId]
    )
  }

  async resetForApproval(touristId, score) {
    return this.queryOne(
      `UPDATE tourists SET trust_score = $2, trust_restricted_at = NULL
       WHERE id = $1
       RETURNING id, trust_score, trust_restricted_at`,
      [touristId, score]
    )
  }

  async createEvent({ touristId, delta, reasonCode, reasonText, relatedSosId, createdByKind, createdByGovtUserId }) {
    return this.queryOne(
      `INSERT INTO tourist_trust_events
         (tourist_id, delta, reason_code, reason_text, related_sos_id, created_by_kind, created_by_govt_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [touristId, delta, reasonCode, reasonText ?? null, relatedSosId ?? null, createdByKind, createdByGovtUserId ?? null]
    )
  }

  async findEventsByTourist(touristId, limit = 50) {
    return this.query(
      `SELECT * FROM tourist_trust_events WHERE tourist_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [touristId, limit]
    )
  }

  async createAppeal(touristId, message) {
    return this.queryOne(
      `INSERT INTO tourist_trust_appeals (tourist_id, message) VALUES ($1,$2) RETURNING *`,
      [touristId, message]
    )
  }

  async findAppealById(id) {
    return this.queryOne(`SELECT * FROM tourist_trust_appeals WHERE id = $1`, [id])
  }

  // A cooldown after rejection stops a restricted account from spam-
  // resubmitting the same plea every few minutes.
  async findLatestAppealByTourist(touristId) {
    return this.queryOne(
      `SELECT * FROM tourist_trust_appeals WHERE tourist_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [touristId]
    )
  }

  async findPendingAppeals() {
    return this.query(`
      SELECT ta.*, t.full_name, t.phone, t.trust_score
      FROM tourist_trust_appeals ta
      JOIN tourists t ON t.id = ta.tourist_id
      WHERE ta.status = 'PENDING'
      ORDER BY ta.created_at ASC`)
  }

  async updateAppealStatus(id, status, reviewedBy, resolutionNotes) {
    return this.queryOne(
      `UPDATE tourist_trust_appeals
       SET status = $2, reviewed_by = $3, resolution_notes = $4, reviewed_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING *`,
      [id, status, reviewedBy, resolutionNotes ?? null]
    )
  }
}

module.exports = { TrustScoreRepository, TRUST_SCORE_MIN, TRUST_SCORE_MAX }
