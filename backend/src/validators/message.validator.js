// src/validators/message.validator.js
'use strict'

const { z } = require('zod')

const SendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message can\'t be empty').max(1000, 'Message is too long (max 1000 characters)'),
})

module.exports = { SendMessageSchema }
