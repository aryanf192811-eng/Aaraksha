/* eslint-disable camelcase */
// src/migrations/022_trust_score.js
// Anti-fraud, crowd-management trust score for TOURISTS (the volunteer
// reputation `points` column is a different mechanism — that one only ever
// goes up; this one can drop, because the failure mode it defends against
// is different: a bad-faith account tying up scarce rescue capacity, not a
// helper who just hasn't logged much activity yet).
//
// Hard rule baked into how this is used everywhere downstream (see
// trustScore.service.js): a restricted account can ALWAYS still trigger a
// real SOS. trust_restricted_at gates convenience/community features and
// adds govt scrutiny to a flagged trigger — it never blocks the emergency
// path. tourist_trust_events is the full audit trail (every delta, why,
// who decided it); tourist_trust_appeals is the tourist-initiated "plea"
// review queue, mirroring the govt volunteer-verification queue's shape.

exports.up = (pgm) => {
  pgm.addColumns('tourists', {
    trust_score:         { type: 'smallint', notNull: true, default: 100 },
    // null = not restricted. Stamped once on first crossing below the
    // restriction threshold; cleared on a successful appeal.
    trust_restricted_at: { type: 'timestamptz' },
  })

  // A frozen-at-trigger-time snapshot, not a live join to tourists.trust_score
  // -- if the score later moves (an appeal gets approved, say), an SOS from
  // while the account was flagged should still show as having been flagged
  // at the time. Govt sees this as "verify carefully," never as grounds to
  // dismiss the SOS.
  pgm.addColumn('sos_events', {
    low_trust_at_trigger: { type: 'boolean', notNull: true, default: false },
  })

  pgm.createTable('tourist_trust_events', {
    id:                      { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:               { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    delta:                    { type: 'smallint', notNull: true },
    // CONFIRMED_FRAUDULENT_SOS | CLUSTER_ABUSE_CONFIRMED | HONEST_FALSE_ALARM
    // | TRIP_COMPLETED_CLEAN | COMMUNITY_CONTRIBUTION | APPEAL_APPROVED_RESET
    reason_code:              { type: 'varchar(40)', notNull: true },
    reason_text:              { type: 'text' },
    related_sos_id:           { type: 'uuid', references: '"sos_events"', onDelete: 'SET NULL' },
    // SYSTEM | GOVT -- who/what decided this. A govt-initiated event also
    // carries created_by_govt_user_id; a SYSTEM one (trip completed clean,
    // honest false alarm, a review posted) doesn't.
    created_by_kind:          { type: 'varchar(10)', notNull: true },
    created_by_govt_user_id:  { type: 'uuid', references: '"govt_users"', onDelete: 'SET NULL' },
    created_at:               { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })
  pgm.createIndex('tourist_trust_events', ['tourist_id', 'created_at'])

  pgm.createTable('tourist_trust_appeals', {
    id:               { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:        { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    message:           { type: 'text', notNull: true },
    status:            { type: 'varchar(20)', notNull: true, default: 'PENDING' },  // PENDING | APPROVED | REJECTED
    reviewed_by:       { type: 'uuid', references: '"govt_users"', onDelete: 'SET NULL' },
    reviewed_at:       { type: 'timestamptz' },
    resolution_notes:  { type: 'text' },
    created_at:        { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })
  pgm.createIndex('tourist_trust_appeals', ['tourist_id', 'status'])
}

exports.down = (pgm) => {
  pgm.dropTable('tourist_trust_appeals')
  pgm.dropTable('tourist_trust_events')
  pgm.dropColumns('tourists', ['trust_score', 'trust_restricted_at'])
  pgm.dropColumn('sos_events', 'low_trust_at_trigger')
}
