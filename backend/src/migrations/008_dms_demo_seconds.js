/* eslint-disable camelcase */
// src/migrations/008_dms_demo_seconds.js
// Live demos to judges can't wait out a real 15-minute minimum interval —
// this adds a seconds-precision path alongside the existing minutes-based
// one, signaled by interval_minutes = 0 (never a real user's value).

exports.up = (pgm) => {
  pgm.addColumns('dead_mans_switches', {
    interval_seconds: { type: 'smallint' },
  })

  pgm.dropConstraint('dead_mans_switches', 'dms_interval_range')
  pgm.addConstraint('dead_mans_switches', 'dms_interval_range', `
    CHECK (
      (interval_minutes BETWEEN 15 AND 480)
      OR (interval_minutes = 0 AND interval_seconds BETWEEN 5 AND 120)
    )
  `)
}

exports.down = (pgm) => {
  pgm.dropConstraint('dead_mans_switches', 'dms_interval_range')
  pgm.addConstraint('dead_mans_switches', 'dms_interval_range',
    'CHECK (interval_minutes BETWEEN 15 AND 480)')
  pgm.dropColumns('dead_mans_switches', ['interval_seconds'])
}
