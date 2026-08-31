// src/services/trustScore.service.js
// Anti-fraud, crowd-management trust score for tourists. The hard rule
// this whole feature is built around: a restricted account can ALWAYS
// still trigger a real SOS — trust score gates convenience/community
// features and adds govt scrutiny, never the emergency path itself. Every
// deduction is a deliberate, audited, human (govt) decision — nothing here
// ever fires automatically off a heuristic. Rule-based and explainable,
// same "no black box" posture tsi.service.js already holds itself to.
'use strict'

const { TrustScoreRepository } = require('../repositories/trustScore.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { emitTouristTrustRestricted, emitTrustAppealFiled } = require('../socket/emitters')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

const TRUST_SCORE_RULES = Object.freeze({
  CONFIRMED_FRAUDULENT_SOS: -15,  // govt investigated & confirmed knowingly false
  CLUSTER_ABUSE_CONFIRMED:  -20,  // part of a govt-confirmed coordinated fake-SOS cluster
  HONEST_FALSE_ALARM:        1,   // self-reported quickly, in good faith -- REWARDED, never punished
  TRIP_COMPLETED_CLEAN:      2,   // trip finished with zero SOS/anomaly rows
  COMMUNITY_CONTRIBUTION:    3,   // a genuine review/experience share, rate-limited server-side
})

const TRUST_RESTRICTION_THRESHOLD = 30  // below this: restricted (see docstring above)
const TRUST_APPEAL_RESET_SCORE = 50     // approval resets to the midpoint -- a clean slate, still watched, not back to full 100
const TRUST_APPEAL_COOLDOWN_DAYS = 7

// The one place every trust-score change goes through, system or govt-
// initiated alike -- so the audit trail (tourist_trust_events) is always
// complete and the restriction-threshold crossing is always caught
// consistently, not re-implemented per call site.
async function applyTrustEvent(touristId, reasonCode, { relatedSosId = null, govtUserId = null, note = null } = {}) {
  const delta = TRUST_SCORE_RULES[reasonCode]
  if (delta === undefined) throw new Error(`Unknown trust event reason code: ${reasonCode}`)

  const repo = new TrustScoreRepository()
  const updated = await repo.applyDelta(touristId, delta)
  if (!updated) return null

  await repo.createEvent({
    touristId, delta, reasonCode, reasonText: note, relatedSosId,
    createdByKind: govtUserId ? 'GOVT' : 'SYSTEM', createdByGovtUserId: govtUserId,
  })

  if (updated.trust_score < TRUST_RESTRICTION_THRESHOLD && !updated.trust_restricted_at) {
    const restricted = await repo.stampRestrictedIfUnset(touristId)
    if (restricted) {
      const tourist = await new TouristRepository().findById(touristId)
      emitTouristTrustRestricted(tourist, reasonCode)
      logger.warn({ touristId, reasonCode, score: updated.trust_score }, 'Tourist trust score crossed restriction threshold')
    }
  }

  logger.info({ touristId, reasonCode, delta, newScore: updated.trust_score }, 'Trust event applied')
  return updated
}

async function getMyTrustStatus(touristId) {
  const tourist = await new TouristRepository().findById(touristId)
  if (!tourist) throw Object.assign(new Error(ERRORS.NOT_FOUND), { statusCode: 404 })
  return {
    trustScore: tourist.trust_score,
    restricted: !!tourist.trust_restricted_at,
    restrictedAt: tourist.trust_restricted_at,
  }
}

async function submitAppeal(touristId, message) {
  const repo = new TrustScoreRepository()
  const tourist = await new TouristRepository().findById(touristId)
  if (!tourist) throw Object.assign(new Error(ERRORS.NOT_FOUND), { statusCode: 404 })
  if (!tourist.trust_restricted_at) {
    throw Object.assign(new Error(ERRORS.TRUST_APPEAL_NOT_RESTRICTED), { statusCode: 400 })
  }

  const latest = await repo.findLatestAppealByTourist(touristId)
  if (latest) {
    if (latest.status === 'PENDING') {
      throw Object.assign(new Error(ERRORS.TRUST_APPEAL_ALREADY_PENDING), { statusCode: 400 })
    }
    if (latest.status === 'REJECTED') {
      const daysSince = (Date.now() - new Date(latest.reviewed_at).getTime()) / 86_400_000
      if (daysSince < TRUST_APPEAL_COOLDOWN_DAYS) {
        throw Object.assign(new Error(ERRORS.TRUST_APPEAL_COOLDOWN), { statusCode: 400 })
      }
    }
  }

  const appeal = await repo.createAppeal(touristId, message)
  emitTrustAppealFiled(appeal, tourist)
  logger.info({ touristId, appealId: appeal.id }, 'Trust appeal submitted')
  return appeal
}

async function getPendingAppeals() {
  return new TrustScoreRepository().findPendingAppeals()
}

async function decideAppeal(appealId, decision, govtUserId, resolutionNotes) {
  const repo = new TrustScoreRepository()
  const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
  const appeal = await repo.updateAppealStatus(appealId, status, govtUserId, resolutionNotes)
  if (!appeal) throw Object.assign(new Error(ERRORS.TRUST_APPEAL_NOT_FOUND), { statusCode: 404 })

  if (status === 'APPROVED') {
    await repo.resetForApproval(appeal.tourist_id, TRUST_APPEAL_RESET_SCORE)
    await repo.createEvent({
      touristId: appeal.tourist_id, delta: 0, reasonCode: 'APPEAL_APPROVED_RESET',
      reasonText: resolutionNotes, relatedSosId: null, createdByKind: 'GOVT', createdByGovtUserId: govtUserId,
    })
  }

  logger.info({ appealId, status, govtUserId }, 'Trust appeal decided')
  return appeal
}

module.exports = {
  TRUST_SCORE_RULES, TRUST_RESTRICTION_THRESHOLD, TRUST_APPEAL_RESET_SCORE,
  applyTrustEvent, getMyTrustStatus, submitAppeal, getPendingAppeals, decideAppeal,
}
