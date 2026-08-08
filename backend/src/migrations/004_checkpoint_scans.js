/* eslint-disable camelcase */
// src/migrations/004_checkpoint_scans.js
// QR check-in at govt checkpoints: a tourist shows a short-lived QR from
// their app, an officer scans it, and the scan is logged here — the audit
// trail of who passed through which checkpoint and when (relevant for
// ILP-required zones and general movement tracking in restricted districts).

exports.up = (pgm) => {
  pgm.createTable('checkpoint_scans', {
    id:              { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:      { type: 'uuid', notNull: true, references: '"tourists"',   onDelete: 'CASCADE' },
    govt_user_id:    { type: 'uuid', references: '"govt_users"', onDelete: 'SET NULL' },
    checkpoint_name: { type: 'varchar(255)', notNull: true },
    district:        { type: 'varchar(100)' },
    scanned_at:      { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.createIndex('checkpoint_scans', 'tourist_id')
  pgm.createIndex('checkpoint_scans', 'scanned_at')
}

exports.down = (pgm) => {
  pgm.dropTable('checkpoint_scans')
}
