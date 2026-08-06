// src/repositories/dms.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class DMSRepository extends BaseRepository {
  async create(data) {
    const nextTrigger = new Date(Date.now() + data.intervalMinutes * 60 * 1000)
    return this.queryOne(`
      INSERT INTO dead_mans_switches (tourist_id, trip_id, interval_minutes, next_trigger_at)
      VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.touristId, data.tripId ?? null, data.intervalMinutes, nextTrigger]
    )
  }

  async findActiveByTouristId(touristId) {
    return this.queryOne(`
      SELECT *,
        EXTRACT(EPOCH FROM (next_trigger_at - NOW()))::integer as seconds_remaining,
        EXTRACT(EPOCH FROM (next_trigger_at - INTERVAL '10 minutes' - NOW()))::integer as seconds_to_warning
      FROM dead_mans_switches
      WHERE tourist_id = $1 AND status = 'ACTIVE'
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

  async reset(id, intervalMinutes) {
    const nextTrigger = new Date(Date.now() + intervalMinutes * 60 * 1000)
    return this.queryOne(`
      UPDATE dead_mans_switches
      SET last_reset_at=NOW(), next_trigger_at=$2, warning_sent_at=NULL
      WHERE id=$1 RETURNING *`,
      [id, nextTrigger]
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
