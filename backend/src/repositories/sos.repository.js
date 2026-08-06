// src/repositories/sos.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class SOSRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO sos_events (
        tourist_id, trip_id, latitude, longitude, location_accuracy_m,
        is_stale_location, category, message, trigger_type, battery_pct
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        data.touristId, data.tripId ?? null,
        data.latitude, data.longitude,
        data.locationAccuracyM ?? null,
        data.isStaleLocation ?? false,
        data.category, data.message ?? null,
        data.triggerType, data.batteryPct ?? null,
      ]
    )
  }

  async findById(id) {
    return this.queryOne(`SELECT * FROM sos_events WHERE id = $1`, [id])
  }

  async findByTouristId(touristId, filters = {}) {
    const conditions = ['se.tourist_id = $1']
    const params = [touristId]
    let idx = 2

    if (filters.status) { conditions.push(`se.status = $${idx}`); params.push(filters.status); idx++ }

    const total = await this.queryCount(
      `SELECT COUNT(*) FROM sos_events se WHERE ${conditions.join(' AND ')}`, params
    )

    const rows = await this.query(`
      SELECT se.*,
        ra.status as assignment_status,
        rt.name  as rescue_team_name
      FROM sos_events se
      LEFT JOIN rescue_assignments ra ON ra.sos_event_id = se.id AND ra.status != 'RESOLVED'
      LEFT JOIN rescue_teams rt ON rt.id = ra.team_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY se.created_at DESC
      LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, filters.limit || 20, filters.offset || 0]
    )

    return { rows, total }
  }

  async findActive(filters = {}) {
    const conditions = ["se.status IN ('ACTIVE','ASSIGNED')"]
    const params = []
    let idx = 1

    if (filters.status) { conditions.push(`se.status = $${idx}`); params.push(filters.status); idx++ }
    if (filters.category) { conditions.push(`se.category = $${idx}`); params.push(filters.category); idx++ }

    const total = await this.queryCount(
      `SELECT COUNT(*) FROM sos_events se WHERE ${conditions.join(' AND ')}`, params
    )

    const rows = await this.query(`
      SELECT se.*,
        t.full_name, t.phone, t.blood_group,
        t.emergency_contacts, t.govt_id_suffix,
        tl.battery_pct as last_battery, tl.updated_at as last_location_update,
        ra.id as assignment_id, ra.status as assignment_status,
        rt.name as rescue_team_name, rt.type as rescue_team_type,
        rt.contact_phone as team_phone
      FROM sos_events se
      LEFT JOIN tourists t ON t.id = se.tourist_id
      LEFT JOIN tourist_locations tl ON tl.tourist_id = se.tourist_id
      LEFT JOIN rescue_assignments ra ON ra.sos_event_id = se.id AND ra.status != 'RESOLVED'
      LEFT JOIN rescue_teams rt ON rt.id = ra.team_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY se.created_at DESC
      LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, filters.limit || 20, filters.offset || 0]
    )

    return { rows, total }
  }

  async updateStatus(id, status, extra = {}) {
    const fields = { status }
    if (status === 'RESOLVED' || status === 'FALSE_ALARM') {
      fields.resolved_at = new Date()
      if (extra.resolutionNotes) fields.resolution_notes = extra.resolutionNotes
    }
    if (extra.contactsNotified) fields.contacts_notified = JSON.stringify(extra.contactsNotified)

    const setClauses = Object.keys(fields).map((k, i) => `${k} = $${i+2}`)
    const values = [id, ...Object.values(fields)]
    return this.queryOne(
      `UPDATE sos_events SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    )
  }

  async updateContactsNotified(id, contacts) {
    return this.queryOne(
      `UPDATE sos_events SET contacts_notified = $2 WHERE id = $1 RETURNING id`,
      [id, JSON.stringify(contacts)]
    )
  }

  async countByPeriod(startDate) {
    return this.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'RESOLVED')::int as resolved,
        COUNT(*) FILTER (WHERE status IN ('ACTIVE','ASSIGNED'))::int as active
      FROM sos_events WHERE created_at >= $1`,
      [startDate]
    )
  }

  async countByCategory(startDate) {
    return this.query(
      `SELECT category, COUNT(*)::int as count FROM sos_events
       WHERE created_at >= $1 GROUP BY category ORDER BY count DESC`,
      [startDate]
    )
  }

  async trendsPerDay(startDate) {
    return this.query(`
      SELECT date_trunc('day', created_at) as day, COUNT(*)::int as count
      FROM sos_events WHERE created_at >= $1
      GROUP BY day ORDER BY day`,
      [startDate]
    )
  }
}

module.exports = { SOSRepository }
