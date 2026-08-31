/* eslint-disable camelcase */
// src/migrations/021_sos_category_amendment.js
// A tourist's emergency can turn out to be more than what they first
// selected -- triggered as LOST, but they're also now hurt and need
// MEDICAL too. Before this, the only way to signal that was informal chat,
// which isn't solid enough for govt/rescuer triage to rely on alone.
// category itself stays the tourist's original, primary classification
// (unchanged semantics, unchanged everywhere it's already read) --
// additional_categories is a append-only audit log of what's been added
// since, each entry timestamped. Same additive-columns-on-sos_events
// pattern 016_rescue_handoff.js already used for handoff verification.

exports.up = (pgm) => {
  pgm.addColumns('sos_events', {
    additional_categories: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    category_amended_at:   { type: 'timestamptz' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumns('sos_events', ['additional_categories', 'category_amended_at'])
}
