// src/repositories/checkpoint.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class CheckpointRepository extends BaseRepository {
  async create({ touristId, govtUserId, checkpointName, district }) {
    return this.queryOne(`
      INSERT INTO checkpoint_scans (tourist_id, govt_user_id, checkpoint_name, district)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [touristId, govtUserId, checkpointName, district ?? null]
    )
  }

  // Recent scans across all checkpoints — the officer's own session log,
  // not filtered to their checkpoint alone, since staff often rotate posts.
  async findRecent(limit = 20) {
    return this.query(`
      SELECT cs.id, cs.checkpoint_name, cs.district, cs.scanned_at,
        t.full_name as tourist_name, t.phone as tourist_phone,
        gu.name as scanned_by
      FROM checkpoint_scans cs
      JOIN tourists t ON t.id = cs.tourist_id
      LEFT JOIN govt_users gu ON gu.id = cs.govt_user_id
      ORDER BY cs.scanned_at DESC
      LIMIT $1`,
      [limit]
    )
  }

  async findByTouristId(touristId, limit = 20) {
    return this.query(`
      SELECT id, checkpoint_name, district, scanned_at
      FROM checkpoint_scans
      WHERE tourist_id = $1
      ORDER BY scanned_at DESC
      LIMIT $2`,
      [touristId, limit]
    )
  }
}

module.exports = { CheckpointRepository }
