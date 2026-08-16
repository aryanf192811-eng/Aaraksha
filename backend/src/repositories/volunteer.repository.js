// src/repositories/volunteer.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')
const { haversineKm } = require('../utils/geo')

// Excludes password_hash/govt_id_hash from every default SELECT — same
// convention as tourist.repository.js's SAFE_COLS.
const SAFE_COLS = `
  id, full_name, phone, govt_id_type, govt_id_suffix,
  district, state, latitude, longitude,
  is_verified, points, status, is_active, created_at`

class VolunteerRepository extends BaseRepository {
  // isVerified defaults false — a self-registered volunteer (auth.service's
  // registration flow) still needs govt review. A govt operator provisioning
  // an account directly (govt.service#createVolunteer) passes true: the
  // operator IS the verification, there's no separate identity to review.
  async create(data, isVerified = false) {
    return this.queryOne(`
      INSERT INTO volunteers (
        full_name, phone, password_hash, govt_id_type, govt_id_hash, govt_id_suffix,
        district, state, latitude, longitude, is_verified
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING ${SAFE_COLS}`,
      [
        data.fullName, data.phone, data.passwordHash,
        data.govtIdType, data.govtIdHash, data.govtIdSuffix,
        data.district, data.state, data.latitude ?? null, data.longitude ?? null,
        isVerified,
      ]
    )
  }

  // All volunteers (not just the pending-review queue) — powers the govt
  // "Volunteers" roster tab so operators can see who's already active,
  // not just who's waiting on them.
  async findAll() {
    return this.query(`SELECT ${SAFE_COLS} FROM volunteers WHERE is_active = TRUE ORDER BY created_at DESC`)
  }

  async findByPhone(phone) {
    return this.queryOne(
      `SELECT ${SAFE_COLS}, password_hash FROM volunteers WHERE phone = $1`,
      [phone]
    )
  }

  async findById(id) {
    return this.queryOne(`SELECT ${SAFE_COLS} FROM volunteers WHERE id = $1 AND is_active = TRUE`, [id])
  }

  async govtIdHashExists(hash) {
    const row = await this.queryOne('SELECT id FROM volunteers WHERE govt_id_hash = $1', [hash])
    return !!row
  }

  // Bounding-box prefilter (cheap, index-backed) then exact haversine on
  // the small remainder — no PostGIS in this project (Architecture.md).
  // Only AVAILABLE, verified, active volunteers are eligible; capped and
  // sorted nearest-first so a dense area doesn't alert hundreds at once.
  async findVerifiedNearby(lat, lng, radiusKm = 15, limit = 20) {
    // pg returns NUMERIC/DECIMAL columns as strings (to avoid float
    // precision loss), and sosEvent.latitude/longitude come straight from
    // such a column — without this, `lat + latDelta` below is string
    // concatenation, not addition, and Postgres rejects the resulting
    // garbage as invalid numeric input.
    lat = Number(lat)
    lng = Number(lng)
    const latDelta = radiusKm / 111
    const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1)

    const rows = await this.query(`
      SELECT id, full_name, phone, latitude, longitude
      FROM volunteers
      WHERE is_verified = TRUE AND is_active = TRUE AND status = 'AVAILABLE'
        AND latitude  BETWEEN $1 AND $2
        AND longitude BETWEEN $3 AND $4`,
      [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta]
    )

    return rows
      .map((v) => ({ ...v, distanceKm: haversineKm(lat, lng, v.latitude, v.longitude) }))
      .filter((v) => v.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit)
  }

  async findPendingVerification() {
    return this.query(
      `SELECT ${SAFE_COLS} FROM volunteers WHERE is_verified = FALSE AND is_active = TRUE ORDER BY created_at ASC`
    )
  }

  async verify(id) {
    return this.queryOne(
      `UPDATE volunteers SET is_verified = TRUE WHERE id = $1 AND is_active = TRUE RETURNING ${SAFE_COLS}`,
      [id]
    )
  }

  // lat/lng are optional — a status flip alone (e.g. going OFF_DUTY for the
  // night) shouldn't require a fresh GPS fix, but the app sends one
  // whenever it has it so a volunteer's position stays current for the
  // next proximity match without a separate "update my location" action.
  async updateStatus(id, status, latitude, longitude) {
    if (latitude != null && longitude != null) {
      return this.queryOne(
        `UPDATE volunteers SET status = $2, latitude = $3, longitude = $4
         WHERE id = $1 AND is_active = TRUE RETURNING ${SAFE_COLS}`,
        [id, status, latitude, longitude]
      )
    }
    return this.queryOne(
      `UPDATE volunteers SET status = $2 WHERE id = $1 AND is_active = TRUE RETURNING ${SAFE_COLS}`,
      [id, status]
    )
  }

  async addPoints(id, points) {
    return this.queryOne(
      `UPDATE volunteers SET points = points + $2 WHERE id = $1 RETURNING ${SAFE_COLS}`,
      [id, points]
    )
  }
}

module.exports = { VolunteerRepository }
