/* eslint-disable camelcase */
// src/migrations/029_local_operator_reviews.js
// Closes the "Trust Economy" gap: local_operators (migration 027) has been
// 100% government-curated with no feedback loop — real tourism trust is
// dynamic, and a govt reviewer can't re-verify a homestay's quality every
// week. This is the crowdsourced half: a tourist who actually used a
// provider rates it, separate from destination_reviews (a real traveller's
// trip experience of a PLACE) — this is specifically about a BUSINESS.
//
// Deliberately lean compared to destination_reviews' rich form (crowd
// level, cost, cleanliness, etc.) — a homestay/guide/artisan doesn't need
// that shape, just "would you recommend this" plus a real rating.

exports.up = (pgm) => {
  pgm.createTable('local_operator_reviews', {
    id:                { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    local_operator_id: { type: 'uuid', notNull: true, references: '"local_operators"', onDelete: 'CASCADE' },
    tourist_id:         { type: 'uuid', notNull: true, references: '"tourists"',       onDelete: 'CASCADE' },
    trip_id:            { type: 'uuid', references: '"trips"', onDelete: 'SET NULL' },
    rating:             { type: 'smallint', notNull: true },
    review_text:        { type: 'text' },
    created_at:         { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.addConstraint('local_operator_reviews', 'local_operator_reviews_rating_range', {
    check: 'rating BETWEEN 1 AND 5',
  })

  // One review per tourist per provider — resubmitting should be an edit,
  // not a second entry inflating the average (same rule destination_reviews
  // already enforces).
  pgm.addConstraint('local_operator_reviews', 'local_operator_reviews_tourist_operator_unique', {
    unique: ['local_operator_id', 'tourist_id'],
  })

  pgm.createIndex('local_operator_reviews', 'local_operator_id')
}

exports.down = (pgm) => {
  pgm.dropTable('local_operator_reviews')
}
