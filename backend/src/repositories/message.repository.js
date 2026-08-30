// src/repositories/message.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class MessageRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO messages (conversation_type, tourist_id, sos_event_id, sender_kind, sender_id, body)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *`,
      [data.conversationType, data.touristId, data.sosEventId ?? null, data.senderKind, data.senderId ?? null, data.body]
    )
  }

  async findByTouristGuardianThread(touristId, limit = 50) {
    return this.query(`
      SELECT * FROM messages
      WHERE tourist_id = $1 AND conversation_type = 'TOURIST_GUARDIAN'
      ORDER BY created_at DESC LIMIT $2`,
      [touristId, limit]
    )
  }

  async findByRescueThread(sosEventId, limit = 50) {
    return this.query(`
      SELECT * FROM messages
      WHERE sos_event_id = $1 AND conversation_type = 'TOURIST_RESCUER'
      ORDER BY created_at DESC LIMIT $2`,
      [sosEventId, limit]
    )
  }
}

module.exports = { MessageRepository }
