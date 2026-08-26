/* eslint-disable camelcase */
// src/migrations/013_checkpoint_scan_trip_link.js
// Links a checkpoint scan to the trip that was active at scan time, so the
// Journey Integrity Hash chain (passport.service.js) can fold physical
// checkpoint pass-throughs into the same tamper-evident record as
// check-ins and SOS events. This is the concrete "blockchain-based Digital
// ID" piece of SIH25002: a govt officer's own QR scan becomes a
// cryptographically-linked entry in the tourist's journey record, not just
// an isolated audit-log row.

exports.up = (pgm) => {
  pgm.addColumns('checkpoint_scans', {
    trip_id: { type: 'uuid', references: '"trips"', onDelete: 'SET NULL' },
  })
  pgm.createIndex('checkpoint_scans', 'trip_id')
}

exports.down = (pgm) => {
  pgm.dropColumns('checkpoint_scans', ['trip_id'])
}
