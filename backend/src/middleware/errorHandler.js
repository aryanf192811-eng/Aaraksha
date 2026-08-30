// src/middleware/errorHandler.js
'use strict'

const { sendError } = require('../utils/response')
const { ERRORS }    = require('../constants/errors')
const logger        = require('../utils/logger')

// Must be LAST middleware registered in app.js (4 params)
function errorHandler(err, req, res, next) {
  // Already responded — abort
  if (res.headersSent) return next(err)

  // Log with context. Also a raw console.error alongside the structured
  // pino log: while diagnosing a live incident where every DB-touching
  // route 500'd, the pino "Request error" entries were consistently
  // absent from Render's log search even though this code path was
  // definitely running (confirmed by the response body's exact envelope
  // shape) -- a plain, unstructured line guarantees something is visible
  // in the raw log stream regardless of any pino serialization/transport/
  // search-indexing quirk, without depending on it for real production use.
  console.error('[Request error]', req.method, req.url, '-', err.message, '\n', err.stack)
  logger.error({
    err: {
      message: err.message,
      code:    err.code,
      stack:   err.stack,
    },
    req: { method: req.method, url: req.url, ip: req.ip },
  }, 'Request error')

  // PostgreSQL errors
  if (err.code === '23505') return sendError(res, ERRORS.DB_CONFLICT, 409)
  if (err.code === '23503') return sendError(res, ERRORS.DB_FOREIGN_KEY, 400)
  if (err.code === '23502') return sendError(res, 'Required field missing in database operation', 400)
  if (err.code === '22P02') return sendError(res, 'Invalid UUID format', 400)

  // JWT errors
  if (err.name === 'JsonWebTokenError')  return sendError(res, ERRORS.INVALID_TOKEN, 401)
  if (err.name === 'TokenExpiredError')  return sendError(res, 'Token expired', 401)

  // Multer errors
  if (err.name === 'MulterError')        return sendError(res, err.message, 400)

  // CORS errors
  if (err.message?.includes('not allowed by CORS')) return sendError(res, 'CORS policy violation', 403)

  // Application errors with explicit statusCode
  if (err.statusCode) {
    return sendError(
      res,
      err.message || ERRORS.INTERNAL_ERROR,
      err.statusCode,
      process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined
    )
  }

  // Fallback
  sendError(
    res,
    ERRORS.INTERNAL_ERROR,
    500,
    process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined
  )
}

module.exports = { errorHandler }
