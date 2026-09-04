/* eslint-disable camelcase */
// src/migrations/030_tourist_local_points.js
// Closes the "Economic Boost" gap from the SIH analysis: safety alone
// doesn't directly drive tourists toward verified local operators over
// aggregators. Mirrors volunteers.points (migration 009) exactly — a
// plain integer counter, no separate ledger table, awarded server-side in
// localOperatorReview.service.js#createReview. Deliberately tied to the
// review loop just built (migration 029): reviewing a provider is real,
// checkable evidence of an actual interaction, unlike a booking system
// this project has explicitly chosen not to build.

exports.up = (pgm) => {
  pgm.addColumn('tourists', {
    local_points: { type: 'integer', notNull: true, default: 0 },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('tourists', 'local_points')
}
