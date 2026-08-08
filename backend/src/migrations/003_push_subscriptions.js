/* eslint-disable camelcase */
// src/migrations/003_push_subscriptions.js
// Web Push subscriptions — lets a tourist receive SOS/weather/group alerts
// as an OS-level notification even when the app tab isn't open or focused.
// One tourist can have several rows (one per device/browser they enabled it on).

exports.up = (pgm) => {
  pgm.createTable('push_subscriptions', {
    id:         { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id: { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    endpoint:   { type: 'text', notNull: true, unique: true },
    p256dh:     { type: 'text', notNull: true },
    auth:       { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.createIndex('push_subscriptions', 'tourist_id')
}

exports.down = (pgm) => {
  pgm.dropTable('push_subscriptions')
}
