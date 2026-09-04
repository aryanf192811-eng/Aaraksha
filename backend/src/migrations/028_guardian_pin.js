/* eslint-disable camelcase */
// src/migrations/028_guardian_pin.js
// Closes the "guardian token leakage" gap: the Guardian Portal link is a
// bare token in the URL (frontend/guardian's whole auth model) — if a
// tourist posts it publicly, anyone can open live tracking. A 4-digit PIN,
// shared with the guardian over a separate channel (a call, in person),
// gates the actual tracking view behind something the link alone doesn't
// carry. Nullable + backfilled for every existing tourist so no current
// guardian link breaks; new registrations always get one (see
// auth.service.js#registerTourist).

exports.up = (pgm) => {
  pgm.addColumn('tourists', {
    guardian_pin: { type: 'varchar(4)' },
  })

  // Backfill so every tourist who registered before this migration still
  // has a working (if freshly-assigned) PIN rather than an indefinitely
  // PIN-less guardian link — a null PIN would otherwise force every
  // existing guardian link to zero-friction bypass or a permanent lockout,
  // neither of which is the intent.
  pgm.sql(`
    UPDATE tourists
    SET guardian_pin = lpad(floor(random() * 10000)::int::text, 4, '0')
    WHERE guardian_pin IS NULL
  `)

  pgm.alterColumn('tourists', 'guardian_pin', { notNull: true })
}

exports.down = (pgm) => {
  pgm.dropColumn('tourists', 'guardian_pin')
}
