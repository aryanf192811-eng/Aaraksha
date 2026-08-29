// src/repositories/anomaly.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class AnomalyRepository extends BaseRepository {
  // Every tourist with an ACTIVE trip, their last-known position (if any —
  // LEFT JOIN, since a tourist who never once pinged location is itself a
  // valid inactivity candidate, not a query miss), and the trip's stops
  // JSON for the route-deviation check. This is the detection cron's one
  // query per run — small table, runs every minute, so a plain scan over
  // ACTIVE trips is fine without a dedicated spatial index.
  async findActiveTripCandidates() {
    return this.query(`
      SELECT
        t.id as tourist_id, t.full_name, t.phone, t.blood_group,
        t.emergency_contacts, t.guardian_token,
        tr.id as trip_id, tr.stops,
        tl.latitude, tl.longitude, tl.updated_at as location_updated_at
      FROM trips tr
      JOIN tourists t ON t.id = tr.tourist_id
      LEFT JOIN tourist_locations tl ON tl.tourist_id = t.id
      WHERE tr.status = 'ACTIVE'`
    )
  }

  async findOpenByTouristAndType(touristId, type) {
    return this.queryOne(
      `SELECT * FROM safety_anomalies WHERE tourist_id=$1 AND type=$2 AND status='OPEN'`,
      [touristId, type]
    )
  }

  // Most recent anomaly of this type regardless of status — used to check
  // "did we already flag and resolve this exact reading" so a resolved
  // anomaly doesn't reopen on the very next cron tick just because the
  // underlying stale timestamp hasn't changed (see anomaly.service.js).
  async findMostRecentByTouristAndType(touristId, type) {
    return this.queryOne(
      `SELECT * FROM safety_anomalies WHERE tourist_id=$1 AND type=$2 ORDER BY detected_at DESC LIMIT 1`,
      [touristId, type]
    )
  }

  async create(data) {
    return this.queryOne(`
      INSERT INTO safety_anomalies (
        tourist_id, trip_id, type, last_latitude, last_longitude,
        last_location_at, distance_from_route_km, details
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        data.touristId, data.tripId ?? null, data.type,
        data.lastLatitude ?? null, data.lastLongitude ?? null,
        data.lastLocationAt ?? null, data.distanceFromRouteKm ?? null,
        data.details ?? null,
      ]
    )
  }

  // Govt dashboard's "needs attention" list — same tourist/trip-context
  // shape as SOSRepository.findActive so the frontend can render both with
  // similar cards.
  async findOpen() {
    return this.query(`
      SELECT sa.*, t.full_name, t.phone, t.blood_group,
        trip.title as trip_title, trip.tsi_score, trip.tsi_label
      FROM safety_anomalies sa
      JOIN tourists t ON t.id = sa.tourist_id
      LEFT JOIN trips trip ON trip.id = sa.trip_id
      WHERE sa.status = 'OPEN'
      ORDER BY sa.detected_at DESC`
    )
  }

  async resolve(id, govtUserId) {
    return this.queryOne(`
      UPDATE safety_anomalies
      SET status='RESOLVED', resolved_at=NOW(), resolved_by=$2
      WHERE id=$1 AND status='OPEN'
      RETURNING *`,
      [id, govtUserId]
    )
  }
}

module.exports = { AnomalyRepository }
