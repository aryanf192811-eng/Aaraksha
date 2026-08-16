/* eslint-disable camelcase */
// src/migrations/009_volunteers.js
// Volunteer SOS network — verified local volunteers get alerted alongside
// official rescue teams, with a lightweight points/reputation system.
// Volunteers are a genuinely distinct actor (own identity, own consent
// flow) — not a govt_users sub-role like CHECKPOINT_OFFICER, since that
// pattern is for roles inside the same government trust boundary.

exports.up = (pgm) => {
  pgm.createTable('volunteers', {
    id:              { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    full_name:       { type: 'varchar(255)', notNull: true },
    phone:           { type: 'varchar(20)', notNull: true, unique: true },
    password_hash:   { type: 'text', notNull: true },
    govt_id_type:    { type: 'varchar(30)', notNull: true },
    govt_id_hash:    { type: 'varchar(64)', notNull: true, unique: true },
    govt_id_suffix:  { type: 'char(4)', notNull: true },
    district:        { type: 'varchar(100)', notNull: true },
    state:           { type: 'varchar(100)', notNull: true },
    latitude:        { type: 'decimal(10,8)' },
    longitude:       { type: 'decimal(11,8)' },
    // Govt-reviewed before a volunteer can be alerted or alert anyone —
    // the identity check (govt ID hash) alone isn't consent to dispatch
    // strangers to someone's exact GPS location.
    is_verified:     { type: 'boolean', notNull: true, default: false },
    points:          { type: 'integer', notNull: true, default: 0 },
    status:          { type: 'varchar(30)', notNull: true, default: 'AVAILABLE' },
    is_active:       { type: 'boolean', notNull: true, default: true },
    created_at:      { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // Prefilter for proximity matching — no PostGIS in this project (see
  // Architecture.md), so findVerifiedNearby() does a plain bounding-box
  // SQL prefilter on eligible rows, then haversine in JS on the (small)
  // remainder. This index is what keeps that prefilter cheap.
  pgm.createIndex('volunteers', ['is_verified', 'is_active', 'status'])

  pgm.createTable('volunteer_dispatches', {
    id:             { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    sos_event_id:   { type: 'uuid', notNull: true, references: '"sos_events"', onDelete: 'CASCADE' },
    volunteer_id:   { type: 'uuid', notNull: true, references: '"volunteers"', onDelete: 'RESTRICT' },
    // ALERTED / RESPONDED / COMPLETED / DECLINED — DECLINED is the
    // expected common case here (unlike an official team assignment,
    // this is a broadcast to many volunteers, not a single assignment).
    status:         { type: 'varchar(30)', notNull: true, default: 'ALERTED' },
    points_awarded: { type: 'integer', notNull: true, default: 0 },
    assigned_at:    { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    responded_at:   { type: 'timestamptz' },
    resolved_at:    { type: 'timestamptz' },
  })

  pgm.createIndex('volunteer_dispatches', 'sos_event_id')
  pgm.createIndex('volunteer_dispatches', 'volunteer_id')
}

exports.down = (pgm) => {
  pgm.dropTable('volunteer_dispatches')
  pgm.dropTable('volunteers')
}
