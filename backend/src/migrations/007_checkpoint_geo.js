/* eslint-disable camelcase */
// src/migrations/007_checkpoint_geo.js
// The checkpoint scanner now auto-captures the officer's device GPS instead
// of relying on typed-in checkpoint name/district — these columns are where
// that reading actually lands, so a scan carries real coordinates, not just
// a free-text label.

exports.up = (pgm) => {
  pgm.addColumns('checkpoint_scans', {
    latitude:  { type: 'decimal(10,7)' },
    longitude: { type: 'decimal(10,7)' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumns('checkpoint_scans', ['latitude', 'longitude'])
}
