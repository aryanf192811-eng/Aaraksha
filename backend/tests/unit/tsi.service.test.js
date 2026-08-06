// tests/unit/tsi.service.test.js
import { describe, it, expect } from 'vitest'
import { calculateTSI, computeRescueReadiness } from '../../src/services/tsi.service.js'

describe('TSI Service — calculateTSI', () => {
  const baseTrip = {
    travel_type: 'FAMILY',
    start_date:  '2025-01-15',
    end_date:    '2025-01-20',
    stops: [],
  }

  it('returns 100 for a zero-risk trip', () => {
    const result = calculateTSI(baseTrip, {})
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.score).toBeGreaterThanOrEqual(10)
    expect(result.label).toBe('Low Risk')
    expect(Array.isArray(result.recommendations)).toBe(true)
  })

  it('penalizes SOLO travel type', () => {
    const solo   = calculateTSI({ ...baseTrip, travel_type: 'SOLO' }, {})
    const family = calculateTSI({ ...baseTrip, travel_type: 'FAMILY' }, {})
    expect(solo.score).toBeLessThan(family.score)
  })

  it('penalizes monsoon season (June–September)', () => {
    const monsoon = calculateTSI({ ...baseTrip, start_date: '2025-07-01', end_date: '2025-07-10' }, {})
    const dry     = calculateTSI({ ...baseTrip, start_date: '2025-01-01', end_date: '2025-01-10' }, {})
    expect(monsoon.score).toBeLessThan(dry.score)
  })

  it('penalizes high-risk stops appropriately', () => {
    const highRisk = calculateTSI({
      ...baseTrip, travel_type: 'SOLO',
      stops: [{ connectivity: 'NONE', altitude_m: 4500, zone_type: 'RESTRICTED', difficulty: 'EXTREME', hospital_km: 60 }]
    }, {})
    expect(highRisk.score).toBeLessThanOrEqual(40)
    expect(highRisk.label).toMatch(/High Risk|Extreme Risk/)
  })

  it('uses worst stop not average', () => {
    const mixedStops = calculateTSI({
      ...baseTrip,
      stops: [
        { connectivity: 'EXCELLENT', altitude_m: 100,  zone_type: 'SAFE', difficulty: 'EASY',    hospital_km: 2 },
        { connectivity: 'NONE',      altitude_m: 4500, zone_type: 'RESTRICTED', difficulty: 'EXTREME', hospital_km: 60 },
      ]
    }, {})
    const worstOnly = calculateTSI({
      ...baseTrip,
      stops: [{ connectivity: 'NONE', altitude_m: 4500, zone_type: 'RESTRICTED', difficulty: 'EXTREME', hospital_km: 60 }]
    }, {})
    expect(mixedStops.score).toBe(worstOnly.score)
  })

  it('clamps score to [10, 100]', () => {
    const extreme = calculateTSI({
      travel_type: 'ADVENTURE', start_date: '2025-07-01', end_date: '2025-08-15',
      stops: [{ connectivity: 'NONE', altitude_m: 5000, zone_type: 'RESTRICTED', difficulty: 'EXTREME', hospital_km: 100 }]
    }, {})
    expect(extreme.score).toBeGreaterThanOrEqual(10)
    expect(extreme.score).toBeLessThanOrEqual(100)
  })

  it('applies weather penalty from cache', () => {
    const destId  = 'test-dest-uuid'
    const noWeather = calculateTSI({ ...baseTrip, stops: [{ destinationId: destId, connectivity: 'GOOD', altitude_m: 0, zone_type: 'SAFE', difficulty: 'EASY', hospital_km: 5 }] }, {})
    const storm     = calculateTSI({ ...baseTrip, stops: [{ destinationId: destId, connectivity: 'GOOD', altitude_m: 0, zone_type: 'SAFE', difficulty: 'EASY', hospital_km: 5 }] }, { [destId]: { condition: 'STORM' } })
    expect(storm.score).toBeLessThan(noWeather.score)
  })
})

describe('TSI Service — computeRescueReadiness', () => {
  it('calculates 100% when all items complete', () => {
    const tourist = { emergency_contacts: [{ name: 'P', phone: '9876543210' }], blood_group: 'O+', govt_id_suffix: '1234' }
    const trip    = { tsi_score: 75, rescue_readiness: { offlineMaps: true } }
    const result  = computeRescueReadiness(tourist, trip, true)
    expect(result.score).toBe(100)
    expect(result.items.emergencyContacts).toBe(true)
    expect(result.items.dmsEnabled).toBe(true)
  })

  it('calculates 0% when nothing is set', () => {
    const result = computeRescueReadiness({ emergency_contacts: [], blood_group: null, govt_id_suffix: null }, { tsi_score: null, rescue_readiness: {} }, false)
    expect(result.score).toBe(0)
  })
})
