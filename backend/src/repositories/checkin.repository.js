// src/repositories/checkin.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class CheckinRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO checkins (tourist_id, trip_id, dms_id, latitude, longitude, battery_pct, message, type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        data.touristId, data.tripId ?? null, data.dmsId ?? null,
        data.latitude, data.longitude,
        data.batteryPct ?? null, data.message ?? null,
        data.type || 'MANUAL',
      ]
    )
  }

  async findByTouristId(touristId, filters = {}) {
    const conditions = ['tourist_id=$1']
    const params = [touristId]
    let idx = 2
    if (filters.tripId) { conditions.push(`trip_id=$${idx}`); params.push(filters.tripId); idx++ }
    return this.query(
      `SELECT * FROM checkins WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx}`,
      [...params, filters.limit || 20]
    )
  }

  async findByTripId(tripId) {
    return this.query(
      'SELECT * FROM checkins WHERE trip_id=$1 ORDER BY created_at ASC', [tripId]
    )
  }
}

module.exports = { CheckinRepository }
