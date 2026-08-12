// src/repositories/dms.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class DMSRepository extends BaseRepository {
  async create(data) {
    const totalMs = data.intervalSeconds != null
      ? data.intervalSeconds * 1000
      : data.intervalMinutes * 60 * 1000
    const nextTrigger = new Date(Date.now() + totalMs)
    // Demo-mode switches (interval_seconds set) skip the 10-minute-early
    // warning entirely — it would already be "due" the instant the switch
    // is armed, since the whole window is shorter than the warning offset.
    const warningSentAt = data.intervalSeconds != null ? new Date() : null
    return this.queryOne(`
      INSERT INTO dead_mans_switches (tourist_id, trip_id, interval_minutes, interval_seconds, next_trigger_at, warning_sent_at)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.touristId, data.tripId ?? null, data.intervalMinutes, data.intervalSeconds ?? null, nextTrigger, warningSentAt]
    )
  }

  // Includes TRIGGERED (not just ACTIVE) so the frontend can render the
  // "missed check-in, auto-SOS sent" state instead of the row just
  // vanishing the instant it fires — it stops showing up again once the
  // tourist disables/resolves it (status moves to PAUSED/RESOLVED). Also
  // doubles as createDMS's "already have one running" guard, so a
  // TRIGGERED switch has to be dismissed before a new one can be armed.
  async findActiveByTouristId(touristId) {
    return this.queryOne(`
      SELECT *,
        EXTRACT(EPOCH FROM (next_trigger_at - NOW()))::integer as seconds_remaining,
        EXTRACT(EPOCH FROM (next_trigger_at - INTERVAL '10 minutes' - NOW()))::integer as seconds_to_warning
      FROM dead_mans_switches
      WHERE tourist_id = $1 AND status IN ('ACTIVE', 'TRIGGERED')
      LIMIT 1`,
      [touristId]
    )
  }

  async findById(id, touristId = null) {
    const q = touristId
      ? `SELECT * FROM dead_mans_switches WHERE id=$1 AND tourist_id=$2 AND status='ACTIVE'`
      : `SELECT * FROM dead_mans_switches WHERE id=$1 AND status='ACTIVE'`
    return this.queryOne(q, touristId ? [id, touristId] : [id])
  }

  // Find all DMS that need warning (10 minutes before trigger, not yet warned)
  async findNeedingWarning() {
    return this.query(`
      SELECT dms.*, t.full_name, t.phone
      FROM dead_mans_switches dms
      JOIN tourists t ON t.id = dms.tourist_id
      WHERE dms.status = 'ACTIVE'
        AND dms.warning_sent_at IS NULL
        AND (dms.next_trigger_at - INTERVAL '10 minutes') <= NOW()`,
    )
  }

  // Find all DMS that have exceeded their deadline
  async findTriggered() {
    return this.query(`
      SELECT dms.*, t.full_name, t.phone, t.blood_group,
        t.emergency_contacts, t.guardian_token, t.govt_id_suffix,
        tl.latitude, tl.longitude, tl.battery_pct
      FROM dead_mans_switches dms
      JOIN tourists t ON t.id = dms.tourist_id
      LEFT JOIN tourist_locations tl ON tl.tourist_id = dms.tourist_id
      WHERE dms.status = 'ACTIVE' AND dms.next_trigger_at <= NOW()`,
    )
  }

  async reset(id, intervalMinutes, intervalSeconds) {
    const totalMs = intervalSeconds != null ? intervalSeconds * 1000 : intervalMinutes * 60 * 1000
    const nextTrigger = new Date(Date.now() + totalMs)
    // Demo-mode switches re-arm already "warned" too, for the same reason
    // create() sets it up front — see comment there.
    const warningSentAt = intervalSeconds != null ? new Date() : null
    return this.queryOne(`
      UPDATE dead_mans_switches
      SET last_reset_at=NOW(), next_trigger_at=$2, warning_sent_at=$3
      WHERE id=$1 RETURNING *`,
      [id, nextTrigger, warningSentAt]
    )
  }

  async markWarned(id) {
    return this.queryOne(
      `UPDATE dead_mans_switches SET warning_sent_at=NOW() WHERE id=$1 RETURNING id`,
      [id]
    )
  }

  async markTriggered(id, sosEventId) {
    return this.queryOne(
      `UPDATE dead_mans_switches SET status='TRIGGERED', sos_event_id=$2 WHERE id=$1 RETURNING *`,
      [id, sosEventId]
    )
  }

  async updateStatus(id, touristId, status) {
    return this.queryOne(
      `UPDATE dead_mans_switches SET status=$3 WHERE id=$1 AND tourist_id=$2 RETURNING *`,
      [id, touristId, status]
    )
  }

  async countActive() {
    return this.queryCount(`SELECT COUNT(*) FROM dead_mans_switches WHERE status='ACTIVE'`)
  }
}

module.exports = { DMSRepository }
