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
  const bullets = [`Overall score: ${tsiScore}/100 (${tsiLabel})`]

  if (worstStop) {
    const reasons = []
    if (worstStop.factors?.connectivity < 0) reasons.push('poor mobile connectivity')
    if (worstStop.factors?.medicalAccess < 0) reasons.push('a distant hospital')
    if (worstStop.factors?.terrain < 0) reasons.push('high altitude')
    if (worstStop.factors?.restrictedZone < 0) reasons.push('zone restrictions')
    if (worstStop.factors?.difficulty < 0) reasons.push('difficult terrain')
    if (worstStop.factors?.weather < 0) reasons.push('challenging weather')
    bullets.push(`Highest-risk stop: ${worstStop.city}${reasons.length ? ` — ${reasons.join(', ')}` : ''}`)
  }

  if (hasRecommendations) bullets.push('See the safety recommendations below for the specific steps to take before you depart')
  return bullets
}

// The prompt asks for plain-text "- " bullets with no markdown, but Gemini
// doesn't reliably follow that instruction — real responses have shown up
// with numbered lists ("1. "), stray **bold**, and an occasional preamble
// line ("Here's your safety briefing:") before the actual bullets. The old
// parser only stripped a single leading -/•/* and took every line verbatim,
// so any of that leaked straight into the UI as a 5th "bullet" or literal
// asterisks. This is defensive parsing, not a markdown renderer — the goal
// is exactly 3-4 clean sentences, matching what was actually asked for.
function parseAdvisoryBullets(text) {
  const BULLET_PREFIX = /^(?:[-•*]|\d+[.)])\s+/
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const bullets = []
  for (const line of lines) {
    if (BULLET_PREFIX.test(line)) {
      bullets.push(line.replace(BULLET_PREFIX, ''))
    } else if (bullets.length > 0) {
      // A wrapped continuation of the previous bullet (Gemini sometimes
      // breaks one sentence across two lines) — merge rather than treat as
      // its own bullet.
      bullets[bullets.length - 1] += ` ${line}`
    }
    // A non-bullet line before any bullet has appeared is a preamble
    // ("Here's your safety briefing:") — dropped, not a continuation.
  }
  // No bullet markers detected at all — Gemini ignored the format entirely
  // and just wrote prose. Fall back to one bullet per line rather than
  // showing nothing.
  const rawBullets = bullets.length > 0 ? bullets : lines

  return rawBullets.map(stripInlineMarkdown).filter(Boolean)
}

