// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { cn, formatDate, formatDateTime, formatTimeAgo, formatINR, getTSIColors, getZoneColor, formatCountdown } from './utils'

describe('cn', () => {
  it('merges plain class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })
  it('lets a later Tailwind class win a conflict', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })
})

describe('formatCountdown', () => {
  it('formats sub-minute seconds as m:ss', () => {
    expect(formatCountdown(5)).toBe('0:05')
  })
  it('formats minutes and seconds, zero-padded', () => {
    expect(formatCountdown(125)).toBe('2:05')
  })
  it('switches to "h m" once past an hour', () => {
    expect(formatCountdown(3661)).toBe('1h 1m')
  })
  it('handles zero', () => {
    expect(formatCountdown(0)).toBe('0:00')
  })
})

describe('formatINR', () => {
  it('formats a whole rupee amount with the currency symbol and grouping', () => {
    expect(formatINR(25000)).toBe('₹25,000')
  })
  it('rounds off fractional paise (maximumFractionDigits: 0)', () => {
    expect(formatINR(999.6)).toBe('₹1,000')
  })
})

describe('getTSIColors', () => {
  it('returns the neutral "not calculated" state for null', () => {
    expect(getTSIColors(null).label).toBe('Not calculated')
  })
  it('labels 80+ as Low Risk', () => {
    expect(getTSIColors(85).label).toBe('Low Risk')
  })
  it('labels the 60-79 band as Moderate Risk', () => {
    expect(getTSIColors(65).label).toBe('Moderate Risk')
  })
  it('labels the 40-59 band as High Risk', () => {
    expect(getTSIColors(45).label).toBe('High Risk')
  })
  it('labels anything under 40 as Extreme Risk', () => {
    expect(getTSIColors(20).label).toBe('Extreme Risk')
  })
})

describe('getZoneColor', () => {
  it('maps a known zone type to its color class', () => {
    expect(getZoneColor('RESTRICTED')).toBe('text-red-600')
  })
  it('falls back to a neutral color for an unknown zone type', () => {
    expect(getZoneColor('UNKNOWN')).toBe('text-slate-600')
  })
})

describe('formatDate / formatDateTime / formatTimeAgo', () => {
  it('formats a date as "d MMM yyyy"', () => {
    expect(formatDate('2025-03-05T12:00:00Z')).toBe('5 Mar 2025')
  })
  it('formats a date-time as "d MMM yyyy, HH:mm"', () => {
    expect(formatDateTime('2025-03-05T14:30:00Z')).toBe('5 Mar 2025, 14:30')
  })
  it('formats a relative time with a suffix', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(oneHourAgo)).toMatch(/ago$/)
  })
})
