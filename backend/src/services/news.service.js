// src/services/news.service.js
'use strict'

const { NewsRepository } = require('../repositories/news.repository')
const { TripRepository } = require('../repositories/trip.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { emitDestinationNewsCritical } = require('../socket/emitters')
const { sendPushToTourist } = require('./notification/push.service')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

async function getNewsForDestination(destinationId) {
  return new NewsRepository().findByDestinationId(destinationId)
}

async function getNewsForTrip(tripId, touristId) {
  const tripRepo = new TripRepository()
  const trip = await tripRepo.findById(tripId, touristId)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
  const destinationIds = [...new Set(stops.map(s => s.destinationId).filter(Boolean))]
  if (destinationIds.length === 0) return []

  return new NewsRepository().findByDestinationIds(destinationIds)
}

// Govt-authored advisory. A CRITICAL item fans out to every tourist whose
// ACTIVE trip includes this destination — same "scan every active trip's
// stops for a match" approach weather.service.js already uses for weather
// alerts, so this doesn't need a new indexed query on the stops JSONB.
async function postNews(destinationId, data, govtUserId) {
  const destRepo = new DestinationRepository()
  const destination = await destRepo.findById(destinationId)
  if (!destination) throw Object.assign(new Error(ERRORS.DESTINATION_NOT_FOUND), { statusCode: 404 })

  const newsRepo = new NewsRepository()
  const news = await newsRepo.create({
    destinationId,
    category: data.category,
    severity: data.severity,
    headline: data.headline,
    body: data.body,
    source: data.source,
    postedByGovtUserId: govtUserId,
  })

  logger.info({ newsId: news.id, destinationId, severity: news.severity }, 'Destination news posted')

  if (news.severity === 'CRITICAL') {
    try {
      const tripRepo = new TripRepository()
      const activeTrips = await tripRepo.findAllActive()
      const affected = activeTrips.filter(trip => {
        const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
        return stops.some(s => s.destinationId === destinationId)
      })
      for (const trip of affected) {
        emitDestinationNewsCritical(trip.tourist_id, trip.id, destination.name, news)
        sendPushToTourist(trip.tourist_id, {
          title: `Aaraksha — Critical Alert: ${destination.name}`,
          body: news.headline,
          url: `/trips/${trip.id}`,
        })
      }
    } catch (err) {
      // A fan-out failure must never undo the already-created news item.
      logger.error({ err: { message: err.message }, newsId: news.id }, 'Critical news fan-out failed')
    }
  }

  return news
}

module.exports = { getNewsForDestination, getNewsForTrip, postNews }
