// src/services/gemini.service.js
'use strict'

const { getGeminiModel } = require('../config/gemini')
const logger = require('../utils/logger')
const { PACKING_CATEGORIES } = require('../constants/enums')
const { v4: uuidv4 } = require('uuid')

// The Gemini SDK's own fetch has no timeout of its own — when the network
// path to Google's API is blocked or hanging (e.g. a restricted sandbox),
// generateContent() can take the better part of a minute to reject, which
// is far past the frontend's 15s HTTP client timeout. That means the
// caller sees nothing at all instead of the fast, honest fallback this is
// supposed to guarantee. Race it against a short timeout instead.
const GEMINI_TIMEOUT_MS = 8000

function generateContentWithTimeout(model, prompt) {
  return Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini request timed out')), GEMINI_TIMEOUT_MS)),
  ])
}

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
    const result = await generateContentWithTimeout(model, prompt)
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

// Safety advisory: Gemini explains an ALREADY-COMPUTED deterministic TSI
// decision in plain language — it never scores or decides anything itself
// (the score/factors/recommendations below all come from tsi.service.js's
// rule-based engine). Same "AI explains, doesn't decide" boundary as
// generatePackingList above, and the same offline-fallback discipline: a
// missing/failing Gemini call must never leave the tourist with nothing.
// Deliberately does NOT repeat the recommendations list — that's already
// shown verbatim in the trip page's own "Safety Recommendations" panel.
// This synthesizes the one thing that panel doesn't say: WHY, in terms of
// the actual per-stop factors that drove the score down.
function fallbackAdvisory({ tsiScore, tsiLabel, worstStop, hasRecommendations }) {
  const parts = [`This trip scores ${tsiScore}/100 (${tsiLabel}).`]

  if (worstStop) {
    const reasons = []
    if (worstStop.factors?.connectivity < 0) reasons.push('poor mobile connectivity')
    if (worstStop.factors?.medicalAccess < 0) reasons.push('a distant hospital')
    if (worstStop.factors?.terrain < 0) reasons.push('high altitude')
    if (worstStop.factors?.restrictedZone < 0) reasons.push('zone restrictions')
    if (worstStop.factors?.difficulty < 0) reasons.push('difficult terrain')
    if (worstStop.factors?.weather < 0) reasons.push('challenging weather')
    parts.push(`${worstStop.city} is the highest-risk stop on your route${reasons.length ? `, mainly because of ${reasons.join(' and ')}` : ''}.`)
  }

  if (hasRecommendations) parts.push('See the safety recommendations below for the specific steps to take before you depart.')
  return parts.join(' ')
}

async function generateSafetyAdvisory({ tsiScore, tsiLabel, factors, travelType, recommendations, destination }) {
  const stopRisks = Array.isArray(factors?.stopRisks) ? factors.stopRisks : []
  const worstStop = stopRisks.reduce((w, s) => (s.penalty > (w?.penalty ?? -Infinity) ? s : w), null)

  const model = getGeminiModel()
  if (!model) {
    logger.info('Gemini not available — using offline fallback safety advisory')
    return { advisory: fallbackAdvisory({ tsiScore, tsiLabel, worstStop, hasRecommendations: (recommendations || []).length > 0 }), source: 'OFFLINE_FALLBACK' }
  }

  const stopSummary = stopRisks
    .map(s => `${s.city}: score ${s.score}/100 (${s.label}) — connectivity ${s.connectivity || 'n/a'}, altitude ${s.altitudeM ?? 'n/a'}m, nearest hospital ${s.hospitalKm ?? 'n/a'}km, zone ${s.zoneType || 'n/a'}, difficulty ${s.difficulty || 'n/a'}${s.weatherCondition ? `, weather ${s.weatherCondition}` : ''}`)
    .join('\n')

  const prompt = `You are a travel safety advisor for tourists in Northeast India. A deterministic
risk-scoring system has ALREADY calculated the numbers below — do not invent a
different score or contradict it. Your job is only to explain it in plain,
reassuring but honest language and give concrete next steps.

Trip: ${destination || 'Northeast India'} · Travel type: ${travelType || 'unspecified'}
Overall Travel Safety Index: ${tsiScore}/100 (${tsiLabel})

Per-stop breakdown:
${stopSummary || '(single destination, no multi-stop breakdown)'}

System-generated recommendations (for your context only — these are ALREADY
shown to the tourist verbatim in a separate checklist on the same screen, so
do NOT repeat, list, or paraphrase them as a list yourself):
${(recommendations || []).map(r => `- ${r}`).join('\n') || '(none)'}

Write a short safety briefing (100-150 words, plain text, no markdown headers,
no bullet points) covering only: (1) what this score means in practical
terms, (2) which specific stop or factor is the biggest concern and why. End
with one sentence pointing the tourist to "the safety recommendations below"
rather than restating them. Speak directly to the tourist ("you"), be
specific to the route above, not generic travel advice.`

  try {
    const result = await generateContentWithTimeout(model, prompt)
    const advisory = result.response.text().trim()
    if (!advisory) throw new Error('Gemini returned an empty advisory')
    logger.info({ tsiScore, tsiLabel }, 'Gemini safety advisory generated')
    return { advisory, source: 'GEMINI_AI' }
  } catch (err) {
    logger.error({ err: { message: err.message } }, 'Gemini safety advisory failed — using fallback')
    return { advisory: fallbackAdvisory({ tsiScore, tsiLabel, worstStop, hasRecommendations: (recommendations || []).length > 0 }), source: 'OFFLINE_FALLBACK' }
  }
}

module.exports = { generatePackingList, generateSafetyAdvisory }
