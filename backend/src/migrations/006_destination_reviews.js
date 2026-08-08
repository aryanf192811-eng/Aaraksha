/* eslint-disable camelcase */
// src/migrations/006_destination_reviews.js
// Community Experience System: real tourists' actual visit experiences,
// not a bare star rating — cost, time spent, crowd/cleanliness/safety
// perception, and free-text tips, so a future tourist gets something
// closer to "what it's actually like" than "⭐⭐⭐⭐⭐ Very good place."

exports.up = (pgm) => {
  pgm.createTable('destination_reviews', {
    id:                     { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    destination_id:         { type: 'uuid', notNull: true, references: '"destinations"', onDelete: 'CASCADE' },
    tourist_id:              { type: 'uuid', notNull: true, references: '"tourists"',   onDelete: 'CASCADE' },
    trip_id:                 { type: 'uuid', references: '"trips"', onDelete: 'SET NULL' },

    rating:                  { type: 'smallint', notNull: true }, // 1-5 overall
    review_text:              { type: 'text' },
    photo_urls:               { type: 'jsonb', notNull: true, default: '[]' },
    video_url:                { type: 'varchar(512)' },

    actual_cost_inr:          { type: 'integer' },
    time_spent_hours:         { type: 'real' },
    crowd_level:              { type: 'varchar(20)' },   // LOW, MEDIUM, HIGH
    cleanliness_rating:       { type: 'smallint' },       // 1-5
    felt_safe:                { type: 'varchar(20)' },    // YES, NO, SOMEWHAT
    transport_rating:         { type: 'smallint' },       // 1-5
    food_availability_rating: { type: 'smallint' },       // 1-5
    accessibility_rating:     { type: 'smallint' },       // 1-5

    liked_text:               { type: 'text' },
    disliked_text:            { type: 'text' },
    tips_text:                { type: 'text' },

    visited_date:             { type: 'date' },
    created_at:                { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.addConstraint('destination_reviews', 'destination_reviews_rating_range', {
    check: 'rating BETWEEN 1 AND 5',
  })

  // One review per tourist per destination — resubmitting should be an
  // edit, not a second entry inflating the average.
  pgm.addConstraint('destination_reviews', 'destination_reviews_tourist_destination_unique', {
    unique: ['destination_id', 'tourist_id'],
  })

  pgm.createIndex('destination_reviews', 'destination_id')
}

exports.down = (pgm) => {
  pgm.dropTable('destination_reviews')
}
