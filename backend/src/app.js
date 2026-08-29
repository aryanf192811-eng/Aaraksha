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

// ── Health check (no auth, no rate limit) ────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aaraksha-backend', timestamp: new Date().toISOString() })
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
