// src/config/cors.js
// Allows all 3 frontend origins + localhost dev variants
'use strict'

const config = require('./env')
const logger = require('../utils/logger')

const allowedOrigins = new Set([
  config.cors.touristUrl,
  config.cors.govtUrl,
  config.cors.guardianUrl,
  ...(config.cors.volunteerUrl ? [config.cors.volunteerUrl] : []),
  // Dev localhost variants (ignored in production)
  ...(config.isDev ? [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:5176',
  ] : []),
])

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true)
    if (allowedOrigins.has(origin)) return callback(null, true)
    logger.warn({ origin }, 'CORS rejection')
    callback(new Error(`Origin ${origin} is not allowed by CORS policy`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],  // needed for PDF download
  maxAge: 86400, // 24h preflight cache
}

module.exports = corsOptions
