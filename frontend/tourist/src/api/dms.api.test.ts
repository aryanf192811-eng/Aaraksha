// src/api/dms.api.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { withSecondsRemaining } from './dms.api'
import type { DMS } from '../types/api.types'

const baseDMS: DMS = {
  id: 'test-dms-id',
  tourist_id: 'test-tourist-id',
  trip_id: null,
  interval_minutes: 60,
  interval_seconds: null,
  last_reset_at: '2025-01-01T00:00:00Z',
  next_trigger_at: '2025-01-01T01:00:00Z',
  warning_sent_at: null,
  status: 'ACTIVE',
  sos_event_id: null,
  created_at: '2025-01-01T00:00:00Z',
}

// create()/reset() return the plain DB row (no seconds_remaining — that's
// only computed by GET /dms/active's own query), so callers that cache a
// create/reset response directly compute it themselves with this helper.
describe('withSecondsRemaining', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('computes seconds remaining until next_trigger_at from "now"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:30Z'))
    expect(withSecondsRemaining(baseDMS).seconds_remaining).toBe(3570) // 1h - 30s
  })

  it('goes negative once the deadline has passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T01:00:10Z'))
    expect(withSecondsRemaining(baseDMS).seconds_remaining).toBe(-10)
  })

  it('preserves every other field on the DMS row unchanged', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
    const result = withSecondsRemaining(baseDMS)
    expect(result.id).toBe(baseDMS.id)
    expect(result.status).toBe(baseDMS.status)
    expect(result.interval_minutes).toBe(baseDMS.interval_minutes)
  })
})
