/* eslint-disable camelcase */
// src/migrations/027_local_operators.js
// Verified local tourism providers (hotels, homestays, guides, artisan/handicraft
// experiences) surfaced inside the trip a tourist is already planning — the
// tourism-*industry* answer to SIH PS 26204's "including hotels, travel and
// others", deliberately not a booking/payments system (see chatbot.md's
// "New pillar — Local Tourism Enablement" section for the full reasoning).
//
// Mirrors volunteers (migration 009) on purpose: a local operator is a
// real-world entity with a sourced identity that is NOT safe to surface to a
// tourist until a government reviewer has verified it — same shape of trust,
// citation + is_verified gate, not either alone. Unlike volunteers, there's
// no self-registration/login here — rows are seeded via the chatbot.md
// dataset-curation workflow (same discipline as typical_routes, migration
// 026: a required, checkable `source`) and reviewed through the govt portal.

exports.up = (pgm) => {
  pgm.createTable('local_operators', {
    id:               { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    business_name:    { type: 'varchar(255)', notNull: true },
    // HOTEL / HOMESTAY / GUIDE / EXPERIENCE / ARTISAN — plain text, no CHECK
    // constraint, same convention as volunteers.status / rescue_teams.type.
    category:         { type: 'varchar(30)', notNull: true },
    destination_id:   { type: 'uuid', notNull: true, references: '"destinations"', onDelete: 'CASCADE' },
    district:         { type: 'varchar(100)', notNull: true },
    state:            { type: 'varchar(100)', notNull: true },
    contact_phone:    { type: 'varchar(20)' },
    description:      { type: 'text' },
    price_range_text: { type: 'varchar(100)' },
    // Required, same provenance discipline as typical_routes (migration 026)
    // — a curation agent cannot insert a plausible-sounding but unsourced row.
    source:           { type: 'text', notNull: true },
    // Govt-reviewed before a provider is shown to any tourist — the source
    // citation alone isn't consent to surface a real business's contact
    // details, same reasoning volunteers.is_verified already encodes.
    is_verified:      { type: 'boolean', notNull: true, default: false },
    verified_by:      { type: 'uuid', references: '"govt_users"', onDelete: 'SET NULL' },
    verified_at:      { type: 'timestamptz' },
    is_active:        { type: 'boolean', notNull: true, default: true },
    created_at:       { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // Every tourist-facing read path filters exactly this triple — see
  // localOperator.repository.js's findByDestinationId / getSummariesByDestinationIds.
  pgm.createIndex('local_operators', ['destination_id', 'is_verified', 'is_active'])
}

exports.down = (pgm) => {
  pgm.dropTable('local_operators')
}
