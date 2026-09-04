/* eslint-disable camelcase */
// src/migrations/032_curated_itineraries.js
// "Best travel plans" -- real, sourced multi-day itineraries a tourist can
// use as-is, surfaced on a destination's page and reachable from Explore.
// Deliberately NOT built on typical_routes (that table is point-to-point
// transport legs, not itinerary content -- a different concept). V1 is
// read-only/seeded, same "seed via script, verify via govt review" pattern
// local_operators (migration 027) already established -- no authoring UI
// this pass. `source` follows the same provenance discipline migration 026
// put on destinations/typical_routes: NOT NULL, no unsourced rows.
// `is_govt_approved` is a distinct, narrower claim from `source` -- source
// says where the itinerary was researched, is_govt_approved says a specific
// government tourism body actually put its name on this route (cited in
// govt_approval_ref when true). Don't conflate the two on the frontend.

exports.up = (pgm) => {
  pgm.createTable('curated_itineraries', {
    id:                 { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    title:              { type: 'varchar(255)', notNull: true },
    region:             { type: 'varchar(100)', notNull: true }, // matches destinations.state
    days:               { type: 'smallint', notNull: true },
    summary:            { type: 'text' },
    // Ordered array of { destinationId, city, state, days } -- enough to
    // pre-fill /trips/new the same way the AI Travel Assistant's own
    // extractIntent result does, not a full trip Stop record.
    stops:              { type: 'jsonb', notNull: true },
    source:             { type: 'text', notNull: true },
    is_govt_approved:   { type: 'boolean', notNull: true, default: false },
    govt_approval_ref:  { type: 'text' }, // citation of the specific scheme/dept, when is_govt_approved is true
    is_active:          { type: 'boolean', notNull: true, default: true },
    created_at:         { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })
  pgm.createIndex('curated_itineraries', ['region', 'is_active'])
}

exports.down = (pgm) => {
  pgm.dropTable('curated_itineraries')
}
