// src/config/gemini.js
'use strict'

const config = require('./env')
const logger = require('../utils/logger')

// Node's fetch resolves generativelanguage.googleapis.com's AAAA (IPv6)
// record first by default; in environments where the IPv6 route doesn't
// actually work (confirmed here — plain curl reaches the same host over
// IPv4 in under a second) that means every Gemini call hangs for ~60s on a
// dead connection attempt before falling back to IPv4 and failing/succeeding.
// Forcing IPv4-first cuts that to sub-second, regardless of quota/auth outcome.
require('dns').setDefaultResultOrder('ipv4first')

let _model = null

function getGeminiModel() {
  if (!config.gemini.enabled) {
    logger.warn('Gemini API not configured — packing list will use offline fallback')
    return null
  }
  if (!_model) {
    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const ai = new GoogleGenerativeAI(config.gemini.apiKey)
    _model = ai.getGenerativeModel({ model: config.gemini.model })
    logger.info({ model: config.gemini.model }, 'Gemini model initialized')
  }
  return _model
}

module.exports = { getGeminiModel }
