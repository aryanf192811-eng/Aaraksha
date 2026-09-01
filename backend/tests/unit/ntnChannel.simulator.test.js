// tests/unit/ntnChannel.simulator.test.js
import { describe, it, expect } from 'vitest'
import { sampleChannel, attemptUplink } from '../../src/simulators/ntnChannel.js'
import { NTN_SCENARIOS } from '../../src/constants/enums.js'

describe('NTN Channel Simulator — sampleChannel', () => {
  it('CLEAR_SKY is always visible with high signal and low loss', () => {
    for (let i = 0; i < 20; i++) {
      const c = sampleChannel(NTN_SCENARIOS.CLEAR_SKY)
      expect(c.satelliteVisible).toBe(true)
      expect(c.signalPct).toBeGreaterThanOrEqual(78)
      expect(c.signalPct).toBeLessThanOrEqual(92)
      expect(c.packetLossPct).toBeLessThanOrEqual(2)
    }
  })

  it('MOUNTAIN_VALLEY has lower signal and higher loss than CLEAR_SKY', () => {
    const valley = sampleChannel(NTN_SCENARIOS.MOUNTAIN_VALLEY)
    expect(valley.satelliteVisible).toBe(true)
    expect(valley.signalPct).toBeLessThanOrEqual(50)
    expect(valley.latencyMs).toBeGreaterThanOrEqual(650)
  })

  it('NO_VISIBILITY reports no satellite and zero signal', () => {
    const none = sampleChannel(NTN_SCENARIOS.NO_VISIBILITY)
    expect(none.satelliteVisible).toBe(false)
    expect(none.signalPct).toBe(0)
    expect(none.packetLossPct).toBe(100)
  })

  it('falls back to CLEAR_SKY for an unrecognized scenario', () => {
    const c = sampleChannel('NOT_A_REAL_SCENARIO')
    expect(c.scenario).toBe(NTN_SCENARIOS.CLEAR_SKY)
    expect(c.satelliteVisible).toBe(true)
  })
})

describe('NTN Channel Simulator — attemptUplink', () => {
  it('fails immediately with no delay when the satellite is not visible', async () => {
    const channel = sampleChannel(NTN_SCENARIOS.NO_VISIBILITY)
    const result = await attemptUplink(channel)
    expect(result.delivered).toBe(false)
    expect(result.delayMs).toBe(0)
  })

  it('delivers a CLEAR_SKY uplink far more often than it fails', async () => {
    const outcomes = await Promise.all(
      Array.from({ length: 30 }, () => attemptUplink(sampleChannel(NTN_SCENARIOS.CLEAR_SKY)))
    )
    const delivered = outcomes.filter((o) => o.delivered).length
    expect(delivered).toBeGreaterThan(20)
  })
})
