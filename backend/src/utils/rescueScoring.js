// src/utils/rescueScoring.js
// Weighted, explainable rescuer-dispatch scoring — replaces a plain
// distance sort with a real multi-factor score, while staying rule-based
// and auditable (same "explainable, not a black box" stance as TSI and
// the anomaly detector — see tsi.service.js's header comment). Every
// candidate's score is a transparent sum an operator can be shown broken
// down, not a single opaque number.
'use strict'

// How well each official team TYPE suits each SOS CATEGORY — 1.0 is an
// ideal specialist match, down to 0.4 for a team that's still capable but
// not the natural first choice. Domain-reasoned (a MEDICAL team is the
// obvious pick for a MEDICAL SOS; SDRF/MOUNTAIN units are the ones
// equipped for a TRAPPED/DISASTER rescue in this platform's actual
// terrain), not learned — deliberately kept in the same rule-based,
// inspectable register as everything else team-picked in this codebase.
const CATEGORY_TYPE_MATCH = {
  MEDICAL:  { MEDICAL: 1.0, SDRF: 0.6, MOUNTAIN: 0.5, POLICE: 0.4, COAST_GUARD: 0.4 },
  TRAPPED:  { MOUNTAIN: 1.0, SDRF: 0.9, MEDICAL: 0.5, POLICE: 0.4, COAST_GUARD: 0.5 },
  DISASTER: { SDRF: 1.0, MOUNTAIN: 0.7, COAST_GUARD: 0.7, MEDICAL: 0.5, POLICE: 0.5 },
  MISSING:  { SDRF: 0.9, POLICE: 0.9, MOUNTAIN: 0.7, MEDICAL: 0.4, COAST_GUARD: 0.5 },
  LOST:     { POLICE: 0.8, MOUNTAIN: 0.7, SDRF: 0.6, MEDICAL: 0.4, COAST_GUARD: 0.4 },
  CRIME:    { POLICE: 1.0, SDRF: 0.5, MOUNTAIN: 0.3, MEDICAL: 0.3, COAST_GUARD: 0.3 },
  OTHER:    { POLICE: 0.6, SDRF: 0.6, MOUNTAIN: 0.6, MEDICAL: 0.6, COAST_GUARD: 0.6 },
}
// A verified volunteer is a generalist, not a specialist unit — a flat,
// moderate match for every category rather than 0 (they're still a real,
// often-faster option, especially in the terrain this platform targets)
// or 1 (they're not equipped like a dedicated team).
const VOLUNTEER_MATCH = 0.55

const WEIGHTS = { distance: 0.6, categoryMatch: 0.3, reputation: 0.1 }

function distanceScore(distanceKm, radiusKm) {
  return Math.max(0, 1 - distanceKm / radiusKm)
}

function categoryMatchScore(candidate, sosCategory) {
  if (candidate.kind === 'VOLUNTEER') return VOLUNTEER_MATCH
  const table = CATEGORY_TYPE_MATCH[sosCategory] || CATEGORY_TYPE_MATCH.OTHER
  return table[candidate.type] ?? 0.4
}

// Official teams are pre-vetted by their own onboarding — treated as a
// flat professional baseline. A volunteer's `points` (reputation earned
// from past dispatches) is the only place this factor actually varies.
function reputationScore(candidate) {
  if (candidate.kind === 'TEAM') return 0.8
  return Math.max(0, Math.min(1, (candidate.points ?? 0) / 100))
}

// Returns the candidate with `score` (0-100, sorted-descending-friendly)
// and `breakdown` — the three weighted sub-scores plus a one-line human
// label, so the govt UI can show *why* a candidate ranked where it did
// instead of just a bare number.
function scoreRescuerCandidate(candidate, sosCategory, radiusKm) {
  const dScore = distanceScore(candidate.distanceKm, radiusKm)
  const cScore = categoryMatchScore(candidate, sosCategory)
  const rScore = reputationScore(candidate)

  const weighted = dScore * WEIGHTS.distance + cScore * WEIGHTS.categoryMatch + rScore * WEIGHTS.reputation
  const score = Math.round(weighted * 100)

  return {
    ...candidate,
    score,
    scoreBreakdown: {
      distance: Math.round(dScore * 100),
      categoryMatch: Math.round(cScore * 100),
      reputation: Math.round(rScore * 100),
    },
    isSpecialistMatch: candidate.kind === 'TEAM' && cScore >= 0.9,
  }
}

module.exports = { scoreRescuerCandidate, CATEGORY_TYPE_MATCH }
