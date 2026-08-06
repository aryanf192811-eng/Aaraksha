// src/utils/response.js
'use strict'

function sendSuccess(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  })
}

function sendError(res, message = 'Internal Server Error', statusCode = 500, errors = undefined) {
  const body = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  }
  if (errors !== undefined && errors !== null) {
    body.errors = errors
  }
  return res.status(statusCode).json(body)
}

function sendPaginated(res, rows, total, page, limit, message = 'Success') {
  const totalPages = Math.ceil(total / limit)
  return res.status(200).json({
    success: true,
    message,
    data: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
    timestamp: new Date().toISOString(),
  })
}

module.exports = { sendSuccess, sendError, sendPaginated }
