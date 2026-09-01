// src/repositories/ntn.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class NTNRepository extends BaseRepository {
  async create({ touristId, sosEventId, satelliteId, scenario, signalPct, latencyMs, packetLossPct, status }) {
    return this.queryOne(
      `INSERT INTO ntn_messages
         (tourist_id, sos_event_id, satellite_id, scenario, signal_pct, latency_ms, packet_loss_pct, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [touristId, sosEventId ?? null, satelliteId, scenario, signalPct, latencyMs, packetLossPct, status]
    )
  }

  async findRecent(limit = 20) {
    return this.query(
      `SELECT nm.*, t.full_name AS tourist_name
       FROM ntn_messages nm
       JOIN tourists t ON t.id = nm.tourist_id
       ORDER BY nm.created_at DESC
       LIMIT $1`,
      [limit]
    )
  }
}

module.exports = { NTNRepository }
