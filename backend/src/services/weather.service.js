// src/services/weather.service.js
'use strict'

const axios = require('axios')
const config = require('../config/env')
const logger = require('../utils/logger')
const { DestinationRepository } = require('../repositories/destination.repository')
const { TripRepository } = require('../repositories/trip.repository')
const { calculateTSI } = require('./tsi.service')
const { WEATHER_CONDITIONS, WEATHER_RISK } = require('../constants/enums')

const RISK_RANK = { [WEATHER_RISK.LOW]: 0, [WEATHER_RISK.MODERATE]: 1, [WEATHER_RISK.HIGH]: 2, [WEATHER_RISK.EXTREME]: 3 }

function mapOWMCondition(main, description = '') {
  const d = description.toLowerCase()
  if (main === 'Thunderstorm') return WEATHER_CONDITIONS.STORM
  if (main === 'Snow')         return WEATHER_CONDITIONS.SNOW
  if (main === 'Drizzle')      return WEATHER_CONDITIONS.RAIN
  if (main === 'Rain')         return d.includes('heavy') ? WEATHER_CONDITIONS.HEAVY_RAIN : WEATHER_CONDITIONS.RAIN
  if (['Mist','Smoke','Haze','Dust','Fog','Ash','Squall'].includes(main)) return WEATHER_CONDITIONS.FOG
  if (main === 'Clear')        return WEATHER_CONDITIONS.CLEAR
  return WEATHER_CONDITIONS.CLOUDY
}

function deriveRisk(condition, windKmh) {
  if (condition === WEATHER_CONDITIONS.STORM)      return { level: WEATHER_RISK.EXTREME, reason: 'Thunderstorm — travel strongly discouraged' }
  if (condition === WEATHER_CONDITIONS.HEAVY_RAIN) return { level: WEATHER_RISK.HIGH,    reason: 'Heavy rainfall — landslide risk in hilly terrain' }
  if (condition === WEATHER_CONDITIONS.SNOW)       return { level: WEATHER_RISK.HIGH,    reason: 'Snowfall — road closures likely' }
  if (condition === WEATHER_CONDITIONS.RAIN && windKmh > 40) return { level: WEATHER_RISK.MODERATE, reason: 'Rain with strong winds — exercise caution' }
  if (condition === WEATHER_CONDITIONS.FOG)        return { level: WEATHER_RISK.MODERATE, reason: 'Low visibility — drive carefully' }
  if (condition === WEATHER_CONDITIONS.RAIN)       return { level: WEATHER_RISK.LOW, reason: null }
  return { level: WEATHER_RISK.LOW, reason: null }
}

const TSI_WEATHER_DELTA_MAP = {
  [WEATHER_CONDITIONS.STORM]:      -20,
  [WEATHER_CONDITIONS.HEAVY_RAIN]: -15,
  [WEATHER_CONDITIONS.SNOW]:       -10,
  [WEATHER_CONDITIONS.FOG]:         -5,
  [WEATHER_CONDITIONS.RAIN]:        -5,
  [WEATHER_CONDITIONS.CLOUDY]:       0,
  [WEATHER_CONDITIONS.CLEAR]:        0,
}

async function fetchWeatherForDestination(destination) {
  if (!config.owm.enabled) {
    logger.debug('OWM disabled — weather fetch skipped')
    return null
  }
  try {
    const { data } = await axios.get(`${config.owm.baseUrl}/weather`, {
      params: { lat: destination.latitude, lon: destination.longitude, appid: config.owm.apiKey, units: 'metric' },
      timeout: 5000,
    })
    const condition = mapOWMCondition(data.weather[0].main, data.weather[0].description)
    const windKmh = Math.round((data.wind?.speed || 0) * 3.6)
    const { level: riskLevel, reason: riskReason } = deriveRisk(condition, windKmh)
    return {
      condition, tempCelsius: Math.round(data.main.temp),
      humidityPct: data.main.humidity, windKmh,
      description: data.weather[0].description, riskLevel, riskReason,
      tsiWeatherDelta: TSI_WEATHER_DELTA_MAP[condition] || 0,
    }
  } catch (err) {
    logger.error({ err: { message: err.message }, destination: destination.name }, 'OWM fetch failed')
    return null
  }
}

// Called by weather cron job every 60 minutes.
async function updateWeatherForActiveTrips(emitTSIUpdated, emitWeatherRiskIncreased) {
  const tripRepo = new TripRepository()
  const destRepo = new DestinationRepository()

  const activeTrips = await tripRepo.findAllActive()
  if (activeTrips.length === 0) { logger.debug('No active trips — weather cron skipped'); return { tripsUpdated: 0, destinationsUpdated: 0 } }

  const destinationIds = new Set()
  for (const trip of activeTrips) {
    const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
    for (const stop of stops) {
      const id = stop.destinationId || stop.destination_id
      if (id) destinationIds.add(id)
    }
  }

  if (destinationIds.size === 0) { return { tripsUpdated: 0, destinationsUpdated: 0 } }

  // Snapshot risk levels BEFORE this poll's fetch so a genuine worsening
  // can be told apart from "recomputed the same thing again" — TSI_UPDATED
  // already fires every hour regardless, which meant a tourist had to go
  // check their trip themselves to notice anything had actually changed.
  const previousWeatherMap = await destRepo.getWeatherCacheMap([...destinationIds])

  const destinations = await destRepo.findByIds([...destinationIds])
  let destUpdated = 0
  const worsenedDestinations = new Map() // destinationId -> { from, to, reason, city }
  for (const dest of destinations) {
    const weather = await fetchWeatherForDestination(dest)
    if (!weather) continue
    await destRepo.upsertWeather(dest.id, weather)
    destUpdated++

    const prevRisk = previousWeatherMap[dest.id]?.risk_level
    if (prevRisk && RISK_RANK[weather.riskLevel] > RISK_RANK[prevRisk]) {
      worsenedDestinations.set(dest.id, { from: prevRisk, to: weather.riskLevel, reason: weather.riskReason, city: dest.name })
    }
  }

  const weatherCacheMap = await destRepo.getWeatherCacheMap([...destinationIds])
  let tripsUpdated = 0
  for (const trip of activeTrips) {
    try {
      const tsiResult = calculateTSI(trip, weatherCacheMap)
      await tripRepo.updateTSI(trip.id, tsiResult.score, tsiResult.label, tsiResult.factors, tsiResult.recommendations)
      if (emitTSIUpdated) emitTSIUpdated(trip.tourist_id, trip.id, tsiResult.score, tsiResult.label, tsiResult.factors)
      tripsUpdated++

      if (emitWeatherRiskIncreased && worsenedDestinations.size > 0) {
        const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
        for (const stop of stops) {
          const destId = stop.destinationId || stop.destination_id
          const worsened = destId && worsenedDestinations.get(destId)
          if (worsened) {
            emitWeatherRiskIncreased(trip.tourist_id, trip.id, worsened.city, worsened.from, worsened.to, worsened.reason)
          }
        }
      }
    } catch (err) {
      logger.error({ err: { message: err.message }, tripId: trip.id }, 'TSI update failed for trip')
    }
  }

  logger.info({ tripsUpdated, destinationsUpdated: destUpdated, weatherWorsened: worsenedDestinations.size }, 'Weather + TSI cron complete')
  return { tripsUpdated, destinationsUpdated: destUpdated }
}

module.exports = { fetchWeatherForDestination, updateWeatherForActiveTrips }
