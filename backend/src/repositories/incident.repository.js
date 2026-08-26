// src/repositories/incident.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class IncidentRepository extends BaseRepository {
  // EFIR-2026-000001 — a plain sequence formatted at insert time, not a
  // stored/incrementing column, so a rolled-back transaction never burns a
  // number the way a naive COUNT(*)+1 scheme could under concurrent filings.
  async nextCaseNumber() {
    const row = await this.queryOne(`SELECT nextval('incident_case_seq') as n`)
    const year = new Date().getFullYear()
    return `EFIR-${year}-${String(row.n).padStart(6, '0')}`
  }

  async create(data) {
    const caseNumber = await this.nextCaseNumber()
    return this.queryOne(`
      INSERT INTO incident_reports (
        case_number, tourist_id, trip_id, category, description,
        location_text, latitude, longitude, incident_occurred_at, priority
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        caseNumber, data.touristId, data.tripId ?? null, data.category, data.description,
        data.locationText ?? null, data.latitude ?? null, data.longitude ?? null,
        data.incidentOccurredAt ?? null, data.priority || 'MEDIUM',
      ]
    )
  }

  async findById(id) {
    return this.queryOne(`
      SELECT ir.*, t.full_name, t.phone, t.blood_group, t.govt_id_suffix,
        trip.title as trip_title,
        gu.name as assigned_officer_name, gu.role as assigned_officer_role
      FROM incident_reports ir
      LEFT JOIN tourists t ON t.id = ir.tourist_id
      LEFT JOIN trips trip ON trip.id = ir.trip_id
      LEFT JOIN govt_users gu ON gu.id = ir.assigned_officer_id
      WHERE ir.id = $1`,
      [id]
    )
  }

  async findByTouristId(touristId) {
    return this.query(`
      SELECT ir.*, gu.name as assigned_officer_name
      FROM incident_reports ir
      LEFT JOIN govt_users gu ON gu.id = ir.assigned_officer_id
      WHERE ir.tourist_id = $1
      ORDER BY ir.filed_at DESC`,
      [touristId]
    )
  }

  // Govt officer queue — filterable by status and "assigned to me", the two
  // axes an officer actually triages by (SOSRepository.findActive is the
  // closest existing precedent for this filter+paginate shape).
  async findQueue(filters = {}) {
    const conditions = ['1=1']
    const params = []
    let idx = 1

    if (filters.status) { conditions.push(`ir.status = $${idx}`); params.push(filters.status); idx++ }
    if (filters.category) { conditions.push(`ir.category = $${idx}`); params.push(filters.category); idx++ }
    if (filters.assignedOfficerId) { conditions.push(`ir.assigned_officer_id = $${idx}`); params.push(filters.assignedOfficerId); idx++ }
    if (filters.unassigned) { conditions.push('ir.assigned_officer_id IS NULL') }

    const total = await this.queryCount(
      `SELECT COUNT(*) FROM incident_reports ir WHERE ${conditions.join(' AND ')}`, params
    )

    const rows = await this.query(`
      SELECT ir.*, t.full_name, t.phone,
        gu.name as assigned_officer_name
      FROM incident_reports ir
      LEFT JOIN tourists t ON t.id = ir.tourist_id
      LEFT JOIN govt_users gu ON gu.id = ir.assigned_officer_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE ir.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
        ir.filed_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit || 20, filters.offset || 0]
    )

    return { rows, total }
  }

  async assign(id, officerId) {
    return this.queryOne(`
      UPDATE incident_reports
      SET assigned_officer_id=$2, assigned_at=NOW(),
          status = CASE WHEN status = 'FILED' THEN 'ASSIGNED' ELSE status END
      WHERE id=$1
      RETURNING *`,
      [id, officerId]
    )
  }

  async updateStatus(id, status, resolutionNotes, priority) {
    const isClosing = status === 'RESOLVED' || status === 'CLOSED'
    return this.queryOne(`
      UPDATE incident_reports
      SET status=$2,
          resolution_notes = COALESCE($3, resolution_notes),
          resolved_at = CASE WHEN $4 THEN NOW() ELSE resolved_at END,
          priority = COALESCE($5, priority)
      WHERE id=$1
      RETURNING *`,
      [id, status, resolutionNotes ?? null, isClosing, priority ?? null]
    )
  }

  // Govt "who can I hand this off to" list for the assignment dropdown —
  // POLICE is the natural investigating role, DISTRICT_ADMIN/SUPER_ADMIN
  // can also carry cases in districts too small to have a dedicated officer.
  async findAssignableOfficers() {
    return this.query(`
      SELECT id, name, role, district
      FROM govt_users
      WHERE role IN ('POLICE', 'DISTRICT_ADMIN', 'SUPER_ADMIN')
      ORDER BY name`
    )
  }
}

module.exports = { IncidentRepository }
