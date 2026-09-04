// src/services/news.service.js
'use strict'

const { NewsRepository } = require('../repositories/news.repository')
const { TripRepository } = require('../repositories/trip.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { emitDestinationNewsCritical } = require('../socket/emitters')
const { sendPushToTourist } = require('./notification/push.service')
const { ERRORS } = require('../constants/errors')
const { NEWS_BANK } = require('../data/newsBank')
const logger = require('../utils/logger')

// How long a rotated item "holds" before the next one in that destination's
// bank takes over. Deterministic (time-slot based) rather than a random
// pick or a persisted counter, so it survives server restarts and never
// needs its own state table — the slot is just derived from wall-clock time.
const ROTATION_WINDOW_MS = 3 * 60 * 60 * 1000 // 3 hours

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Per-destination offset (from the name) means every destination isn't
// rotating in lockstep on the same clock tick — Kaziranga and Tawang land
// on different items even though both windows are 3 hours wide.
function pickRotationSlotItem(destinationName) {
  const bank = NEWS_BANK[destinationName]
  if (!bank || bank.length === 0) return null
  const slot = Math.floor(Date.now() / ROTATION_WINDOW_MS) + hashString(destinationName)
  return bank[slot % bank.length]
}

async function getNewsForDestination(destinationId) {
  return new NewsRepository().findByDestinationId(destinationId)
}

// Backing the /news page's general feed — every destination's news, with
// optional destination/state/severity/category filters and real pagination.
async function getAllNews(filters) {
  return new NewsRepository().findAllFiltered(filters)
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

// Curated-rotation source (no external news API key — a deliberate product
// choice). Walks every destination, computes which bank item "owns" the
// current time slot, and posts it only if it isn't already the latest item
// for that destination — so re-running the job every tick doesn't spam
// duplicate rows, but the feed still visibly changes as slots roll over.
async function rotateNewsForAllDestinations() {
  const destRepo = new DestinationRepository()
  const newsRepo = new NewsRepository()
  const destinations = await destRepo.findAll()

  let posted = 0
  for (const dest of destinations) {
    const item = pickRotationSlotItem(dest.name)
    if (!item) continue

    const [latest] = await newsRepo.findByDestinationId(dest.id, 1)
    if (latest && latest.headline === item.headline) continue

    await postNews(dest.id, item, null)
    posted++
  }

  return { destinationsChecked: destinations.length, posted }
}

module.exports = { getNewsForDestination, getNewsForTrip, getAllNews, postNews, rotateNewsForAllDestinations }
