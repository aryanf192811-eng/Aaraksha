// tests/integration/auth.test.js
import { describe, it, expect, afterAll } from 'vitest'
import supertest from 'supertest'
import app from '../../src/app.js'
import { getPool } from '../../src/database/pool.js'

const request = supertest(app)

describe('Auth API — Tourist Registration and Login', () => {
  const testPhone = '8000000001'
  let authToken

  // This suite registers real rows against DATABASE_TEST_URL. Without cleanup,
  // a second run collides with the first (duplicate phone -> 409 instead of
  // 201) and every test after it cascades into unrelated failures.
  afterAll(async () => {
    await getPool().query('DELETE FROM tourists WHERE phone = ANY($1)', [[testPhone, '8000000002']])
  })

  it('POST /api/auth/register — succeeds with valid data', async () => {
    const res = await request.post('/api/auth/register').send({
      fullName:    'Test User',
      phone:       testPhone,
      govtIdType:  'AADHAAR',
      govtIdNumber:'111122223333',
      password:    'Test@1234',
      emergencyContacts: [{ name: 'Parent', phone: '9876543210', relation: 'Parent' }],
    })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.tourist.phone).toBe(testPhone)
    authToken = res.body.data.token
  })

  it('POST /api/auth/register — rejects duplicate phone', async () => {
    const res = await request.post('/api/auth/register').send({
      fullName:    'Duplicate',
      phone:       testPhone,
      govtIdType:  'AADHAAR',
      govtIdNumber:'444455556666',
      password:    'Test@1234',
      emergencyContacts: [{ name: 'Parent', phone: '9876543210', relation: 'Parent' }],
    })
    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
  })

  it('POST /api/auth/register — rejects invalid Aadhaar format', async () => {
    const res = await request.post('/api/auth/register').send({
      fullName:    'Bad Aadhaar',
      phone:       '8000000002',
      govtIdType:  'AADHAAR',
      govtIdNumber:'123',  // too short
      password:    'Test@1234',
      emergencyContacts: [{ name: 'P', phone: '9876543210', relation: 'Parent' }],
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/auth/login — succeeds with correct credentials', async () => {
    const res = await request.post('/api/auth/login').send({ phone: testPhone, password: 'Test@1234' })
    expect(res.status).toBe(200)
    expect(res.body.data.token).toBeDefined()
  })

  it('POST /api/auth/login — rejects wrong password', async () => {
    const res = await request.post('/api/auth/login').send({ phone: testPhone, password: 'WrongPass' })
    expect(res.status).toBe(401)
  })

  it('GET /api/tourists/me — returns profile with valid token', async () => {
    const res = await request.get('/api/tourists/me').set('Authorization', `Bearer ${authToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.phone).toBe(testPhone)
    expect(res.body.data.password_hash).toBeUndefined()  // Never exposed
  })

  it('GET /api/tourists/me — rejects without token', async () => {
    const res = await request.get('/api/tourists/me')
    expect(res.status).toBe(401)
  })
})

describe('Auth API — Forgot Password OTP Flow', () => {
  it('POST /api/auth/forgot-password — always returns 200 (anti-enumeration)', async () => {
    const res = await request.post('/api/auth/forgot-password').send({ phone: '9999999999' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('POST /api/auth/forgot-password — also 200 for non-existent phone', async () => {
    const res = await request.post('/api/auth/forgot-password').send({ phone: '0000000000' })
    expect(res.status).toBe(200)  // Anti-enumeration: same response
  })

  it('POST /api/auth/verify-otp — rejects invalid OTP', async () => {
    const res = await request.post('/api/auth/verify-otp').send({
      phone: '9999999999', otp: '000000'
    })
    expect(res.status).toBe(400)
  })
})
