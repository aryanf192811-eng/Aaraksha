// src/repositories/location.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class LocationRepository extends BaseRepository {
  async upsert(touristId, data) {
    return this.queryOne(`
      INSERT INTO tourist_locations (tourist_id, latitude, longitude, battery_pct, accuracy_m, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (tourist_id) DO UPDATE SET
        latitude   = EXCLUDED.latitude,
        longitude  = EXCLUDED.longitude,
        battery_pct= EXCLUDED.battery_pct,
        accuracy_m = EXCLUDED.accuracy_m,
        updated_at = NOW()
      RETURNING *`,
      [touristId, data.latitude, data.longitude, data.batteryPct ?? null, data.accuracyM ?? null]
    )
  }

  async findByTouristId(touristId) {
    return this.queryOne(
      'SELECT * FROM tourist_locations WHERE tourist_id=$1', [touristId]
    )
  }

  // All tourists with location updated in the last 2 hours
  async findLive() {
    return this.query(`
      SELECT t.id, t.full_name, t.phone, t.blood_group,
        tl.latitude, tl.longitude, tl.battery_pct, tl.updated_at,
        (SELECT COUNT(*)::int FROM sos_events se
         WHERE se.tourist_id=t.id AND se.status='ACTIVE') as active_sos_count,
        (SELECT COUNT(*)::int FROM dead_mans_switches dms
         WHERE dms.tourist_id=t.id AND dms.status='ACTIVE') as active_dms_count,
        tr.title as active_trip_title, tr.tsi_score, tr.tsi_label
      FROM tourist_locations tl
      JOIN tourists t ON t.id = tl.tourist_id
      LEFT JOIN trips tr ON tr.tourist_id = t.id AND tr.status = 'ACTIVE'
      WHERE tl.updated_at >= NOW() - INTERVAL '2 hours'
      ORDER BY active_sos_count DESC, tl.updated_at DESC`)
  }

  async countActive() {
    return this.queryCount(
      `SELECT COUNT(*) FROM tourist_locations WHERE updated_at >= NOW() - INTERVAL '2 hours'`
    )
  }
}

module.exports = { LocationRepository }
