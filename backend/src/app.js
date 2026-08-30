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

// ── Health check (no auth, no rate limit) ────────────────────────────
// MUST be registered before generalLimiter below — Render's own health
// probe hits this path on every instance, repeatedly and forever. When
// this route lived after the limiter (the bug this comment used to
// describe but didn't actually implement), the probe shared a rate-limit
// bucket with real traffic; once exhausted, Render started seeing 429s
// on its own health check, decided the instance was unhealthy, and
// killed + restarted it on a loop — visible in the Render dashboard as
// repeating "Instance failed: HTTP health check failed with status code
// 429" events every few minutes, taking the whole API down with it.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aaraksha-backend', timestamp: new Date().toISOString() })
})

// TEMPORARY — diagnosing a live incident where every DB-touching route
// 500s with no visible stack trace in Render's logs. Runs the exact same
// pool query mechanism the app uses, but returns the raw error directly
// in the HTTP response instead of relying on log visibility. Remove once
// the root cause is found and fixed.
app.get('/health/db', async (_req, res) => {
  const { getPool } = require('./database/pool')
  try {
    const result = await getPool().query('SELECT id, name FROM destinations LIMIT 1')
    res.json({ ok: true, rows: result.rows })
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack,
    })
  }
})

// ── Rate limiting ────────────────────────────────────────────────────
app.use(generalLimiter)

// ── Request logging ──────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url, ip: req.ip }, 'Incoming request')
  next()
})

// ── Uploaded content ──────────────────────────────────────────────────
// /uploads/incidents holds E-FIR evidence photos -- sensitive, unlike the
// public review photos the rest of /uploads serves. The app-wide Helmet
// crossOriginResourcePolicy below is set to 'cross-origin' for the PDF
// download routes, which as a side effect let ANY third-party site
// embed/hotlink these evidence photos cross-origin too (found in Phase 9's
// security audit). Registered before the general /uploads mount so Express
// matches this more specific path first and overrides the header just for
// this subtree -- doesn't touch the PDF routes' own requirement, and
// doesn't add auth (see docs/testing/09-security-audit.md's Remaining
// Issues for why that's a bigger follow-up, not this fix).
app.use('/uploads/incidents', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  next()
}, express.static(path.join(__dirname, '../uploads/incidents')))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// ── API routes ────────────────────────────────────────────────────────
app.use('/api', routes)

// ── 404 handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  sendError(res, `Route ${req.method} ${req.url} not found`, 404)
})

// ── Global error handler (MUST be last) ──────────────────────────────
app.use(errorHandler)

module.exports = app
