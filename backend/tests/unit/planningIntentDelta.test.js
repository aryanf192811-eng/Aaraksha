// tests/unit/planningIntentDelta.test.js
// Regression coverage for the "sometimes works, sometimes doesn't" budget-
// reduction bug: Gemini used to be asked to compute the resulting budget
// itself ("current minus 4000"), which is LLM sampling variance on
// arithmetic. resolveDeltas() is the deterministic replacement -- Gemini
// only ever reports a signed delta or an absolute value, this function does
// the math. No live Gemini call needed; this tests the part that used to be
// unreliable in isolation.
import { describe, it, expect } from 'vitest'
import { resolveDeltas } from '../../src/services/gemini.service.js'

describe('gemini.service — resolveDeltas', () => {
  it('applies a negative budget delta against the current budget', () => {
    const result = resolveDeltas({ budgetDeltaInr: -4000, understood: true }, { budgetInr: 20000, days: 5 })
    expect(result.budgetInr).toBe(16000)
    expect(result.budgetDeltaInr).toBeUndefined()
  })

  it('applies a positive budget delta against the current budget', () => {
    const result = resolveDeltas({ budgetDeltaInr: 3000 }, { budgetInr: 12000, days: 5 })
    expect(result.budgetInr).toBe(15000)
  })

  it('leaves an absolute budgetInr untouched when no delta is present', () => {
    const result = resolveDeltas({ budgetInr: 12000 }, { budgetInr: 20000, days: 5 })
    expect(result.budgetInr).toBe(12000)
  })

  it('never lets a budget delta drive the total below zero', () => {
    const result = resolveDeltas({ budgetDeltaInr: -50000 }, { budgetInr: 10000, days: 5 })
    expect(result.budgetInr).toBe(0)
  })

  it('ignores a delta when there is no current numeric budget to apply it against', () => {
    const result = resolveDeltas({ budgetDeltaInr: -4000 }, { budgetInr: undefined, days: 5 })
    expect(result.budgetInr).toBeUndefined()
    expect(result.budgetDeltaInr).toBeUndefined()
  })

  it('applies a days delta the same way as budget', () => {
    const result = resolveDeltas({ daysDelta: -2 }, { budgetInr: 20000, days: 6 })
    expect(result.days).toBe(4)
  })

  it('never lets a days delta drop below 1', () => {
    const result = resolveDeltas({ daysDelta: -10 }, { budgetInr: 20000, days: 3 })
    expect(result.days).toBe(1)
  })

  it('rounds a fractional delta result to a whole number', () => {
    const result = resolveDeltas({ budgetDeltaInr: -1500.7 }, { budgetInr: 10000.4, days: 5 })
    expect(Number.isInteger(result.budgetInr)).toBe(true)
  })
})
