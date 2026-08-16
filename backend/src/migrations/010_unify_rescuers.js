/* eslint-disable camelcase */
// src/migrations/010_unify_rescuers.js
// Unifies volunteers and official rescue team members into one assignable
// "Rescuer" identity, without touching the two existing systems' own
// semantics: rescue_assignments stays "govt's manual single pick" and
// volunteer_dispatches stays "automatic proximity broadcast" — this
// migration only widens rescue_assignments to accept a volunteer as well
// as a team, and gives volunteers/live rescuers a home for their current
// road position so the map can actually move.

exports.up = (pgm) => {
  // ── volunteers: can now represent an official rescue-team member too ───
  pgm.addColumns('volunteers', {
    // VOLUNTEER (citizen, self-registered) | OFFICIAL (govt rescue-team
    // member, linked via team_id below) — same login/app either way.
    rescuer_type: { type: 'varchar(20)', notNull: true, default: 'VOLUNTEER' },
    team_id:      { type: 'uuid', references: '"rescue_teams"', onDelete: 'SET NULL' },
  })

  // volunteers.status is a plain varchar with no CHECK constraint (see
  // migration 009), so adding DEPLOYED as a new value VOLUNTEER_STATUSES
  // now allows is purely an application-layer change — nothing to alter
  // here at the schema level.

  // ── rescue_assignments: team_id becomes optional, volunteer_id is new ──
  pgm.alterColumn('rescue_assignments', 'team_id', { notNull: false })
  pgm.addColumns('rescue_assignments', {
    volunteer_id: { type: 'uuid', references: '"volunteers"', onDelete: 'RESTRICT' },
    // Last-known position of whoever is en route on this assignment —
    // mirrors tourist_locations' "just the latest point" shape rather than
    // a new time-series table, since only the current position is ever
    // shown on a map.
    rescuer_latitude:            { type: 'decimal(10,8)' },
    rescuer_longitude:           { type: 'decimal(11,8)' },
    rescuer_location_updated_at: { type: 'timestamptz' },
  })
  pgm.addConstraint('rescue_assignments', 'rescue_assignments_one_assignee',
    'CHECK ((team_id IS NOT NULL) != (volunteer_id IS NOT NULL))')

  pgm.createIndex('rescue_assignments', 'volunteer_id')
}

exports.down = (pgm) => {
  pgm.dropIndex('rescue_assignments', 'volunteer_id')
  pgm.dropConstraint('rescue_assignments', 'rescue_assignments_one_assignee')
  pgm.dropColumns('rescue_assignments', [
    'volunteer_id', 'rescuer_latitude', 'rescuer_longitude', 'rescuer_location_updated_at',
  ])
  pgm.alterColumn('rescue_assignments', 'team_id', { notNull: true })
  pgm.dropColumns('volunteers', ['rescuer_type', 'team_id'])
}
