// src/middleware/auth.js
'use strict'

const jwt = require('jsonwebtoken')
const config = require('../config/env')
const { TouristRepository } = require('../repositories/tourist.repository')
const { GovtRepository }    = require('../repositories/govt.repository')
const { sendError } = require('../utils/response')
const { ERRORS }    = require('../constants/errors')
const logger        = require('../utils/logger')

function extractToken(req) {
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim()
  // Fallback for direct browser-navigation downloads (PDF exports): a plain
  // `<a href>`/window.location navigation can't attach an Authorization
  // header, so those specific routes accept ?token= instead. This is the
  // only way those endpoints are ever called without a header — normal API
  // calls always go through axios with the header set.
  if (typeof req.query.token === 'string' && req.query.token) return req.query.token
  return null
}

function verifyJWT(token) {
  try {
    return jwt.verify(token, config.jwt.secret)
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw Object.assign(new Error(ERRORS.INVALID_TOKEN), { statusCode: 401, code: 'TOKEN_EXPIRED' })
    throw Object.assign(new Error(ERRORS.INVALID_TOKEN), { statusCode: 401 })
  }
}

async function authenticateTourist(req, res, next) {
  const token = extractToken(req)
  if (!token) return sendError(res, ERRORS.UNAUTHORIZED, 401)

  try {
    const payload = verifyJWT(token)
    if (payload.role !== 'tourist') return sendError(res, ERRORS.FORBIDDEN, 403)

    const repo    = new TouristRepository()
    const tourist = await repo.findById(payload.id)
    if (!tourist || !tourist.is_active) return sendError(res, ERRORS.INVALID_TOKEN, 401)

    req.tourist = tourist
    next()
  } catch (err) {
    if (err.statusCode === 401) return sendError(res, err.message, 401)
    logger.error({ err: err.message }, 'Auth middleware error')
    next(err)
  }
}

async function authenticateGovt(req, res, next) {
  const token = extractToken(req)
  if (!token) return sendError(res, ERRORS.UNAUTHORIZED, 401)

  try {
    const payload = verifyJWT(token)
    if (payload.role !== 'govt') return sendError(res, ERRORS.FORBIDDEN, 403)

    const repo = new GovtRepository()
    const user = await repo.findById(payload.id)
    if (!user || !user.is_active) return sendError(res, ERRORS.INVALID_TOKEN, 401)

    req.govtUser = user
    next()
  } catch (err) {
    if (err.statusCode === 401) return sendError(res, err.message, 401)
    logger.error({ err: err.message }, 'Govt auth middleware error')
    next(err)
  }
}

module.exports = { authenticateTourist, authenticateGovt }
