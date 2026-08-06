'use strict'
const { TripRepository }        = require('../repositories/trip.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { generatePackingList }   = require('./gemini.service')
const { ERRORS } = require('../constants/errors')
const { WEATHER_CONDITIONS }    = require('../constants/enums')

async function generateForTrip(touristId, tripId) {
  const tripRepo = new TripRepository()
  const trip     = await tripRepo.findById(tripId, touristId)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
  const destRepo  = new DestinationRepository()

  // Get worst weather across all stops
  const destIds = stops.map(s => s.destinationId).filter(Boolean)
  const weatherMap = destIds.length > 0 ? await destRepo.getWeatherCacheMap(destIds) : {}
  const worstWeather = Object.values(weatherMap).reduce((worst, w) => {
    const priority = [WEATHER_CONDITIONS.STORM, WEATHER_CONDITIONS.HEAVY_RAIN, WEATHER_CONDITIONS.SNOW,
                     WEATHER_CONDITIONS.FOG, WEATHER_CONDITIONS.RAIN, WEATHER_CONDITIONS.CLOUDY, WEATHER_CONDITIONS.CLEAR]
    const wIdx    = priority.indexOf(w.condition)
    const worstIdx = priority.indexOf(worst)
    return wIdx < worstIdx ? w.condition : worst
  }, WEATHER_CONDITIONS.CLEAR)

  const firstStop = stops[0] || {}
  const result = await generatePackingList({
    destination:      firstStop.city || 'Northeast India',
    state:            firstStop.state || 'Assam',
    tsiScore:         trip.tsi_score,
    tsiLabel:         trip.tsi_label,
    weatherCondition: worstWeather,
    travelType:       trip.travel_type,
    startDate:        trip.start_date,
    endDate:          trip.end_date,
    stops,
  })

  // Save generated list back to trip
  await tripRepo.updateChecklist(tripId, touristId, result.items)
  return result
}

module.exports = { generateForTrip }
