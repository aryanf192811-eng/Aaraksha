/* eslint-disable camelcase */
// src/migrations/002_group_trips.js
// Group trips: a trip owner shares a short invite code, other tourists join
// as members. Enables shared visibility (see co-travelers' last known
// location on the trip) and SOS fan-out (a member's SOS alerts the rest of
// the group, not just emergency contacts).

exports.up = (pgm) => {
  pgm.addColumn('trips', {
    invite_code: { type: 'varchar(8)', unique: true },
  })

  pgm.createTable('trip_members', {
    id:         { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    trip_id:    { type: 'uuid', notNull: true, references: '"trips"',    onDelete: 'CASCADE' },
    tourist_id: { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    joined_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.addConstraint('trip_members', 'trip_members_trip_tourist_unique', {
    unique: ['trip_id', 'tourist_id'],
  })

  pgm.createIndex('trip_members', 'tourist_id')
}

exports.down = (pgm) => {
  pgm.dropTable('trip_members')
  pgm.dropColumn('trips', 'invite_code')
}
