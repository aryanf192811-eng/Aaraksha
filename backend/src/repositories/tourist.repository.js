// src/repositories/tourist.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

// trust_score/trust_restricted_at (migration 022) were added after this
// allowlist and, until now, silently dropped out of every findById/
// findByPhone/findByGuardianToken result across the whole codebase --
// trustScore.service.js#getMyTrustStatus came back with an undefined
// score, submitAppeal's own-restriction check always read as "not
// restricted" (blocking every appeal), and sos.service.js's
// low_trust_at_trigger snapshot was silently always false. Safe to expose
// like rescue_readiness_score already is -- unlike password_hash/
// govt_id_hash, there's no reason to hide a tourist's own trust status
// from code paths reading their own record.
const SAFE_COLS = `
  id, full_name, phone, email, blood_group, medical_info,
  emergency_contacts, govt_id_type, govt_id_suffix,
  guardian_token, guardian_token_expires,
  rescue_readiness_score, profile_photo_url,
  trust_score, trust_restricted_at,
  is_active, created_at, updated_at`

class TouristRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO tourists (
        full_name, phone, email, blood_group, medical_info,
        emergency_contacts, govt_id_type, govt_id_hash, govt_id_suffix,
        guardian_token, guardian_token_expires, password_hash
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING ${SAFE_COLS}`,
      [
        data.fullName, data.phone, data.email ?? null,
        data.bloodGroup ?? null, data.medicalInfo ?? null,
        JSON.stringify(data.emergencyContacts),
        data.govtIdType, data.govtIdHash, data.govtIdSuffix,
        data.guardianToken, data.guardianTokenExpires, data.passwordHash,
      ]
    )
  }

  async findByPhone(phone) {
    return this.queryOne(
      `SELECT ${SAFE_COLS}, password_hash FROM tourists WHERE phone = $1`,
      [phone]
    )
  }

  async findById(id) {
    return this.queryOne(`SELECT ${SAFE_COLS} FROM tourists WHERE id = $1 AND is_active = TRUE`, [id])
  }

  async findByGuardianToken(token) {
    return this.queryOne(`
      SELECT ${SAFE_COLS}
      FROM tourists
      WHERE guardian_token = $1
        AND guardian_token_expires > NOW()
        AND is_active = TRUE`,
      [token]
    )
  }

  async govtIdHashExists(hash) {
    const row = await this.queryOne(
      'SELECT id FROM tourists WHERE govt_id_hash = $1', [hash]
    )
    return !!row
  }

  async update(id, fields) {
    // Dynamic update — only update provided fields
    const allowed = [
      'full_name', 'email', 'blood_group', 'medical_info',
      'emergency_contacts', 'profile_photo_url', 'rescue_readiness_score',
      'password_hash',  // ← for password reset
    ]
    const setClauses = []
    const values = []
    let idx = 1

    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        setClauses.push(`${key} = $${idx}`)
        values.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val)
        idx++
      }
    }

    if (setClauses.length === 0) throw new Error('No valid fields to update')
    values.push(id)

    return this.queryOne(`
      UPDATE tourists SET ${setClauses.join(', ')}
      WHERE id = $${idx} AND is_active = TRUE
      RETURNING ${SAFE_COLS}`,
      values
    )
  }
}

module.exports = { TouristRepository }
