// src/repositories/dataRights.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class DataRightsRepository extends BaseRepository {
  async createDeletionRequest(touristId, status, reason = null) {
    // $2 appears in both the plain column value and the CASE comparison
    // below — Postgres's parameter-type inference needs an explicit cast
    // on at least one occurrence or it deduces conflicting types for the
    // same placeholder and refuses the query outright.
    return this.queryOne(`
      INSERT INTO data_deletion_requests (tourist_id, status, reason, processed_at)
      VALUES ($1, $2, $3, CASE WHEN $2::varchar != 'PENDING' THEN NOW() ELSE NULL END)
      RETURNING *`,
      [touristId, status, reason]
    )
  }

  async findRequestsByTourist(touristId) {
    return this.query(
      `SELECT * FROM data_deletion_requests WHERE tourist_id = $1 ORDER BY requested_at DESC`,
      [touristId]
    )
  }

  // Anonymizes the identifying/sensitive fields in place rather than
  // deleting the row outright — every other table's FK to tourists is a
  // mix of CASCADE and SET NULL (see migration 001 comments), and a hard
  // DELETE would silently cascade-erase records (resolved SOS history,
  // checkpoint scans) that a government audit trail has its own legal
  // reason to retain. Anonymizing is what the DPDP Act's erasure right
  // actually asks for — "this data can no longer identify a person" —
  // not literal row deletion. is_active=false also removes the account
  // from every live-tourist/dashboard query going forward.
  async anonymize(touristId) {
    // govt_id_hash is a bare, unsalted SHA-256 of a 12-digit Aadhaar/passport
    // number — brute-forceable in hours — so leaving it in place after
    // "deletion" would let anyone with DB access re-identify the row. Replace
    // it (and the id suffix) with random values; both columns are NOT NULL /
    // UNIQUE so they can't simply be nulled out.
    return this.queryOne(`
      UPDATE tourists SET
        full_name = 'Deleted User',
        email = NULL,
        phone = 'deleted-' || substring(id::text, 1, 8),
        blood_group = NULL,
        medical_info = NULL,
        emergency_contacts = '[]'::jsonb,
        profile_photo_url = NULL,
        govt_id_hash = 'deleted-' || md5(id::text || clock_timestamp()::text),
        govt_id_suffix = '0000',
        is_active = false
      WHERE id = $1
      RETURNING id`,
      [touristId]
    )
  }

  async countOpenSOSEvents(touristId) {
    return this.queryCount(
      `SELECT COUNT(*) FROM sos_events WHERE tourist_id = $1 AND status IN ('ACTIVE', 'ASSIGNED')`,
      [touristId]
    )
  }

  async countOpenIncidentReports(touristId) {
    return this.queryCount(
      `SELECT COUNT(*) FROM incident_reports WHERE tourist_id = $1 AND status NOT IN ('RESOLVED', 'CLOSED')`,
      [touristId]
    )
  }
}

module.exports = { DataRightsRepository }
