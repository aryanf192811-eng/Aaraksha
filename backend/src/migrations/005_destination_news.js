/* eslint-disable camelcase */
// src/migrations/005_destination_news.js
// Destination news & alerts feed. Content is curated/mocked for demo per
// spec (weather warnings, road closures, festival notices) rather than a
// live external news API integration — no new external dependency risk.
// Govt staff can also post real advisories through the same table, since
// they're the actual authority for local closures/restrictions.

exports.up = (pgm) => {
  pgm.createTable('destination_news', {
    id:             { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    destination_id: { type: 'uuid', notNull: true, references: '"destinations"', onDelete: 'CASCADE' },
    category:       { type: 'varchar(30)', notNull: true, default: 'ADVISORY' }, // WEATHER, ROAD_CLOSURE, EVENT, ADVISORY, FESTIVAL, OTHER
    severity:       { type: 'varchar(20)', notNull: true, default: 'INFO' },     // INFO, WARNING, CRITICAL
    headline:       { type: 'varchar(255)', notNull: true },
    body:           { type: 'text' },
    source:         { type: 'varchar(100)', notNull: true, default: 'Aaraksha Curated' },
    posted_by_govt_user_id: { type: 'uuid', references: '"govt_users"', onDelete: 'SET NULL' },
    published_at:   { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    created_at:     { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.createIndex('destination_news', 'destination_id')
  pgm.createIndex('destination_news', 'published_at')
}

exports.down = (pgm) => {
  pgm.dropTable('destination_news')
}
