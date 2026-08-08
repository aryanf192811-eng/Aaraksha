// src/controllers/push.controller.js
'use strict'

const { PushSubscriptionRepository } = require('../repositories/pushSubscription.repository')
const config = require('../config/env')
const { sendSuccess } = require('../utils/response')

const getPublicKey = async (req, res, next) => {
  try {
    sendSuccess(res, { publicKey: config.vapid.enabled ? config.vapid.publicKey : null })
  } catch (err) { next(err) }
}

const subscribe = async (req, res, next) => {
  try {
    const repo = new PushSubscriptionRepository()
    await repo.add(req.tourist.id, req.validatedBody)
    sendSuccess(res, null, 'Subscribed to push notifications', 201)
  } catch (err) { next(err) }
}

const unsubscribe = async (req, res, next) => {
  try {
    const repo = new PushSubscriptionRepository()
    await repo.removeByEndpoint(req.validatedBody.endpoint)
    res.status(204).end()
  } catch (err) { next(err) }
}

module.exports = { getPublicKey, subscribe, unsubscribe }
