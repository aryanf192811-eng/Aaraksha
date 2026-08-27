// src/services/riskModel.service.js
// Serves the Predictive Incident Risk Model trained offline by
// scripts/trainRiskModel.js — loads the frozen learned weights once at
// startup and computes predictions with the exact same featurize() used
// during training (src/ml/features.js), so there is no train/serve skew.
// Deliberately a SEPARATE signal from TSI: TSI (tsi.service.js) is
// rule-based with penalties the team chose by hand; this model's weights
// were learned from a training run. Surfacing both, clearly labeled, is
// more honest than presenting either alone as "the" AI.
'use strict'

const fs = require('fs')
const path = require('path')
const { featurize, FEATURE_NAMES } = require('../ml/features')
const { predict } = require('../ml/logisticRegression')
const logger = require('../utils/logger')

const WEIGHTS_PATH = path.join(__dirname, '../data/riskModel.weights.json')

let model = null
try {
  model = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'))
} catch (err) {
  // A missing weights file means `npm run train:risk-model` hasn't been
  // run yet — degrade to "no prediction" rather than crash the server, the
  // same graceful-degradation stance every other optional integration in
  // this codebase takes (Twilio, Gemini, OpenWeatherMap all unconfigured).
  logger.warn({ err: err.message }, 'Risk model weights not found — predictive risk disabled until scripts/trainRiskModel.js is run')
}

function riskLabel(probability) {
  if (probability >= 0.6) return 'Elevated'
  if (probability >= 0.35) return 'Moderate'
  return 'Low'
}

// Returns null (not an error) when the model isn't loaded or the
// destination is missing the fields it needs — callers treat a null
// predictedRisk as "not available," the same optional-field pattern the
// risk-overview response already uses for weather.
function predictForDestination(destination, month = new Date().getMonth() + 1) {
  if (!model || !destination) return null
  if (!destination.connectivity || !destination.difficulty || !destination.zone_type) return null

  const x = featurize(destination, month)
  const probability = predict(model.weights, model.bias, x)

  // Explainability: each feature's own contribution (weight × its value in
  // this specific input), not just the final number — this is what makes
  // the model auditable rather than a black box. Only non-zero
  // contributions are meaningful for one-hot features.
  const contributions = FEATURE_NAMES
    .map((name, i) => ({ feature: name, contribution: Number((model.weights[i] * x[i]).toFixed(4)) }))
    .filter(c => Math.abs(c.contribution) > 0.0001)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 4)

  return {
    probability: Number(probability.toFixed(4)),
    percentage: Math.round(probability * 100),
    label: riskLabel(probability),
    topFactors: contributions,
  }
}

function getModelInfo() {
  if (!model) return null
  const { weights, bias, ...rest } = model
  return {
    ...rest,
    featureWeights: FEATURE_NAMES.map((name, i) => ({ feature: name, weight: Number(weights[i].toFixed(4)) }))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
    bias: Number(bias.toFixed(4)),
  }
}

module.exports = { predictForDestination, getModelInfo }
