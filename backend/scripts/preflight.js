// backend/scripts/preflight.js
// Validates environment and connectivity before build starts.
// Run: node scripts/preflight.js

require('dotenv').config()
const { Client } = require('pg')

const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOVT_ID_SECRET',
  'GUARDIAN_SECRET',
  'PORT',
  'NODE_ENV',
  'TOURIST_FRONTEND_URL',
  'GOVT_FRONTEND_URL',
  'GUARDIAN_FRONTEND_URL',
]

const OPTIONAL_ENV = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM_NUMBER',
  'TWILIO_EMERGENCY_NUMBER',
  'GEMINI_API_KEY',
  'OWM_API_KEY',
]

async function runPreflight() {
  console.log('\n🔍 Aaraksha Backend Pre-flight Check\n')
  let passed = true

  // 1. Required env vars
  console.log('── Environment Variables ──')
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      console.log(`  ❌ MISSING: ${key}`)
      passed = false
    } else {
      const display = key.includes('SECRET') || key.includes('TOKEN')
        ? process.env[key].slice(0, 8) + '...' : process.env[key]
      console.log(`  ✅ ${key} = ${display}`)
    }
  }

  console.log('\n── Optional (External Services) ──')
  for (const key of OPTIONAL_ENV) {
    if (!process.env[key]) {
      console.log(`  ⚠️  NOT SET: ${key} — related features will use fallback mode`)
    } else {
      console.log(`  ✅ ${key} configured`)
    }
  }

  // 2. JWT secret length check
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.log('\n  ❌ JWT_SECRET too short — must be at least 32 characters')
    passed = false
  }

  // 3. Database connectivity
  console.log('\n── Database Connectivity ──')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  try {
    await client.connect()
    const { rows } = await client.query('SELECT version()')
    console.log(`  ✅ PostgreSQL connected: ${rows[0].version.split(' ').slice(0, 2).join(' ')}`)
    await client.end()
  } catch (err) {
    console.log(`  ❌ Database connection failed: ${err.message}`)
    console.log(`     Verify DATABASE_URL and that PostgreSQL is running`)
    passed = false
  }

  // 4. Port availability check
  console.log('\n── Port Availability ──')
  const port = parseInt(process.env.PORT || '5000')
  const net = require('net')
  await new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => {
      console.log(`  ⚠️  Port ${port} is in use — update PORT in .env or kill the existing process`)
      resolve()
    })
    server.once('listening', () => {
      server.close()
      console.log(`  ✅ Port ${port} is available`)
      resolve()
    })
    server.listen(port)
  })

  // Final verdict
  console.log('\n' + '─'.repeat(40))
  if (passed) {
    console.log('✅ All required checks passed — safe to build\n')
    process.exit(0)
  } else {
    console.log('❌ Pre-flight failed — fix the above issues before building\n')
    process.exit(1)
  }
}

runPreflight().catch(err => {
  console.error('Pre-flight script crashed:', err)
  process.exit(1)
})
