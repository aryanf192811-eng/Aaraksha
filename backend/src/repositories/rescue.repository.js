// src/repositories/rescue.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')
const { haversineKm } = require('../utils/geo')

class RescueRepository extends BaseRepository {
  async findAllTeams() {
    return this.query(`
      SELECT rt.*,
        (SELECT COUNT(*)::int FROM rescue_assignments ra
         WHERE ra.team_id=rt.id AND ra.status NOT IN ('RESOLVED')) as active_assignments
      FROM rescue_teams rt ORDER BY rt.status ASC, rt.name ASC`)
  }

  async findTeamById(id) {
    return this.queryOne('SELECT * FROM rescue_teams WHERE id=$1', [id])
  }

  async updateTeamStatus(id, status) {
    return this.queryOne(
      'UPDATE rescue_teams SET status=$2 WHERE id=$1 RETURNING *', [id, status]
    )
  }

  // Exactly one of data.teamId/data.volunteerId is set — enforced by the
  // rescue_assignments_one_assignee CHECK constraint (migration 010), the
  // caller (govt.service.js#assignRescue) validates it before this runs.
  async createAssignment(data) {
    return this.queryOne(`
      INSERT INTO rescue_assignments (sos_event_id, team_id, volunteer_id, assigned_by, notes)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.sosEventId, data.teamId ?? null, data.volunteerId ?? null, data.assignedBy ?? null, data.notes ?? null]
    )
  }

  async findActiveAssignmentBySOS(sosEventId) {
    return this.queryOne(
      `SELECT * FROM rescue_assignments WHERE sos_event_id=$1 AND status NOT IN ('RESOLVED') LIMIT 1`,
      [sosEventId]
    )
  }

  // Self-service progress updates from the rescuer (ASSIGNED → EN_ROUTE →
  // ARRIVED) — deliberately does NOT accept RESOLVED. Closing an SOS stays
  // a govt-operator action (resolveAssignment above, driven from
  // govt.service.js#resolveSOS) since this is emergency response, not a
  // ride-hail trip a driver can unilaterally end. Scoped to
  // (id AND volunteer_id) — same ownership-in-the-WHERE-clause pattern as
  // volunteerDispatch.repository.js's updateStatus.
  async updateAssignmentStatus(assignmentId, volunteerId, status) {
    return this.queryOne(
      `UPDATE rescue_assignments SET status=$3
       WHERE id=$1 AND volunteer_id=$2 AND status NOT IN ('RESOLVED') RETURNING *`,
      [assignmentId, volunteerId, status]
    )
  }

  async resolveAssignment(sosEventId) {
    return this.queryOne(`
      UPDATE rescue_assignments SET status='RESOLVED', resolved_at=NOW()
      WHERE sos_event_id=$1 AND status NOT IN ('RESOLVED')
      RETURNING team_id, volunteer_id`,
      [sosEventId]
    )
  }

  // The Rescuer app's "active job" screen and its location-push endpoint
  // both need this — the SOS location/category/tourist to route to, plus
  // enough of the tourist row (guardian_token) to fan out a live location
  // update the same way assignRescue's own post-assignment push does.
  async findActiveAssignmentByVolunteerId(volunteerId) {
    return this.queryOne(`
      SELECT ra.*, se.category, se.latitude AS sos_latitude, se.longitude AS sos_longitude,
        se.tourist_id, t.full_name AS tourist_name, t.guardian_token
      FROM rescue_assignments ra
      JOIN sos_events se ON se.id = ra.sos_event_id
      LEFT JOIN tourists t ON t.id = se.tourist_id
      WHERE ra.volunteer_id = $1 AND ra.status NOT IN ('RESOLVED')
      ORDER BY ra.assigned_at DESC
      LIMIT 1`,
      [volunteerId]
    )
  }

  async updateAssignmentRescuerLocation(assignmentId, latitude, longitude) {
    return this.queryOne(`
      UPDATE rescue_assignments
      SET rescuer_latitude=$2, rescuer_longitude=$3, rescuer_location_updated_at=NOW()
      WHERE id=$1 RETURNING *`,
      [assignmentId, latitude, longitude]
    )
  }

  // Unifies official AVAILABLE teams and AVAILABLE+verified volunteers into
  // one distance-sorted candidate list for the govt "assign a rescuer"
  // panel — same bounding-box-prefilter-then-haversine pattern as
  // VolunteerRepository.findVerifiedNearby, just unioned across both
  // tables instead of one.
  async findNearbyAvailableRescuers(lat, lng, radiusKm = 25, limit = 20) {
    lat = Number(lat)
    lng = Number(lng)
    const latDelta = radiusKm / 111
    const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1)
    const bounds = [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta]

    const rows = await this.query(`
      SELECT id, name, 'TEAM' AS kind, type, district, contact_phone AS phone, latitude, longitude
      FROM rescue_teams
      WHERE status = 'AVAILABLE'
        AND latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
      UNION ALL
      SELECT id, full_name AS name, 'VOLUNTEER' AS kind, 'VOLUNTEER' AS type, district, phone, latitude, longitude
      FROM volunteers
      WHERE status = 'AVAILABLE' AND is_verified = TRUE AND is_active = TRUE
        AND latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`,
      bounds
    )

    return rows
      .map((r) => ({ ...r, distanceKm: haversineKm(lat, lng, r.latitude, r.longitude) }))
      .filter((r) => r.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit)
  }

  async countAvailable() {
    return this.queryCount(`SELECT COUNT(*) FROM rescue_teams WHERE status='AVAILABLE'`)
  }

  async countDeployed() {
    return this.queryCount(`SELECT COUNT(*) FROM rescue_teams WHERE status='DEPLOYED'`)
  }

  async avgResponseMinutes(startDate) {
    const row = await this.queryOne(`
      SELECT AVG(EXTRACT(EPOCH FROM (ra.assigned_at - se.created_at)) / 60.0)::numeric(6,1) as avg_mins
      FROM rescue_assignments ra
      JOIN sos_events se ON se.id=ra.sos_event_id
      WHERE ra.assigned_at >= $1`,
      [startDate]
    )
    return parseFloat(row?.avg_mins ?? 0)
  }
}

module.exports = { RescueRepository }
