// src/migrations/017_rescuer_exit_flow.js
// The rescue_assignments lifecycle was strictly linear -- ASSIGNED -> EN_ROUTE
// -> ARRIVED -> RESOLVED -- with no way for a volunteer to back out. Real
// field scenarios (vehicle breakdown, the volunteer becomes unsafe too, a
// higher-priority call, realizing on arrival the situation is beyond their
// capability) had no honest path: the only options were to keep silently
// "EN_ROUTE" forever or just stop updating, leaving govt and the tourist
// staring at stale rescuer info with no idea help isn't actually coming.
// Adds two new terminal assignment statuses (DECLINED, CANCELLED -- app-level
// only, `status` has never had a DB CHECK constraint) plus a reason/timestamp
// pair distinct from `resolved_at` (which stays govt-resolve-only semantics,
// unchanged, so existing report generation reading it isn't affected).
'use strict'

exports.up = (pgm) => {
  pgm.addColumns('rescue_assignments', {
    exit_reason: { type: 'text' },
    exited_at:   { type: 'timestamptz' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumns('rescue_assignments', ['exit_reason', 'exited_at'])
}
