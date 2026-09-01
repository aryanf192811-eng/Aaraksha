// tests/unit/travelScoring.service.test.js
import { describe, it, expect } from 'vitest'
import {
  scoreCandidateItinerary, orderStopsGreedy, backtrackingRatio,
  budgetFitScore, durationFitScore, interestMatchScore, applyIntentToStops,
} from '../../src/services/travelScoring.service.js'

const GUWAHATI = { lat: 26.1445, lng: 91.7362, name: 'Guwahati' }

const SHILLONG = { id: 's1', name: 'Shillong', state: 'Meghalaya', latitude: 25.5788, longitude: 91.8933, connectivity: 'GOOD', difficulty: 'EASY', altitude_m: 1496, zone_type: 'SAFE', nearest_hospital_km: 3, description: 'Scenic hill station, waterfalls', popularity_index: 80 }
const CHERRAPUNJI = { id: 's2', name: 'Cherrapunji', state: 'Meghalaya', latitude: 25.3, longitude: 91.7, connectivity: 'MODERATE', difficulty: 'MODERATE', altitude_m: 1484, zone_type: 'CAUTION', nearest_hospital_km: 20, description: 'Living root bridges, trekking, waterfalls', popularity_index: 75 }
const MAWLYNNONG = { id: 's3', name: 'Mawlynnong', state: 'Meghalaya', latitude: 25.2, longitude: 91.9, connectivity: 'POOR', difficulty: 'EASY', altitude_m: 1050, zone_type: 'SAFE', nearest_hospital_km: 40, description: 'Cleanest village, nature walk', popularity_index: 60 }

describe('travelScoring — orderStopsGreedy / backtrackingRatio', () => {
  it('orders stops nearest-first from the origin', () => {
    const ordered = orderStopsGreedy(GUWAHATI, [MAWLYNNONG, SHILLONG, CHERRAPUNJI])
    expect(ordered[0].id).toBe('s1') // Shillong is closest to Guwahati
  })

  it('gives a route already in greedy order a ratio of ~1', () => {
    const ordered = orderStopsGreedy(GUWAHATI, [SHILLONG, CHERRAPUNJI, MAWLYNNONG])
    expect(backtrackingRatio(GUWAHATI, ordered)).toBeCloseTo(1, 1)
  })

  it('penalizes a zigzag order with a ratio > 1', () => {
    // Guwahati -> Cherrapunji -> Shillong -> Mawlynnong backtracks through Shillong
    const zigzag = [CHERRAPUNJI, SHILLONG, MAWLYNNONG]
    expect(backtrackingRatio(GUWAHATI, zigzag)).toBeGreaterThan(1)
  })
})

describe('travelScoring — budgetFitScore / durationFitScore', () => {
  it('scores 100 when within budget', () => {
    expect(budgetFitScore(10000, 20000)).toBe(100)
  })
  it('penalizes going over budget proportionally', () => {
    const score = budgetFitScore(24000, 20000) // 20% over
    expect(score).toBeLessThan(100)
    expect(score).toBeGreaterThan(0)
  })
  it('scores 100 when the plan fits inside the available days', () => {
    expect(durationFitScore(3 * 24 * 60, 6)).toBe(100)
  })
  it('penalizes a plan that needs more time than available', () => {
    expect(durationFitScore(10 * 24 * 60, 6)).toBeLessThan(100)
  })
})

describe('travelScoring — interestMatchScore', () => {
  it('matches ADVENTURE against a description containing "trekking"', () => {
    const { score, matchedPerStop } = interestMatchScore([CHERRAPUNJI], ['ADVENTURE'])
    expect(score).toBe(100)
    expect(matchedPerStop[0]).toContain('ADVENTURE')
  })
  it('returns a neutral score when no interests are given', () => {
    expect(interestMatchScore([SHILLONG], []).score).toBe(70)
  })
})

