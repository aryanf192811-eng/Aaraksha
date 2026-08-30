// src/repositories/rescue.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')
const { haversineKm } = require('../utils/geo')
const { scoreRescuerCandidate } = require('../utils/rescueScoring')

// DECLINED/CANCELLED (migration 017) are just as terminal as RESOLVED for
// "is this assignment still the live one" purposes -- every query below
// that used to check only `status NOT IN ('RESOLVED')` must exclude all
// three, or a declined/cancelled row would still count as blocking a new
// assignment, still show as the tourist's "active" rescuer, still occupy
// a team/volunteer's capacity, etc.
const ACTIVE_ASSIGNMENT_FILTER = `status NOT IN ('RESOLVED', 'DECLINED', 'CANCELLED')`

class RescueRepository extends BaseRepository {
  async findAllTeams() {
    return this.query(`
      SELECT rt.*,
        (SELECT COUNT(*)::int FROM rescue_assignments ra
         WHERE ra.team_id=rt.id AND ra.${ACTIVE_ASSIGNMENT_FILTER}) as active_assignments
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
      `SELECT * FROM rescue_assignments WHERE sos_event_id=$1 AND ${ACTIVE_ASSIGNMENT_FILTER} LIMIT 1`,
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
       WHERE id=$1 AND volunteer_id=$2 AND ${ACTIVE_ASSIGNMENT_FILTER} RETURNING *`,
      [assignmentId, volunteerId, status]
    )
  }

  // A rescuer backing out -- either DECLINED (never left ASSIGNED) or
  // CANCELLED (was EN_ROUTE/ARRIVED). Same ownership scoping as
  // updateAssignmentStatus above. Returns the closed row (still carries
  // sos_event_id/volunteer_id for the service layer to free the volunteer
  // and revert the SOS status with).
  async exitAssignment(assignmentId, volunteerId, status, reason) {
    return this.queryOne(
      `UPDATE rescue_assignments SET status=$3, exit_reason=$4, exited_at=NOW()
       WHERE id=$1 AND volunteer_id=$2 AND ${ACTIVE_ASSIGNMENT_FILTER} RETURNING *`,
      [assignmentId, volunteerId, status, reason]
    )
  }

  async resolveAssignment(sosEventId) {
    return this.queryOne(`
      UPDATE rescue_assignments SET status='RESOLVED', resolved_at=NOW()
      WHERE sos_event_id=$1 AND ${ACTIVE_ASSIGNMENT_FILTER}
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
        se.handoff_verified_at, se.tourist_id, t.full_name AS tourist_name,
        t.phone AS tourist_phone, t.guardian_token
      FROM rescue_assignments ra
      JOIN sos_events se ON se.id = ra.sos_event_id
      LEFT JOIN tourists t ON t.id = se.tourist_id
      WHERE ra.volunteer_id = $1 AND ra.${ACTIVE_ASSIGNMENT_FILTER}
      ORDER BY ra.assigned_at DESC
      LIMIT 1`,
      [volunteerId]
    )
  }

  // Powers the govt Live Map's rescuer markers — every non-RESOLVED
  // assignment (team or volunteer), unified the same way findNearbyAvailableRescuers
  // is, plus the SOS location to draw a route between. `latitude`/`longitude`
  // prefers the rescuer's live GPS fix (rescuer_latitude/longitude, written by
  // volunteer.service.js#updateRescuerLocation) and falls back to their
  // registered base — same fallback tourist.service.js#getGuardianView and
  // sos.service.js#getActiveRescueInfo already use, kept consistent here.
  async findActiveAssignmentsWithPositions() {
    return this.query(`
      SELECT
        ra.id AS assignment_id, ra.status, ra.sos_event_id,
        se.latitude AS sos_latitude, se.longitude AS sos_longitude, se.category,
        t.full_name AS tourist_name,
        CASE WHEN ra.team_id IS NOT NULL THEN 'TEAM' ELSE 'VOLUNTEER' END AS rescuer_kind,
        COALESCE(rt.name, v.full_name) AS rescuer_name,
        COALESCE(ra.rescuer_latitude, rt.latitude, v.latitude) AS latitude,
        COALESCE(ra.rescuer_longitude, rt.longitude, v.longitude) AS longitude,
        (ra.rescuer_latitude IS NOT NULL) AS is_live
      FROM rescue_assignments ra
      JOIN sos_events se ON se.id = ra.sos_event_id
      JOIN tourists t ON t.id = se.tourist_id
      LEFT JOIN rescue_teams rt ON rt.id = ra.team_id
      LEFT JOIN volunteers v ON v.id = ra.volunteer_id
      WHERE ra.${ACTIVE_ASSIGNMENT_FILTER}
      ORDER BY ra.assigned_at DESC`
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
  // one ranked candidate list for the govt "assign a rescuer" panel — same
  // bounding-box-prefilter-then-haversine pattern as
  // VolunteerRepository.findVerifiedNearby, just unioned across both
  // tables instead of one. 150km (not the volunteer auto-alert radius's
  // 15km) because this panel serves state-level SDRF/police units whose
  // real dispatch jurisdiction spans a whole district or state — Northeast
  // India's terrain means the nearest team is often 100km+ away by road.
  // Ranked, not just distance-sorted (see utils/rescueScoring.js) — the
  // operator still sees and can override the ranking, but the *default*
  // order now weighs a team's suitability for this SOS's category and a
  // volunteer's earned reputation alongside raw distance, not distance
  // alone.
  async findNearbyAvailableRescuers(lat, lng, sosCategory = 'OTHER', radiusKm = 150, limit = 20) {
    lat = Number(lat)
    lng = Number(lng)
    const latDelta = radiusKm / 111
    const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1)
    const bounds = [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta]

    const rows = await this.query(`
      SELECT id, name, 'TEAM' AS kind, type, district, contact_phone AS phone, latitude, longitude, NULL::int AS points
      FROM rescue_teams
      WHERE status = 'AVAILABLE'
        AND latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
      UNION ALL
      SELECT id, full_name AS name, 'VOLUNTEER' AS kind, 'VOLUNTEER' AS type, district, phone, latitude, longitude, points
      FROM volunteers
      WHERE status = 'AVAILABLE' AND is_verified = TRUE AND is_active = TRUE
        AND latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`,
      bounds
    )

    return rows
      .map((r) => ({ ...r, distanceKm: haversineKm(lat, lng, r.latitude, r.longitude) }))
      .filter((r) => r.distanceKm <= radiusKm)
      .map((r) => scoreRescuerCandidate(r, sosCategory, radiusKm))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  // Ops-capacity counts for the govt dashboard stat cards — unified across
  // official teams and verified volunteers now that both are assignable
  // rescuers, so the number reflects real available/deployed capacity
  // instead of silently under-reporting once volunteers start taking jobs.
  async countAvailable() {
    return this.queryCount(`
      SELECT (
        (SELECT COUNT(*) FROM rescue_teams WHERE status='AVAILABLE') +
        (SELECT COUNT(*) FROM volunteers WHERE status='AVAILABLE' AND is_verified=TRUE AND is_active=TRUE)
      ) as count`)
  }

  async countDeployed() {
    return this.queryCount(`
      SELECT (
        (SELECT COUNT(*) FROM rescue_teams WHERE status='DEPLOYED') +
        (SELECT COUNT(*) FROM volunteers WHERE status='DEPLOYED' AND is_verified=TRUE AND is_active=TRUE)
      ) as count`)
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
