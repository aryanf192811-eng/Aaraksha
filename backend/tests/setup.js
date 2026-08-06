// tests/setup.js
'use strict'

require('dotenv').config()  // Load .env BEFORE reading DATABASE_TEST_URL below

process.env.NODE_ENV    = 'test'
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL || 'postgresql://postgres:postgres@localhost:5432/aaraksha_test'
process.env.JWT_SECRET   = 'test-secret-minimum-32-characters-long-abc'
process.env.GOVT_ID_SECRET = 'test-govt-secret-32-chars-minimum-ok'
process.env.GUARDIAN_SECRET = 'test-guardian-secret-32-chars-ok'
process.env.PORT = '5001'
process.env.TOURIST_FRONTEND_URL = 'http://localhost:5173'
process.env.GOVT_FRONTEND_URL    = 'http://localhost:5174'
process.env.GUARDIAN_FRONTEND_URL = 'http://localhost:5175'
process.env.BCRYPT_ROUNDS = '1'  // Speed up tests — 1 round is fine for testing
