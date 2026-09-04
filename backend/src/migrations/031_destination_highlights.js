/* eslint-disable camelcase */
// src/migrations/031_destination_highlights.js
// "What makes this place unique" -- a short list of curated highlight
// bullets per destination, surfaced on the new DestinationDetailPage. Shares
// the destination's existing `source` column (migration 026) rather than
// adding per-item provenance -- same reasoning that migration's own header
// comment already gives for keeping this a lightweight addition, not a new
// sources/claims schema.

exports.up = (pgm) => {
  pgm.addColumn('destinations', {
    highlights: { type: 'jsonb', notNull: true, default: '[]' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('destinations', 'highlights')
}
