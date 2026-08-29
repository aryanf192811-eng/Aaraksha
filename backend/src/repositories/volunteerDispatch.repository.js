// src/repositories/volunteerDispatch.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class VolunteerDispatchRepository extends BaseRepository {
  // One row per alerted volunteer — a single SOS fans out to many rows here,
  // unlike rescue_assignments which is one row per SOS (a single official
  // team). Built with a plain loop of single INSERTs rather than a bulk
  // multi-row INSERT to keep the parameterization simple; volunteer alert
  // lists are capped at 20 (see VolunteerRepository.findVerifiedNearby), so
  // this never runs more than 20 queries.
  async createMany(sosEventId, volunteerIds) {
    const rows = []
    for (const volunteerId of volunteerIds) {
      const row = await this.queryOne(
        `INSERT INTO volunteer_dispatches (sos_event_id, volunteer_id)
         VALUES ($1, $2) RETURNING *`,
        [sosEventId, volunteerId]
      )
      rows.push(row)
    }
    return rows
  }

  async findById(id) {
    return this.queryOne('SELECT * FROM volunteer_dispatches WHERE id = $1', [id])
  }

  async findByVolunteerId(volunteerId) {
    return this.query(`
      SELECT vd.*, se.category, se.latitude AS sos_latitude, se.longitude AS sos_longitude,
        se.status AS sos_status, se.created_at AS sos_created_at
      FROM volunteer_dispatches vd
      JOIN sos_events se ON se.id = vd.sos_event_id
      WHERE vd.volunteer_id = $1
      ORDER BY vd.assigned_at DESC
      LIMIT 20`,
      [volunteerId]
    )
  }

  // Scoped to volunteerId so a volunteer can only update their own
  // dispatch — the same ownership-check-in-the-WHERE-clause pattern
  // dms.repository.js's updateStatus uses.
  async updateStatus(id, volunteerId, status, timestampCol) {
    const timestampSet = timestampCol ? `, ${timestampCol} = NOW()` : ''
    return this.queryOne(
      `UPDATE volunteer_dispatches SET status = $3${timestampSet}
       WHERE id = $1 AND volunteer_id = $2 RETURNING *`,
      [id, volunteerId, status]
    )
  }

  async awardPoints(id, points) {
    return this.queryOne(
      `UPDATE volunteer_dispatches SET points_awarded = points_awarded + $2 WHERE id = $1 RETURNING *`,
      [id, points]
    )
  }

  // An SOS closing (resolved or false-alarm) previously only released the
  // one assigned rescuer -- every OTHER volunteer who was broadcast an
  // ALERTED notification but never responded kept it sitting in their
  // "Active alerts" list indefinitely, since nothing ever closed it out.
  // Called from both sos.service.js#markFalseAlarm and
  // govt.service.js#resolveSOS alongside the existing rescuer-release step.
  async declineAllPendingForSOS(sosEventId) {
    return this.query(
      `UPDATE volunteer_dispatches SET status = 'DECLINED', responded_at = NOW()
       WHERE sos_event_id = $1 AND status = 'ALERTED' RETURNING id`,
      [sosEventId]
    )
  }
}

module.exports = { VolunteerDispatchRepository }
