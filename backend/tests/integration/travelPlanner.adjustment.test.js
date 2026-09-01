// tests/integration/travelPlanner.adjustment.test.js
// Automated coverage of the one place this feature writes to the
// database -- applyTripAdjustment. Everything else in the travel-planner
// feature is live-verified by hand (see chatbot.md and the plan history
// for why: this codebase has no existing seeded-fixture pattern for
// destinations/typical_routes in the isolated test DB, and building one
// for the whole feature would be real new testing infrastructure). This
// file seeds only the couple of rows it needs, inline, the same "create
// what you need in the test itself" pattern auth.test.js already uses for
// tourists -- scoped narrowly to the actual mutation boundary: ownership
// isolation, and rejecting an itinerary that references a destination
// that doesn't exist.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import app from '../../src/app.js'
import { getPool } from '../../src/database/pool.js'

const request = supertest(app)

describe('Travel Planner — applyTripAdjustment (mutation boundary)', () => {
  const phoneA = '8000000101'
  const phoneB = '8000000102'
  let tokenA, tokenB, tripId
  let destA, destB

  beforeAll(async () => {
    const pool = getPool()
    const { rows } = await pool.query(
      `INSERT INTO destinations (name, state, latitude, longitude, connectivity, difficulty, altitude_m, zone_type, popularity_index)
       VALUES
         ('Test Stop Alpha', 'Meghalaya', 25.5788, 91.8933, 'GOOD', 'EASY', 1000, 'SAFE', 50),
         ('Test Stop Beta',  'Meghalaya', 25.3000, 91.7000, 'MODERATE', 'MODERATE', 1200, 'CAUTION', 40)
       RETURNING id, name`
    )
    destA = rows[0]; destB = rows[1]

    // Verhoeff-checksum-valid Aadhaar numbers (see auth.validator.js) --
    // deliberately DIFFERENT from the ones tests/integration/auth.test.js
    // uses, even though govt_id_hash isn't cleaned up until that file's
    // own afterAll runs: vitest doesn't guarantee file execution order/
    // isolation, and govt_id_hash is UNIQUE, so reusing the same number
    // here risks a spurious collision depending on run order.
    const regA = await request.post('/api/auth/register').send({
      fullName: 'Adjust Test A', phone: phoneA, govtIdType: 'AADHAAR', govtIdNumber: '234567890124',
      password: 'Test@1234', emergencyContacts: [{ name: 'Parent', phone: '9876500001', relation: 'Parent' }],
    })
    tokenA = regA.body.data.token

    const regB = await request.post('/api/auth/register').send({
      fullName: 'Adjust Test B', phone: phoneB, govtIdType: 'AADHAAR', govtIdNumber: '700000000000',
      password: 'Test@1234', emergencyContacts: [{ name: 'Parent', phone: '9876500002', relation: 'Parent' }],
    })
    tokenB = regB.body.data.token

    const trip = await request.post('/api/trips').set('Authorization', `Bearer ${tokenA}`).send({
      title: 'Adjustment test trip',
      startDate: '2026-11-01',
      endDate: '2026-11-04',
      stops: [{ city: destA.name, state: 'Meghalaya', destinationId: destA.id, days: 3 }],
      budgetInr: 10000,
    })
    tripId = trip.body.data.id
  })

  afterAll(async () => {
    const pool = getPool()
    await pool.query('DELETE FROM trips WHERE id = $1', [tripId])
    await pool.query('DELETE FROM destinations WHERE id = ANY($1)', [[destA.id, destB.id]])
    await pool.query('DELETE FROM tourists WHERE phone = ANY($1)', [[phoneA, phoneB]])
  })

  it('rejects a different tourist adjusting this trip (ownership isolation)', async () => {
    const res = await request.post(`/api/travel-planner/trips/${tripId}/adjust`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ freeText: 'reduce my budget' })
    expect(res.status).toBe(404)
  })

  it('rejects a different tourist applying an adjustment to this trip (ownership isolation)', async () => {
    const res = await request.post(`/api/travel-planner/trips/${tripId}/apply-adjustment`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ orderedStopIds: [destA.id], days: 3 })
    expect(res.status).toBe(404)
  })

  it('rejects an apply-adjustment with no stops (schema-level)', async () => {
    const res = await request.post(`/api/travel-planner/trips/${tripId}/apply-adjustment`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderedStopIds: [], days: 3 })
    expect(res.status).toBe(400)
  })

  it('rejects an apply-adjustment referencing a destination that does not exist', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request.post(`/api/travel-planner/trips/${tripId}/apply-adjustment`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderedStopIds: [fakeId], days: 3 })
    expect(res.status).toBe(422)
  })

  it('applies a valid adjustment and recomputes the trip server-side, never trusting a client-supplied cost', async () => {
    // No cost/budget field in this request at all -- see the validator
    // and travelPlanner.service.js#applyTripAdjustment for why: the
    // server always derives totalCostInr itself from the stop ids.
    const res = await request.post(`/api/travel-planner/trips/${tripId}/apply-adjustment`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderedStopIds: [destA.id, destB.id], days: 4 })
    expect(res.status).toBe(200)
    expect(res.body.data.stops).toHaveLength(2)
    expect(res.body.data.budget_inr).toBeGreaterThan(0)
    expect(res.body.data.tsi_score).toBeDefined()
  })
})
