// src/repositories/otp.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class OTPRepository extends BaseRepository {
  // Store a new OTP (overwrites any existing non-used OTP for same phone+purpose)
  async create(phone, otpHash, purpose, expiresAt, ipAddress = null) {
    // First: invalidate all previous unused OTPs for this phone+purpose
    await this.query(
      `UPDATE otp_verifications SET used=TRUE
       WHERE phone=$1 AND purpose=$2 AND used=FALSE`,
      [phone, purpose]
    )
    return this.queryOne(`
      INSERT INTO otp_verifications (phone, otp_hash, purpose, expires_at, ip_address)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [phone, otpHash, purpose, expiresAt, ipAddress]
    )
  }

  // Find the latest valid OTP for a phone+purpose
  async findValid(phone, purpose) {
    return this.queryOne(`
      SELECT * FROM otp_verifications
      WHERE phone=$1 AND purpose=$2 AND used=FALSE AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1`,
      [phone, purpose]
    )
  }

  // Increment failed attempts; return new attempt count
  async incrementAttempts(id) {
    const row = await this.queryOne(
      `UPDATE otp_verifications SET attempts=attempts+1 WHERE id=$1 RETURNING attempts`,
      [id]
    )
    return row?.attempts || 0
  }

  // Mark OTP as used and attach a reset_token (for password reset step 2→3)
  async markUsedAndAttachToken(id, resetToken, resetTokenExpires) {
    return this.queryOne(`
      UPDATE otp_verifications
      SET used=TRUE, reset_token=$2, reset_token_expires=$3
      WHERE id=$1 RETURNING *`,
      [id, resetToken, resetTokenExpires]
    )
  }

  // Find a valid reset_token (used in step 3: actual password reset)
  async findByResetToken(resetToken) {
    return this.queryOne(`
      SELECT * FROM otp_verifications
      WHERE reset_token=$1
        AND reset_token_expires > NOW()
        AND used=TRUE`,  // OTP was verified; reset_token is the continuation credential
      [resetToken]
    )
  }

  // Invalidate a reset_token after password has been reset
  async invalidateResetToken(resetToken) {
    return this.queryOne(
      `UPDATE otp_verifications SET reset_token=NULL, reset_token_expires=NULL
       WHERE reset_token=$1 RETURNING id`,
      [resetToken]
    )
  }

  // Count OTP requests from a phone in the last N minutes (rate limit check)
  async countRecentRequests(phone, purpose, windowMinutes = 60) {
    return this.queryCount(`
      SELECT COUNT(*) FROM otp_verifications
      WHERE phone=$1 AND purpose=$2
        AND created_at >= NOW() - ($3 || ' minutes')::interval`,
      [phone, purpose, windowMinutes]
    )
  }
}

module.exports = { OTPRepository }
