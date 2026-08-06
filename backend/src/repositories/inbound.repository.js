// src/repositories/inbound.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class InboundRepository extends BaseRepository {
  async create(fromPhone, rawBody) {
    return this.queryOne(
      `INSERT INTO inbound_sos_sms (from_phone, raw_body) VALUES ($1,$2) RETURNING *`,
      [fromPhone, rawBody]
    )
  }

  async markParsed(id, touristId, sosEventId) {
    return this.queryOne(
      `UPDATE inbound_sos_sms SET parsed=TRUE, tourist_id=$2, sos_event_id=$3 WHERE id=$1 RETURNING id`,
      [id, touristId, sosEventId]
    )
  }

  async markFailed(id, errorMsg) {
    return this.queryOne(
      `UPDATE inbound_sos_sms SET parsed=FALSE, parse_error=$2 WHERE id=$1 RETURNING id`,
      [id, errorMsg]
    )
  }
}

module.exports = { InboundRepository }
