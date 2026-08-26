/* eslint-disable camelcase */
// src/migrations/012_incident_reports.js
// E-FIR-style triage workflow — a tourist filing "someone stole my bag" or
// "a guide harassed me" needs a formal, trackable record routed to an
// officer, not just a crowd-sourced warning for other travellers (that's
// what scam_reports already is — see migration 001). This is the gap: a
// role-based officer queue with a real investigation status ladder,
// distinct from the automatic real-time SOS pipeline (sos_events), which
// is for active emergencies, not after-the-fact reports.

exports.up = (pgm) => {
  // Sequential, human-readable case numbers (EFIR-2026-000001) — a plain
  // sequence rather than counting rows, so a deleted/rolled-back row can
  // never cause a number to be reused.
  pgm.createSequence('incident_case_seq', { start: 1 })

  pgm.createTable('incident_reports', {
    id:                { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    case_number:       { type: 'varchar(20)', notNull: true, unique: true },
    tourist_id:        { type: 'uuid', references: '"tourists"', onDelete: 'SET NULL' },
    trip_id:           { type: 'uuid', references: '"trips"',    onDelete: 'SET NULL' },
    // THEFT | HARASSMENT | ASSAULT | FRAUD | LOST_DOCUMENT | VEHICLE_ACCIDENT
    // | PROPERTY_DAMAGE | OTHER — see constants/enums.js INCIDENT_CATEGORIES
    category:          { type: 'varchar(30)', notNull: true },
    description:       { type: 'text', notNull: true },
    // Free-text place name plus optional coordinates — unlike an SOS this is
    // very often reported after the fact (a theft noticed back at the
    // hotel), so a live GPS fix isn't always available or even meaningful.
    location_text:     { type: 'varchar(255)' },
    latitude:           { type: 'decimal(10,8)' },
    longitude:          { type: 'decimal(11,8)' },
    incident_occurred_at: { type: 'timestamptz' },
    priority:          { type: 'varchar(10)', notNull: true, default: 'MEDIUM' },
    status:            { type: 'varchar(30)', notNull: true, default: 'FILED' },
    assigned_officer_id: { type: 'uuid', references: '"govt_users"', onDelete: 'SET NULL' },
    assigned_at:       { type: 'timestamptz' },
    resolution_notes:  { type: 'text' },
    resolved_at:       { type: 'timestamptz' },
    filed_at:          { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:        { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // Tourist's own "my reports" list.
  pgm.createIndex('incident_reports', 'tourist_id')
  // Govt queue's default view (unassigned/open, newest first) and per-officer
  // "my cases" filter.
  pgm.createIndex('incident_reports', ['status', 'filed_at'])
  pgm.createIndex('incident_reports', 'assigned_officer_id')

  pgm.sql(`
    CREATE TRIGGER trg_incident_reports_updated_at
      BEFORE UPDATE ON incident_reports
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `)
}

exports.down = (pgm) => {
  pgm.dropTable('incident_reports', { ifExists: true, cascade: true })
  pgm.dropSequence('incident_case_seq', { ifExists: true })
}
