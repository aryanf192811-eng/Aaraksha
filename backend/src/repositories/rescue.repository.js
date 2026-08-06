// src/repositories/rescue.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

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

  async createAssignment(data) {
    return this.queryOne(`
      INSERT INTO rescue_assignments (sos_event_id, team_id, assigned_by, notes)
      VALUES ($1,$2,$3,$4) RETURNING *`,
      [data.sosEventId, data.teamId, data.assignedBy ?? null, data.notes ?? null]
    )
  }

  async findActiveAssignmentBySOS(sosEventId) {
    return this.queryOne(
      `SELECT * FROM rescue_assignments WHERE sos_event_id=$1 AND status NOT IN ('RESOLVED') LIMIT 1`,
      [sosEventId]
    )
  }

  async resolveAssignment(sosEventId) {
    return this.queryOne(`
      UPDATE rescue_assignments SET status='RESOLVED', resolved_at=NOW()
      WHERE sos_event_id=$1 AND status NOT IN ('RESOLVED')
      RETURNING team_id`,
      [sosEventId]
    )
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
