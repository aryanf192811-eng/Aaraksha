// src/repositories/curatedItinerary.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class CuratedItineraryRepository extends BaseRepository {
  async findByRegion(region) {
    return this.query(
      `SELECT * FROM curated_itineraries WHERE region = $1 AND is_active = TRUE ORDER BY is_govt_approved DESC, days ASC`,
      [region]
    )
  }
}

module.exports = { CuratedItineraryRepository }
