/* eslint-disable camelcase */
// src/migrations/016_rescue_handoff.js
// Anti-fraud rescue handoff verification — resolving an SOS was previously
// a single, ungated govt action with nothing enforcing that the assigned
// rescuer (volunteer or official) actually reached the tourist. The
// tourist now holds a short-lived code (reusing the existing
// otp_verifications infrastructure, purpose RESCUE_HANDOFF — see
// handoff.service.js) that the rescuer must obtain from them in person and
// enter, from within the proximity threshold, before govt can resolve.
// These columns are the audit record of that verification (or of a govt
// override for the genuine edge case where verification isn't possible —
// tourist unconscious, phone destroyed).

exports.up = (pgm) => {
  pgm.addColumns('sos_events', {
    handoff_verified_at:      { type: 'timestamptz' },
    // VOLUNTEER | TEAM -- which side verified, for display/audit. Not a
    // foreign key to any one table since it's paired with the existing
    // rescue_assignments.volunteer_id/team_id, not a new identity.
    handoff_verified_by_kind: { type: 'varchar(20)' },
    handoff_override_at:      { type: 'timestamptz' },
    handoff_override_by:      { type: 'uuid', references: '"govt_users"', onDelete: 'SET NULL' },
    handoff_override_reason:  { type: 'text' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumns('sos_events', [
    'handoff_verified_at', 'handoff_verified_by_kind',
    'handoff_override_at', 'handoff_override_by', 'handoff_override_reason',
  ])
}
