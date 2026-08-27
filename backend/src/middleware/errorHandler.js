// src/middleware/errorHandler.js
'use strict'

const { sendError } = require('../utils/response')
const { ERRORS }    = require('../constants/errors')
const logger        = require('../utils/logger')

// Must be LAST middleware registered in app.js (4 params)
function errorHandler(err, req, res, next) {
  // Already responded — abort
  if (res.headersSent) return next(err)

  // Log with context
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
      // TEMP-DEBUG: always include stack while diagnosing the Render deploy — revert to dev-only before shipping.
      { stack: err.stack, code: err.code, name: err.name }
    )
  }

  // Fallback
  sendError(
    res,
    ERRORS.INTERNAL_ERROR,
    500,
    // TEMP-DEBUG: always include stack while diagnosing the Render deploy — revert to dev-only before shipping.
    { stack: err.stack, code: err.code, name: err.name }
  )
}

module.exports = { errorHandler }