function stripInlineMarkdown(line) {
  return line
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/__(.+?)__/g, '$1')       // __bold__
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, '$1') // *italic*, not part of **
    .replace(/^#{1,6}\s*/, '')         // stray markdown heading marker
    .trim()
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

Write exactly 3-4 short bullet points, one per line, each starting with "- ",
plain text, no markdown bold/headers, each bullet a single sentence (12-20
words). Cover, in order: (1) what the overall score means in practical
terms, (2) which specific stop or factor is the biggest concern and why,
(3) one other route-specific consideration if relevant (solo travel,
weather, connectivity), (4) end with a bullet pointing the tourist to "the
safety recommendations below" rather than restating them. Speak directly to
the tourist ("you"), be specific to the route above, not generic advice.`

  try {
    const result = await generateContentWithTimeout(model, prompt)
    const text = result.response.text().trim()
    if (!text) throw new Error('Gemini returned an empty advisory')
    const advisory = parseAdvisoryBullets(text)
    logger.info({ tsiScore, tsiLabel }, 'Gemini safety advisory generated')
    return { advisory, source: 'GEMINI_AI' }
  } catch (err) {
    logger.error({ err: { message: err.message } }, 'Gemini safety advisory failed — using fallback')
    return { advisory: fallbackAdvisory({ tsiScore, tsiLabel, worstStop, hasRecommendations: (recommendations || []).length > 0 }), source: 'OFFLINE_FALLBACK' }
  }
}

// Same "AI explains an ALREADY-COMPUTED decision" boundary as
// generateSafetyAdvisory above -- every number in `scored` (cost, duration,
// safety score, which stop is riskiest) came from travelScoring.service.js,
// a pure deterministic module. This function's only job is prose: why this
// specific order/route makes sense for this traveller, in plain language.
// It must never restate or contradict a number -- the prompt says so
// explicitly, same discipline as the safety-advisory prompt.
function fallbackJourneyNarrative(scored) {
  const bullets = [`Fits your ${scored.daysNeeded}-day timeframe and an estimated ₹${scored.totalCostInr.toLocaleString('en-IN')} budget.`]
  if (scored.orderedStops.length > 1) {
    bullets.push(`Visits ${scored.orderedStops.map((s) => s.name).join(' → ')}, ordered to minimise backtracking.`)
  }
  if (scored.safety.worstStop) {
    bullets.push(`${scored.safety.worstStop.city} is the highest-risk stop on this route (${scored.safety.worstStop.label}) — see the safety notes below.`)
  }
  if (scored.localSpendEstimated) {
    bullets.push('Local spend for some stops is an estimate — no traveller reviews with cost data yet for those destinations.')
  }
  return bullets
}

async function generateJourneyNarrative(scored) {
  const model = getGeminiModel()
  if (!model) {
    logger.info('Gemini not available — using templated journey narrative')
    return { whyThisRoute: fallbackJourneyNarrative(scored), source: 'TEMPLATED_FALLBACK' }
  }

  const stopsList = scored.orderedStops.map((s, i) =>
    `${i + 1}. ${s.name}, ${s.state}${s.matchedInterests?.length ? ` (matches: ${s.matchedInterests.join(', ')})` : ''}${s.reviewSummary ? ` — ${s.reviewSummary.reviewCount} traveller review(s), avg rating ${s.reviewSummary.avgRating}/5` : ' — no traveller reviews yet'}`
  ).join('\n')
  const legsList = scored.legs.map((l) =>
    `${l.fromName} → ${l.toName}: ${l.mode}, ~${Math.round(l.durationMinutes / 60)}h, ₹${l.costMinInr}-${l.costMaxInr}${l.estimated ? ' (estimated)' : ''}`
  ).join('\n')

  const prompt = `You are a travel planning assistant for Northeast India. A deterministic
scoring system has ALREADY computed every number below — do not invent a
different number, cost, duration, or safety score, and do not contradict
them. Your job is only to explain, in plain and genuinely helpful language,
why this specific route and order makes sense for this traveller.

Route (in the recommended order):
${stopsList}

Legs:
${legsList}

Total estimated cost: ₹${scored.totalCostInr.toLocaleString('en-IN')}
Days needed: ${scored.daysNeeded}
Overall fit score: ${scored.scores.overall}/100 (budget ${scored.scores.budget}, safety ${scored.scores.safety}, interest match ${scored.scores.interestMatch}, route efficiency ${scored.scores.backtracking})
Highest-risk stop: ${scored.safety.worstStop?.city || 'none'} (${scored.safety.worstStop?.label || 'n/a'})

Write exactly 3-5 short bullet points, one per line, each starting with "- ",
plain text, no markdown bold/headers. Cover: (1) why this order avoids
unnecessary backtracking, (2) how it fits the budget/timeframe, (3) what
traveller reviews say about the stops, if any exist, (4) the one safety
consideration worth flagging. Speak directly to the traveller ("you").`

  try {
    const result = await generateContentWithTimeout(model, prompt)
    const text = result.response.text().trim()
    if (!text) throw new Error('Gemini returned an empty journey narrative')
    const whyThisRoute = parseAdvisoryBullets(text)
    logger.info({ stops: scored.orderedStops.length, cost: scored.totalCostInr }, 'Gemini journey narrative generated')
    return { whyThisRoute, source: 'GEMINI_AI' }
  } catch (err) {
    logger.error({ err: { message: err.message } }, 'Gemini journey narrative failed — using templated fallback')
    return { whyThisRoute: fallbackJourneyNarrative(scored), source: 'TEMPLATED_FALLBACK' }
  }
}

// Free-text follow-up ("I only have ₹12k now", "drop Dawki") -> structured
// filter deltas. This is the one place Gemini is allowed to produce
// something other than prose over already-computed facts -- but note what
// it is NOT allowed to do: it never outputs a cost, duration, or safety
// score itself, only which existing filters changed. Those deltas get
// re-run through the exact same deterministic scorer, so a hallucinated
// number here is structurally impossible, not just discouraged by a prompt.
async function extractPlanningIntent(freeText, currentContext) {
  const model = getGeminiModel()
  if (!model) {
    logger.info('Gemini not available — cannot parse free-text planning intent')
    return { understood: false, source: 'OFFLINE_FALLBACK' }
  }

  const prompt = `A traveller planning a trip in Northeast India sent this follow-up message:
"${freeText}"

Current plan context: budget ₹${currentContext.budgetInr ?? 'unset'}, ${currentContext.days ?? 'unset'} days,
stops: ${(currentContext.stopNames || []).join(', ') || 'none yet'}, interests: ${(currentContext.interests || []).join(', ') || 'none'}.

Return ONLY a valid JSON object (no markdown, no code blocks) with any of
these keys that changed, omitting keys that didn't:
{"budgetInr": number, "days": number, "dropStopNames": ["string"], "addInterests": ["NATURE"|"ADVENTURE"|"CULTURE"|"WILDLIFE"|"RELAXATION"], "understood": boolean}
Set "understood" to false if the message isn't a planning adjustment at all.`

  try {
    const result = await generateContentWithTimeout(model, prompt)
    const text = result.response.text()
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    logger.info({ freeText, parsed }, 'Gemini planning intent extracted')
    return { ...parsed, understood: parsed.understood !== false, source: 'GEMINI_AI' }
  } catch (err) {
    logger.error({ err: { message: err.message } }, 'Gemini intent extraction failed')
    return { understood: false, source: 'OFFLINE_FALLBACK' }
  }
}

module.exports = { generatePackingList, generateSafetyAdvisory, generateJourneyNarrative, extractPlanningIntent }
