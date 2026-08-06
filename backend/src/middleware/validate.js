// src/middleware/validate.js
'use strict'

const { z } = require('zod')
const { sendError } = require('../utils/response')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

// Usage: router.post('/path', validate(MySchema), controller)
// After validate(), use req.validatedBody (body)

function validate(schema, source = 'body') {
  return async (req, res, next) => {
    try {
      const input = source === 'body'   ? req.body
                  : source === 'query'  ? req.query
                  : source === 'params' ? req.params
                  : req.body

      const parsed = await schema.parseAsync(input)

      if (source === 'body')   req.validatedBody   = parsed
      if (source === 'query')  req.validatedQuery  = parsed
      if (source === 'params') req.validatedParams = parsed

      next()
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors = err.errors.map(e => ({
          field:   e.path.join('.'),
          message: e.message,
          code:    e.code,
        }))
        logger.debug({ errors }, 'Validation failed')
        return sendError(res, ERRORS.VALIDATION_FAILED, 400, errors)
      }
      next(err)
    }
  }
}

module.exports = { validate }
