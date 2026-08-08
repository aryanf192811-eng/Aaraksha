// src/repositories/tripMember.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class TripMemberRepository extends BaseRepository {
  async add(tripId, touristId) {
    return this.queryOne(`
      INSERT INTO trip_members (trip_id, tourist_id)
      VALUES ($1, $2)
      ON CONFLICT (trip_id, tourist_id) DO NOTHING
      RETURNING *`,
      [tripId, touristId]
    )
  }

  async remove(tripId, touristId) {
    return this.queryOne(
      `DELETE FROM trip_members WHERE trip_id=$1 AND tourist_id=$2 RETURNING id`,
      [tripId, touristId]
    )
  }

  async isMember(tripId, touristId) {
    const row = await this.queryOne(
      `SELECT 1 FROM trip_members WHERE trip_id=$1 AND tourist_id=$2`,
      [tripId, touristId]
    )
    return !!row
  }

  // Co-travelers' last known location for the trip's "Group" tab — a
  // best-effort snapshot (tourist_locations updated on SOS/check-in), not a
  // live tracker, so a member who hasn't checked in shows no location.
  async findByTripId(tripId) {
    return this.query(`
      SELECT tm.tourist_id, tm.joined_at, t.full_name, t.phone,
        tl.latitude, tl.longitude, tl.updated_at as location_updated_at
      FROM trip_members tm
      JOIN tourists t ON t.id = tm.tourist_id
      LEFT JOIN tourist_locations tl ON tl.tourist_id = tm.tourist_id
      WHERE tm.trip_id = $1
      ORDER BY tm.joined_at ASC`,
      [tripId]
    )
  }

  // Owner + members, deduped — used to resolve who a group SOS fan-out
  // should notify without the caller needing to know the owner separately.
  async getGroupTouristIds(tripId) {
    const rows = await this.query(`
      SELECT tourist_id FROM (
        SELECT tourist_id FROM trips WHERE id = $1
        UNION
        SELECT tourist_id FROM trip_members WHERE trip_id = $1
      ) ids`,
      [tripId]
    )
    return rows.map(r => r.tourist_id)
  }

  async findTripIdsForTourist(touristId) {
    const rows = await this.query(
      `SELECT trip_id FROM trip_members WHERE tourist_id=$1`,
      [touristId]
    )
    return rows.map(r => r.trip_id)
  }
}

module.exports = { TripMemberRepository }
