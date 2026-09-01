/* eslint-disable camelcase */
// src/migrations/024_ntn_messages.js
// Append-only audit trail for every simulated NTN (satellite) uplink
// attempt -- delivered or not. Same posture as safety_anomalies/
// tourist_trust_events: a full record of what the channel simulator
// reported, independent of whether it resulted in a real sos_events row.
// See simulators/ntnChannel.js and ntn.service.js.

exports.up = (pgm) => {
  pgm.createTable('ntn_messages', {
    id:              { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:      { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    // Null when the uplink failed/was lost -- no SOS was ever created.
    sos_event_id:    { type: 'uuid', references: '"sos_events"', onDelete: 'SET NULL' },
    // Cosmetic simulated satellite label, e.g. 'ARAK-LEO-1'.
    satellite_id:    { type: 'varchar(20)', notNull: true },
    // CLEAR_SKY | MOUNTAIN_VALLEY | NO_VISIBILITY -- which simulated
    // channel condition was active for this attempt.
    scenario:        { type: 'varchar(20)', notNull: true },
    signal_pct:      { type: 'smallint', notNull: true },
    latency_ms:      { type: 'integer', notNull: true },
    packet_loss_pct: { type: 'smallint', notNull: true },
    // DELIVERED | FAILED
    status:          { type: 'varchar(20)', notNull: true },
    created_at:      { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })
  pgm.createIndex('ntn_messages', ['tourist_id'])
  pgm.createIndex('ntn_messages', ['created_at'])
}

exports.down = (pgm) => {
  pgm.dropTable('ntn_messages')
}