describe('travelScoring — scoreCandidateItinerary (integration of the pure pieces)', () => {
  const legsByPair = new Map() // empty -- forces the haversine-estimate fallback path

  it('returns a fully-scored itinerary with every number computed, not invented', () => {
    const result = scoreCandidateItinerary({
      origin: GUWAHATI,
      destinations: [SHILLONG, CHERRAPUNJI, MAWLYNNONG],
      legsByPair,
      reviewSummaryById: new Map(),
      budgetInr: 20000,
      days: 6,
      interests: ['NATURE'],
    })
    expect(result.orderedStops).toHaveLength(3)
    expect(result.legs).toHaveLength(3)
    expect(result.totalCostInr).toBeGreaterThan(0)
    expect(result.scores.overall).toBeGreaterThanOrEqual(0)
    expect(result.scores.overall).toBeLessThanOrEqual(100)
    expect(result.legs.every((l) => l.estimated)).toBe(true) // empty legsByPair -> all estimated
    expect(result.localSpendEstimated).toBe(true) // empty reviewSummaryById -> all estimated
  })

  it('flags a route through a HIGH_RISK/RESTRICTED-style stop with a lower safety score', () => {
    const risky = { ...CHERRAPUNJI, id: 's4', zone_type: 'RESTRICTED', connectivity: 'NONE', difficulty: 'EXTREME' }
    const safeResult = scoreCandidateItinerary({ origin: GUWAHATI, destinations: [SHILLONG], legsByPair, reviewSummaryById: new Map(), budgetInr: 20000, days: 6, interests: [] })
    const riskyResult = scoreCandidateItinerary({ origin: GUWAHATI, destinations: [risky], legsByPair, reviewSummaryById: new Map(), budgetInr: 20000, days: 6, interests: [] })
    expect(riskyResult.scores.safety).toBeLessThan(safeResult.scores.safety)
  })

  it('uses real review cost data when available instead of the fallback estimate', () => {
    const reviewSummaryById = new Map([['s1', { avgCostInr: 500 }]])
    const result = scoreCandidateItinerary({ origin: GUWAHATI, destinations: [SHILLONG], legsByPair, reviewSummaryById, budgetInr: 20000, days: 6, interests: [] })
    expect(result.localSpendEstimated).toBe(false)
  })
})

// The actual new decidable logic behind AI-assisted trip adjustment --
// see the header comment on applyIntentToStops itself for why this gets
// hard unit-test coverage instead of a mocked Gemini integration test.
describe('travelScoring — applyIntentToStops', () => {
  const currentStops = [SHILLONG, CHERRAPUNJI]

  it('drops a stop matched by name (case-insensitive)', () => {
    const result = applyIntentToStops(currentStops, { dropStopNames: ['cherrapunji'] })
    expect(result.map((d) => d.id)).toEqual(['s1'])
  })

  it('treats a name with no match as a no-op, never an invented removal', () => {
    const result = applyIntentToStops(currentStops, { dropStopNames: ['Dawki'] })
    expect(result).toHaveLength(2)
  })

  it('dropping every stop returns an explicit empty result, not an error', () => {
    const result = applyIntentToStops(currentStops, { dropStopNames: ['Shillong', 'Cherrapunji'] })
    expect(result).toEqual([])
  })

  it('adds a candidate matching an interest, without duplicating an existing stop', () => {
    const candidatePool = [MAWLYNNONG, SHILLONG] // SHILLONG already in currentStops
    const result = applyIntentToStops(currentStops, { addInterests: ['NATURE'] }, candidatePool)
    const ids = result.map((d) => d.id)
    expect(ids).toContain('s3') // Mawlynnong added
    expect(ids.filter((id) => id === 's1')).toHaveLength(1) // Shillong not duplicated
  })

  it('leaves stops untouched when the intent has neither drops nor adds', () => {
    const result = applyIntentToStops(currentStops, {})
    expect(result).toHaveLength(2)
  })
})
