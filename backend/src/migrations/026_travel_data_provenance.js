/* eslint-disable camelcase */
// src/migrations/026_travel_data_provenance.js
// Adds a `source` field to the two tables the chatbot.md dataset-curation
// process actively grows. Not a full sources/claims schema (that's real
// scope creep for what's needed right now) -- just enough that every
// curated fact has a checkable origin, so a curation agent literally
// cannot insert a plausible-sounding but unsourced row: the column is
// NOT NULL. destination_reviews needs no such column -- its provenance is
// already "a real Aaraksha user," which is stronger than a citation.

exports.up = (pgm) => {
  pgm.addColumn('destinations', {
    // e.g. "Ministry of Tourism NE Circuit data, 2024" or "OpenStreetMap
    // node <id>" -- a human-checkable citation, not a URL-shaped guarantee.
    source: { type: 'text' },
  })
  pgm.addColumn('typical_routes', {
    source: { type: 'text', notNull: true, default: 'Hand-curated, unsourced (pre-provenance-policy row)' },
  })
  // Existing rows get the default above so the NOT NULL backfills cleanly;
  // new rows from here on must pass a real source explicitly -- see
  // chatbot.md's "How to add data" section.
  pgm.alterColumn('typical_routes', 'source', { default: null })
}

exports.down = (pgm) => {
  pgm.dropColumn('destinations', 'source')
  pgm.dropColumn('typical_routes', 'source')
}
