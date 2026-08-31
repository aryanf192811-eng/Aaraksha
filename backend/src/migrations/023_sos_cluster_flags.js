/* eslint-disable camelcase */
// src/migrations/023_sos_cluster_flags.js
// Multiple SOS from the same nearby location/time window is a priority
// signal, not a verdict -- it could be a real mass-incident (a landslide,
// a bus crash) just as easily as coordinated fake-SOS abuse. status starts
// OPEN ("needs human triage"), same audited-govt-review posture as
// safety_anomalies (migration 011) -- detection never resolves itself,
// only a govt decision does (see sosCluster.service.js).

exports.up = (pgm) => {
  pgm.createTable('sos_cluster_flags', {
    id:                 { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    sos_event_ids:       { type: 'uuid[]', notNull: true },
    center_latitude:     { type: 'decimal(10,8)', notNull: true },
    center_longitude:    { type: 'decimal(11,8)', notNull: true },
    tourist_count:        { type: 'smallint', notNull: true },
    // How many distinct categories are involved -- surfaced deliberately so
    // govt can reason about it themselves (3x DISASTER in 200m/5min reads
    // very differently from 3 different categories from 3 tourists who
    // happen to be at the same crowded viewpoint).
    category_diversity:   { type: 'smallint', notNull: true },
    // OPEN | INVESTIGATING | CONFIRMED_INCIDENT | CONFIRMED_ABUSE | DISMISSED
    status:               { type: 'varchar(20)', notNull: true, default: 'OPEN' },
    resolved_by:           { type: 'uuid', references: '"govt_users"', onDelete: 'SET NULL' },
    resolved_at:           { type: 'timestamptz' },
    resolution_notes:      { type: 'text' },
    created_at:            { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })
  pgm.createIndex('sos_cluster_flags', ['status'])
}

exports.down = (pgm) => {
  pgm.dropTable('sos_cluster_flags')
}
