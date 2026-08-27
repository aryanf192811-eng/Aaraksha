// src/ml/features.js
// Feature encoding for the Predictive Risk Model — shared verbatim between
// the offline trainer (scripts/trainRiskModel.js) and the runtime service
// (services/riskModel.service.js) so there is zero risk of train/inference
// skew (a real, common ML bug: encoding data one way at training time and
// a subtly different way at serving time). One function, two callers.
'use strict'

const CONNECTIVITY_LEVELS = ['NONE', 'POOR', 'MODERATE', 'GOOD', 'EXCELLENT']
const DIFFICULTY_LEVELS   = ['EASY', 'MODERATE', 'HARD', 'EXTREME']
const ZONE_LEVELS         = ['SAFE', 'CAUTION', 'ILP_REQUIRED', 'HIGH_RISK', 'RESTRICTED']

// Ordered once, exported, and reused everywhere a feature *name* is needed
// (the trainer's report table, the runtime explainability breakdown) so
// the weight vector's index-to-meaning mapping can never drift out of sync
// with itself.
const FEATURE_NAMES = [
  ...CONNECTIVITY_LEVELS.map(l => `connectivity_${l}`),
  ...DIFFICULTY_LEVELS.map(l => `difficulty_${l}`),
  ...ZONE_LEVELS.map(l => `zone_${l}`),
  'altitude_norm',
  'hospital_distance_norm',
  'monsoon_season',
]

function oneHot(levels, value) {
  return levels.map(l => (l === value ? 1 : 0))
}

// destination-shaped input: { connectivity, difficulty, zone_type,
// altitude_m, nearest_hospital_km }, plus an optional `month` (1-12,
// defaults to the current month) so a trainer generating synthetic
// trip-days across the year and a live request in a specific month use
// the identical encoding path.
function featurize(destination, month = new Date().getMonth() + 1) {
  const altitudeNorm = Math.min(1.5, (destination.altitude_m ?? 0) / 4000)
  const hospitalNorm = Math.min(1.5, (destination.nearest_hospital_km ?? 0) / 60)
  const monsoon = month >= 6 && month <= 9 ? 1 : 0

  return [
    ...oneHot(CONNECTIVITY_LEVELS, destination.connectivity),
    ...oneHot(DIFFICULTY_LEVELS, destination.difficulty),
    ...oneHot(ZONE_LEVELS, destination.zone_type),
    altitudeNorm,
    hospitalNorm,
    monsoon,
  ]
}

module.exports = { featurize, FEATURE_NAMES, CONNECTIVITY_LEVELS, DIFFICULTY_LEVELS, ZONE_LEVELS }
