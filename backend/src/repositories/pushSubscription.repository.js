// src/repositories/pushSubscription.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class PushSubscriptionRepository extends BaseRepository {
  async add(touristId, { endpoint, keys }) {
    return this.queryOne(`
      INSERT INTO push_subscriptions (tourist_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint) DO UPDATE SET tourist_id = EXCLUDED.tourist_id
      RETURNING *`,
      [touristId, endpoint, keys.p256dh, keys.auth]
    )
  }

  async removeByEndpoint(endpoint) {
    return this.queryOne(
      `DELETE FROM push_subscriptions WHERE endpoint=$1 RETURNING id`,
      [endpoint]
    )
  }

  async findByTouristId(touristId) {
    return this.query(
      `SELECT * FROM push_subscriptions WHERE tourist_id=$1`,
      [touristId]
    )
  }
}

module.exports = { PushSubscriptionRepository }
