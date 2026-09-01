/* eslint-disable camelcase */
// src/migrations/025_typical_routes.js
// Curated reference legs between destinations -- a small, purpose-built
// table, not a graph database. No live IRCTC/flight booking data (no free
// reliable source for that); these are honest, hand-curated typical
// ranges, grown over time via the chatbot.md-tracked dataset-curation
// process. See services/travelPlanner.service.js.

exports.up = (pgm) => {
  pgm.createTable('typical_routes', {
    id:                  { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    from_destination_id: { type: 'uuid', notNull: true, references: '"destinations"', onDelete: 'CASCADE' },
    to_destination_id:   { type: 'uuid', notNull: true, references: '"destinations"', onDelete: 'CASCADE' },
    // TRAIN | SHARED_TAXI | BUS | FLIGHT | LOCAL_TRANSPORT
    mode:                { type: 'varchar(30)', notNull: true },
    duration_minutes:    { type: 'integer', notNull: true },
    cost_min_inr:        { type: 'integer', notNull: true },
    cost_max_inr:        { type: 'integer', notNull: true },
    notes:               { type: 'text' },
    created_at:           { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })
  pgm.createIndex('typical_routes', ['from_destination_id', 'to_destination_id'])
}

exports.down = (pgm) => {
  pgm.dropTable('typical_routes')
}
