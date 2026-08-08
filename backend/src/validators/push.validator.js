// src/validators/push.validator.js
'use strict'

const { z } = require('zod')

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
})

const UnsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

module.exports = { SubscribeSchema, UnsubscribeSchema }
