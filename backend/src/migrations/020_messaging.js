// src/migrations/020_messaging.js
// In-app messaging, deliberately deferred out of the earlier rescue-handoff-
// verification pass to get the anti-fraud code+proximity gate right first.
// Two threads, one table with a conversation_type discriminator rather than
// two tables, since both anchor to the same tourist_id and share every
// other column:
//   - TOURIST_GUARDIAN: always available while the guardian link is valid,
//     not gated on an active SOS (sos_event_id stays null).
//   - TOURIST_RESCUER: scoped to one active rescue assignment (sos_event_id
//     set) — extends the existing tel: link the same conversation already
//     has, not a general-purpose thread with a stranger.
// Guardian has no real per-person identity (see tourists.guardian_token) —
// sender_id stays null for a GUARDIAN-authored row; every other sender_kind
// carries a real id.
/* eslint-disable camelcase */
'use strict'

exports.up = (pgm) => {
  pgm.createTable('messages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    conversation_type: { type: 'varchar(20)', notNull: true },
    tourist_id: { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    sos_event_id: { type: 'uuid', references: '"sos_events"', onDelete: 'CASCADE' },
    sender_kind: { type: 'varchar(20)', notNull: true },
    sender_id: { type: 'uuid' },
    body: { type: 'text', notNull: true },
    read_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.createIndex('messages', ['tourist_id', 'conversation_type', 'created_at'])
  pgm.createIndex('messages', ['sos_event_id'])
}

exports.down = (pgm) => {
  pgm.dropTable('messages')
}
