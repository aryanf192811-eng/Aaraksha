// src/services/notification/push.service.js
// Web Push — an OS-level notification for a tourist even when the app tab
// isn't open or focused, unlike Socket.IO events which are silently missed
// if nothing is listening. Best-effort: never throws to the caller, since a
// push failure must never block the safety event (SOS, weather alert, etc.)
// that triggered it.
'use strict'

const webpush = require('web-push')
const config = require('../../config/env')
const { PushSubscriptionRepository } = require('../../repositories/pushSubscription.repository')
const logger = require('../../utils/logger')

if (config.vapid.enabled) {
  webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey)
}

async function sendPushToTourist(touristId, { title, body, url }) {
  if (!config.vapid.enabled) return

  try {
    const repo = new PushSubscriptionRepository()
    const subscriptions = await repo.findByTouristId(touristId)
    if (subscriptions.length === 0) return

    const payload = JSON.stringify({ title, body, url: url || '/' })

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      } catch (err) {
        // 404/410 = subscription is dead (browser data cleared, uninstalled, etc.) — clean it up
        if (err.statusCode === 404 || err.statusCode === 410) {
          await repo.removeByEndpoint(sub.endpoint)
        } else {
          logger.error({ err: { message: err.message }, touristId }, 'Push send failed')
        }
      }
    }))
  } catch (err) {
    logger.error({ err: { message: err.message }, touristId }, 'Push notification lookup failed')
  }
}

module.exports = { sendPushToTourist }
