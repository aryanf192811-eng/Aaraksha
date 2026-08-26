/* eslint-disable camelcase */
// src/migrations/011_safety_anomalies.js
// Always-on anomaly detection — SIH25002 (the problem statement this app
// is built for) explicitly calls for detecting "sudden location drop-offs,
// prolonged inactivity, or deviation from planned routes," independent of
// whether the tourist opted into a Dead Man's Switch. DMS already covers
// the opt-in case; this is the automatic safety net underneath it, for
// every tourist on an active trip whether or not they ever touch DMS.

exports.up = (pgm) => {
  pgm.createTable('safety_anomalies', {
    id:                    { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:            { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    trip_id:               { type: 'uuid', references: '"trips"', onDelete: 'CASCADE' },
    // INACTIVITY | ROUTE_DEVIATION — see constants/enums.js ANOMALY_TYPES
    type:                  { type: 'varchar(30)', notNull: true },
    // Last position we actually had when the anomaly was raised — may be
    // null for INACTIVITY when a tourist's location was never once
    // recorded after their trip went active.
    last_latitude:         { type: 'decimal(10,8)' },
    last_longitude:        { type: 'decimal(11,8)' },
    last_location_at:      { type: 'timestamptz' },
    // How far the last known position was from the nearest planned stop —
    // only meaningful for ROUTE_DEVIATION.
    distance_from_route_km:{ type: 'decimal(7,2)' },
    details:               { type: 'text' },
    status:                { type: 'varchar(20)', notNull: true, default: 'OPEN' },
    resolved_at:           { type: 'timestamptz' },
    resolved_by:           { type: 'uuid', references: '"govt_users"', onDelete: 'SET NULL' },
    detected_at:           { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // The detection cron's first query on every run is "does this tourist
  // already have an OPEN anomaly of this type" (avoid re-flagging the same
  // ongoing situation every cycle) — this is exactly that lookup.
  pgm.createIndex('safety_anomalies', ['tourist_id', 'type', 'status'])
  // Govt dashboard's "show me what needs attention" query.
  pgm.createIndex('safety_anomalies', ['status', 'detected_at'])
}

exports.down = (pgm) => {
  pgm.dropTable('safety_anomalies')
}
