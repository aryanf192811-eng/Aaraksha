// src/services/gemini.service.js
'use strict'

const { getGeminiModel } = require('../config/gemini')
const logger = require('../utils/logger')
const { PACKING_CATEGORIES } = require('../constants/enums')
const { v4: uuidv4 } = require('uuid')

const OFFLINE_FALLBACK = [
  { item: 'Government ID (original + 3 photocopies)', category: 'DOCUMENTS', essential: true },
  { item: 'Inner Line Permit (if destination requires)', category: 'DOCUMENTS', essential: true },
  { item: 'Emergency contacts printout (no phone needed)', category: 'DOCUMENTS', essential: true },
  { item: 'Travel insurance document', category: 'DOCUMENTS', essential: true },
  { item: 'First aid kit (bandages, antiseptic, scissors)', category: 'MEDICINE', essential: true },
  { item: 'Personal medications (7-day supply extra)', category: 'MEDICINE', essential: true },
  { item: 'ORS packets and water purification tablets', category: 'MEDICINE', essential: true },
  { item: 'Power bank (20,000 mAh minimum)', category: 'ELECTRONICS', essential: true },
  { item: 'Offline maps downloaded (Google Maps / Maps.me)', category: 'ELECTRONICS', essential: true },
  { item: 'Charging cables + universal adapter', category: 'ELECTRONICS', essential: false },
  { item: 'Emergency whistle', category: 'SAFETY', essential: true },
  { item: 'Torch / headlamp + extra batteries', category: 'SAFETY', essential: true },
  { item: 'Raincoat / poncho (NE India receives heavy monsoon)', category: 'CLOTHING', essential: true },
  { item: 'Warm layers (temperature drops rapidly at altitude)', category: 'CLOTHING', essential: true },
  { item: 'Trekking shoes with grip (if visiting hilly areas)', category: 'CLOTHING', essential: false },
  { item: 'Dry snacks + emergency rations (2-day supply)', category: 'FOOD', essential: true },
  { item: 'Reusable water bottle (1L minimum)', category: 'FOOD', essential: true },
]

async function generatePackingList({ destination, state, tsiScore, tsiLabel, weatherCondition, travelType, startDate, endDate, stops }) {
  const model = getGeminiModel()
  if (!model) {
    logger.info('Gemini not available — using offline fallback packing list')
    return { items: OFFLINE_FALLBACK.map(i => ({ ...i, id: uuidv4(), packed: false })), source: 'OFFLINE_FALLBACK' }
  }

  const stopsList = (stops || []).map(s => `${s.city}, ${s.state}`).join(' → ')
  const isHighRisk = tsiScore < 60
  const isAdventure = travelType === 'ADVENTURE'
  const isFamily = travelType === 'FAMILY'
  const hasAltitude = (stops || []).some(s => parseInt(s.altitude_m) > 3000)
  const hasBadWeather = ['HEAVY_RAIN','STORM','SNOW'].includes(weatherCondition)

  const prompt = `You are a travel safety expert for Northeast India.
Generate a context-aware packing checklist for this trip.

Trip details:
- Starting destination: ${destination}, ${state}
- Full route: ${stopsList || destination}
- Dates: ${startDate} to ${endDate}
- Travel type: ${travelType}
- Travel Safety Index: ${tsiScore}/100 (${tsiLabel})
- Current weather: ${weatherCondition || 'UNKNOWN'}

Specific considerations:
${isHighRisk ? '- HIGH RISK TRIP: Include emergency equipment (emergency blanket, rope, whistle, flares)' : ''}
${isAdventure ? '- Adventure/trekking: Include trekking poles, altitude sickness meds, crampon spikes' : ''}
${isFamily ? '- Family trip: Include baby/child medicine, ID copies for all family members, extra snacks' : ''}
${hasAltitude ? '- High altitude (>3000m): Include Diamox (altitude medication), UV sunscreen SPF50+, lip balm, thermals' : ''}
${hasBadWeather ? '- Bad weather expected: Include rain poncho, waterproof bag covers, gumboots/waterproof shoes' : ''}
- NE India specific: Inner Line Permit copies if required, offline maps essential, carry cash (cards may not work)

Return ONLY a valid JSON array. No markdown, no explanation, no code blocks.
Each object: {"item":"string","category":"${Object.values(PACKING_CATEGORIES).join('|')}","essential":boolean}
Maximum 30 items. Sort essential items first, then by category.`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    if (!Array.isArray(parsed)) throw new Error('Gemini response is not an array')

    const items = parsed.slice(0, 30).map(i => ({
      id:       uuidv4(),
      item:     String(i.item || '').slice(0, 255),
      category: Object.values(PACKING_CATEGORIES).includes(i.category) ? i.category : 'OTHER',
      essential:Boolean(i.essential),
      packed:   false,
    }))

    logger.info({ destination, count: items.length }, 'Gemini packing list generated')
    return { items, source: 'GEMINI_AI' }
  } catch (err) {
    logger.error({ err: { message: err.message } }, 'Gemini packing list failed — using fallback')
    return { items: OFFLINE_FALLBACK.map(i => ({ ...i, id: uuidv4(), packed: false })), source: 'OFFLINE_FALLBACK' }
  }
}

module.exports = { generatePackingList }
