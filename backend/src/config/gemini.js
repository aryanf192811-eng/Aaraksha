// src/config/gemini.js
'use strict'

const config = require('./env')
const logger = require('../utils/logger')

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
