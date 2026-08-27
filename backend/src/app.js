// src/app.js
'use strict'

require('./config/env')  // Validate env vars on startup — throws if anything is missing

const path      = require('node:path')
const express   = require('express')
const helmet    = require('helmet')
const cors      = require('cors')
const corsOptions     = require('./config/cors')
const { generalLimiter, webhookLimiter } = require('./middleware/rateLimiter')
const { errorHandler } = require('./middleware/errorHandler')
const { sendError }    = require('./utils/response')
const logger           = require('./utils/logger')
const routes           = require('./routes/index')

const app = express()

// ── Security headers ────────────────────────────────────────────────
app.set('trust proxy', 1)  // Trust first proxy (for IP headers behind nginx)
app.use(helmet({
  contentSecurityPolicy: false,  // Let frontends manage their own CSP
  crossOriginResourcePolicy: { policy: 'cross-origin' },  // Allow PDF download
}))

// ── CORS ────────────────────────────────────────────────────────────
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))  // Preflight for all routes

// ── Body parsing ─────────────────────────────────────────────────────
// Webhooks from Twilio arrive as urlencoded — parse BEFORE json
app.use('/api/webhooks', express.urlencoded({ extended: true, limit: '1mb' }), webhookLimiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Rate limiting ────────────────────────────────────────────────────
app.use(generalLimiter)

// ── Request logging ──────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url, ip: req.ip }, 'Incoming request')
  next()
})

// ── Uploaded content (review photos) ─────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// ── Health check (no auth, no rate limit) ────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aaraksha-backend', timestamp: new Date().toISOString() })
})

// TEMP-DEBUG: isolated diagnostic route, bypasses routes/index.js and
// errorHandler.js entirely, logs via plain console.error (no pino) —
// remove once the Render deploy 500s are diagnosed.
app.get('/debug-query', async (_req, res) => {
  try {
    const { getPool } = require('./database/pool')
    const result = await getPool().query('SELECT COUNT(*)::int AS count FROM destinations')
    res.json({ ok: true, count: result.rows[0].count })
  } catch (err) {
    console.error('DEBUG-QUERY FAILURE:', err.message, err.code, err.stack)
    res.status(500).json({ ok: false, message: err.message, code: err.code, stack: err.stack })
  }
})

// ── API routes ────────────────────────────────────────────────────────
app.use('/api', routes)

// ── 404 handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  sendError(res, `Route ${req.method} ${req.url} not found`, 404)
})

// ── Global error handler (MUST be last) ──────────────────────────────
app.use(errorHandler)

module.exports = app
