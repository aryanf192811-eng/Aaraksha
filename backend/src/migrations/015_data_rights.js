/* eslint-disable camelcase */
// src/migrations/015_data_rights.js
// Audit trail for Digital Personal Data Protection Act, 2023 (DPDP)
// erasure requests — the Act came into force in phases starting
// 13 November 2025 and applies squarely to this platform: govt ID,
// health data (blood group, medical notes), and live location are all
// "personal data" under Section 2. A Data Protection Officer or the
// Data Protection Board would expect exactly this kind of record: who
// asked, when, what was decided, and why — not just a silent delete.

exports.up = (pgm) => {
  pgm.createTable('data_deletion_requests', {
    id:            { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:    { type: 'uuid', references: '"tourists"', onDelete: 'SET NULL' },
    status:        { type: 'varchar(20)', notNull: true, default: 'PENDING' }, // PENDING | COMPLETED | DENIED
    reason:        { type: 'text' }, // populated when DENIED — e.g. an open SOS/E-FIR the law requires retaining
    requested_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    processed_at:  { type: 'timestamptz' },
  })
  pgm.createIndex('data_deletion_requests', 'tourist_id')
}

exports.down = (pgm) => {
  pgm.dropTable('data_deletion_requests', { ifExists: true })
}
