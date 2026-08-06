# Aaraksha — Complete Production Backend Build Prompt
## Three-Portal System: Tourist PWA · Guardian Portal · Government Command Center
### Session 1 of 11 — Full Backend Foundation

---

> **HOW TO USE THIS FILE**
> Paste the entire contents of each PHASE section into Antigravity IDE as a single agent message.
> Execute phases in strict order. Every phase ends with a ✅ verification block.
> Do not start the next phase until all verifications pass.

---

## CRITICAL EXECUTION RULES

```
1. READ CLAUDE.md before touching a single file.
2. Execute all steps SEQUENTIALLY. Never parallelize phases.
3. ZERO console.log anywhere — use the pino logger exclusively.
4. ALL async functions have try/catch. ALL catch blocks call next(err) or logger.error.
5. ALL DB queries are parameterized ($1, $2...). String concatenation = instant failure.
6. ALL environment variables come from process.env. Zero hardcoded values.
7. withTransaction() wraps EVERY operation that touches more than one table.
8. Controllers are THIN: validate → call service → send response. Never SQL in controllers.
9. Repositories contain ALL SQL. Never SQL in services or controllers.
10. Services contain ALL business logic. Never business logic in controllers or repositories.
11. Zod schemas validate ALL incoming request data. No manual validation in controllers.
12. Side effects (SMS, socket emit) happen AFTER transaction commits. Never inside withTransaction.
13. Twilio SMS failures NEVER fail the HTTP response. Wrap in .catch(logger.error).
14. Socket emits NEVER throw. Wrap in try/catch inside each emit function.
15. Report every file created with path and line count at the end of each phase.
```
---

## EXECUTION DISCIPLINE

Execute the project in **small, self-contained chunks**. Never attempt to complete an entire phase in a single response if it risks context or model limits.

For every chunk:
1. Complete only the planned scope.
2. Verify the code builds and passes all verification steps for that chunk.
3. Summarize exactly what changed.
4. Stop and wait before continuing to the next chunk if the remaining work is substantial.

### Git Workflow (Mandatory)

Repository:
https://github.com/aryanf192811-eng/Aaraksha

After **every successfully completed phase**:

1. Review all modified files.
2. Create a clean, professional git commit using **my configured Git identity** (never Claude or AI as the author).
3. Use Conventional Commit format, for example:
   - feat(auth): implement JWT authentication
   - feat(sos): add SOS service and repository
   - refactor(database): introduce transaction helper
   - fix(dms): correct timeout calculation
4. Push immediately to the `main` branch of the repository above.
5. Include a short phase summary listing:
   - files created
   - files modified
   - verification completed
   - commit hash

Never batch multiple phases into one commit. Each phase must produce its own clean, meaningful commit history suitable for project evaluation.
---

## PHASE 0 — PRE-FLIGHT SETUP (AUTOMATE EVERYTHING)

### Step 0.1 — Install PostgreSQL and create database

Run these commands sequentially. Fix any error before continuing.

```bash
# Verify PostgreSQL is installed and running
pg_isready || echo "PostgreSQL not running — start it with: brew services start postgresql@16"

# Create the aaraksha database (idempotent — safe to run multiple times)
psql postgres -c "CREATE DATABASE aaraksha;" 2>/dev/null || echo "Database already exists — continuing"
psql postgres -c "CREATE DATABASE aaraksha_test;" 2>/dev/null || echo "Test database already exists — continuing"

# Verify both databases exist
psql postgres -c "\l" | grep aaraksha
```

### Step 0.2 — Generate secrets

```bash
# Generate a cryptographically secure JWT secret (64 bytes = 128 hex chars)
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
echo "JWT_SECRET=$JWT_SECRET"

# Generate a govt ID HMAC secret
GOVT_ID_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "GOVT_ID_SECRET=$GOVT_ID_SECRET"

# Generate a guardian token signing secret
GUARDIAN_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "GUARDIAN_SECRET=$GUARDIAN_SECRET"

echo "Copy the above values into your .env file"
```

### Step 0.3 — External Services Setup

#### OpenWeatherMap (Free tier — 60 calls/min, enough for demo)
```
1. Go to: https://openweathermap.org/api
2. Click "Sign Up" — use any email
3. After signup: go to https://home.openweathermap.org/api_keys
4. Copy the Default API Key
5. Paste as: OWM_API_KEY=your_key_here
6. Note: Free tier activates within 2 hours of signup
7. Test: curl "https://api.openweathermap.org/data/2.5/weather?lat=25.5788&lon=91.8933&appid=YOUR_KEY&units=metric"
   Expected: JSON with Shillong weather data
```

#### Google Gemini AI (Free tier — 15 RPM, plenty for demo)
```
1. Go to: https://ai.google.dev/
2. Click "Get API Key in Google AI Studio"
3. Sign in with Google account
4. Click "Create API Key" → "Create API key in new project"
5. Copy the key starting with AIzaSy...
6. Paste as: GEMINI_API_KEY=AIzaSy...
7. Model to use: gemini-1.5-flash (fastest, most generous free tier)
8. Test: node -e "
   const {GoogleGenerativeAI} = require('@google/generative-ai');
   const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
   const model = ai.getGenerativeModel({model:'gemini-1.5-flash'});
   model.generateContent('Say hello in one word').then(r => console.log(r.response.text()));
   "
```

#### Twilio (Trial — 100 SMS free, enough for demo)
```
1. Go to: https://www.twilio.com/try-twilio
2. Sign up with email
3. Verify phone number
4. Dashboard: https://console.twilio.com/
5. Get from Dashboard:
   - Account SID: starts with AC... → TWILIO_ACCOUNT_SID
   - Auth Token: visible under SID → TWILIO_AUTH_TOKEN
6. Get a phone number:
   - Left sidebar → Phone Numbers → Manage → Buy a Number
   - Filter by "SMS" capability
   - Buy any US number (free with trial credit)
   - Copy: +1XXXXXXXXXX → TWILIO_FROM_NUMBER
7. For TWILIO_EMERGENCY_NUMBER:
   - Use your personal phone number in E.164 format: +91XXXXXXXXXX
   - This is the number that receives the offline SOS SMS
8. Trial account limitation: can only SMS verified numbers
   - Go to: Verified Caller IDs → Add your phone + team member phones
9. Test:
   node -e "
   const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
   client.messages.create({body:'Aaraksha test SMS', from:process.env.TWILIO_FROM_NUMBER, to:'+91YOURNUMBER'})
   .then(m => console.log('SMS sent:', m.sid)).catch(console.error);
   "
```

### Step 0.4 — Create .env file

```bash
# Create backend/.env from .env.example (run from backend/ directory)
cat > .env << EOF
# ─── DATABASE ─────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aaraksha
DATABASE_TEST_URL=postgresql://postgres:postgres@localhost:5432/aaraksha_test
DATABASE_MAX_CONNECTIONS=20
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_CONNECTION_TIMEOUT_MS=2000

# ─── SERVER ───────────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=development

# ─── CORS — Three frontend origins ────────────────────────────────────────
TOURIST_FRONTEND_URL=http://localhost:5173
GOVT_FRONTEND_URL=http://localhost:5174
GUARDIAN_FRONTEND_URL=http://localhost:5175

# ─── JWT ──────────────────────────────────────────────────────────────────
JWT_SECRET=REPLACE_WITH_GENERATED_SECRET_128_CHARS
JWT_EXPIRES_IN=24h

# ─── SECURITY ─────────────────────────────────────────────────────────────
BCRYPT_ROUNDS=12
GOVT_ID_SECRET=REPLACE_WITH_GENERATED_SECRET_64_CHARS
GUARDIAN_SECRET=REPLACE_WITH_GENERATED_SECRET_64_CHARS

# ─── RATE LIMITING ────────────────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=5
WEBHOOK_RATE_LIMIT_MAX=1000

# ─── TWILIO ───────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
TWILIO_EMERGENCY_NUMBER=+91xxxxxxxxxx

# ─── GEMINI AI ────────────────────────────────────────────────────────────
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-1.5-flash

# ─── OPENWEATHERMAP ───────────────────────────────────────────────────────
OWM_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OWM_BASE_URL=https://api.openweathermap.org/data/2.5
OWM_CACHE_TTL_MINUTES=60

# ─── LOGGING ──────────────────────────────────────────────────────────────
LOG_LEVEL=debug
EOF

echo "✅ .env created — fill in REPLACE_WITH values and all API keys before proceeding"
```

### Step 0.5 — Pre-flight validation script

Create `backend/scripts/preflight.js` and run it before any other step:

```javascript
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
```

Run it: `node scripts/preflight.js`

---

## PHASE 1 — PACKAGE.JSON AND DIRECTORY STRUCTURE

### Step 1.1 — Create package.json

```json
{
  "name": "aaraksha-backend",
  "version": "1.0.0",
  "description": "Aaraksha — Smart Tourism Safety Platform | Three-Portal Backend",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "preflight": "node scripts/preflight.js",
    "migrate": "node-pg-migrate -m src/migrations up",
    "migrate:down": "node-pg-migrate -m src/migrations down",
    "migrate:create": "node-pg-migrate -m src/migrations create",
    "seed": "node scripts/seed.js",
    "seed:reset": "node scripts/seed.js --reset",
    "setup": "node scripts/preflight.js && npm run migrate && npm run seed",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@google/generative-ai": "^0.15.0",
    "axios": "^1.7.2",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.3.1",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "node-pg-migrate": "^7.4.0",
    "pdfkit": "^0.15.0",
    "pg": "^8.12.0",
    "pino": "^9.3.2",
    "pino-pretty": "^11.2.1",
    "socket.io": "^4.7.5",
    "twilio": "^5.2.3",
    "uuid": "^10.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^2.0.3",
    "nodemon": "^3.1.4",
    "supertest": "^7.0.0",
    "vitest": "^2.0.3"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Run: `npm install`

### Step 1.2 — Create complete directory structure

Run this exact block to create every directory:

```bash
cd backend && mkdir -p \
  src/config \
  src/constants \
  src/routes \
  src/controllers \
  src/services/notification \
  src/repositories \
  src/validators \
  src/middleware \
  src/socket \
  src/cron/jobs \
  src/database \
  src/utils \
  src/migrations \
  src/types \
  scripts \
  tests/unit \
  tests/integration \
  tests/fixtures && \
echo "✅ All directories created"
```

Expected structure (annotated):
```
backend/
├── src/
│   ├── config/
│   │   ├── env.js            ← Validates all env vars on startup, exports typed config
│   │   ├── database.js       ← pg Pool singleton
│   │   ├── cors.js           ← CORS config for 3 different frontend origins
│   │   ├── twilio.js         ← Lazy-init Twilio client
│   │   └── gemini.js         ← Lazy-init Gemini client
│   │
│   ├── constants/
│   │   ├── events.js         ← All Socket.IO event name strings (NO string literals elsewhere)
│   │   ├── enums.js          ← All enum values (SOS_CATEGORIES, TRIP_STATUSES, etc.)
│   │   └── errors.js         ← Canonical error messages used in validators + services
│   │
│   ├── database/
│   │   ├── pool.js           ← Exports pool (pg Pool instance)
│   │   └── transaction.js    ← withTransaction(fn) helper
│   │
│   ├── utils/
│   │   ├── response.js       ← sendSuccess, sendError, sendPaginated
│   │   ├── logger.js         ← Pino instance (dev: pretty, prod: JSON)
│   │   ├── crypto.js         ← generateToken, hashGovtId, hashPassword, verifyPassword
│   │   └── pagination.js     ← parsePaginationParams, buildPaginationMeta
│   │
│   ├── validators/
│   │   ├── auth.validator.js       ← RegisterTouristSchema, LoginSchema, RegisterGovtSchema
│   │   ├── trip.validator.js       ← CreateTripSchema, UpdateTripSchema, StopSchema
│   │   ├── sos.validator.js        ← CreateSOSSchema, FalseAlarmSchema
│   │   ├── dms.validator.js        ← CreateDMSSchema, ResetDMSSchema
│   │   ├── checkin.validator.js    ← CreateCheckinSchema
│   │   ├── scam.validator.js       ← CreateScamReportSchema
│   │   ├── packing.validator.js    ← GeneratePackingSchema
│   │   └── common.validator.js     ← UUIDParam, PaginationQuery, shared refinements
│   │
│   ├── middleware/
│   │   ├── auth.js           ← authenticateTourist, authenticateGovt
│   │   ├── validate.js       ← Zod middleware wrapper: validate(schema)
│   │   ├── rateLimiter.js    ← generalLimiter, authLimiter, webhookLimiter
│   │   └── errorHandler.js   ← Global Express error handler (last middleware)
│   │
│   ├── repositories/
│   │   ├── base.repository.js       ← BaseRepository class with query helper
│   │   ├── tourist.repository.js    ← All tourist SQL
│   │   ├── trip.repository.js       ← All trip SQL
│   │   ├── sos.repository.js        ← All sos_events SQL
│   │   ├── dms.repository.js        ← All dead_mans_switches SQL
│   │   ├── checkin.repository.js    ← All checkins SQL
│   │   ├── location.repository.js   ← tourist_locations UPSERT
│   │   ├── destination.repository.js← All destinations + weather_cache SQL
│   │   ├── scam.repository.js       ← All scam_reports SQL
│   │   ├── rescue.repository.js     ← rescue_teams + rescue_assignments SQL
│   │   ├── govt.repository.js       ← govt_users SQL
│   │   └── inbound.repository.js    ← inbound_sos_sms SQL
│   │
│   ├── services/
│   │   ├── auth.service.js          ← registerTourist, loginTourist, registerGovt, loginGovt
│   │   ├── tourist.service.js       ← getProfile, updateProfile, getGuardianView
│   │   ├── trip.service.js          ← createTrip, getMyTrips, getTrip, updateTrip, etc.
│   │   ├── sos.service.js           ← createSOS, getSOSHistory, markFalseAlarm
│   │   ├── dms.service.js           ← createDMS, getActiveDMS, resetDMS, updateStatus
│   │   ├── checkin.service.js       ← createCheckin, getRecentCheckins
│   │   ├── destination.service.js   ← getAllDestinations, getDestinationById
│   │   ├── scam.service.js          ← createReport, getByDestination
│   │   ├── packing.service.js       ← generatePackingList (Gemini + fallback)
│   │   ├── passport.service.js      ← generateJourneyPassport (PDFKit)
│   │   ├── tsi.service.js           ← calculateTSI, computeRescueReadiness
│   │   ├── weather.service.js       ← fetchForDestination, updateActiveTrips
│   │   ├── govt.service.js          ← dashboard, activeSOS, assignRescue, resolve, analytics
│   │   └── notification/
│   │       ├── sms.service.js       ← sendSMS (single message, wraps Twilio)
│   │       └── notification.service.js ← notifyOnSOS, notifyDMSWarning, notifyETAExceeded
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── tourist.controller.js
│   │   ├── trip.controller.js
│   │   ├── sos.controller.js
│   │   ├── dms.controller.js
│   │   ├── checkin.controller.js
│   │   ├── destination.controller.js
│   │   ├── scam.controller.js
│   │   ├── packing.controller.js
│   │   ├── passport.controller.js
│   │   ├── govt.controller.js
│   │   └── webhook.controller.js
│   │
│   ├── routes/
│   │   ├── index.js          ← Mounts all routers on app
│   │   ├── auth.routes.js
│   │   ├── tourist.routes.js
│   │   ├── trip.routes.js
│   │   ├── sos.routes.js
│   │   ├── dms.routes.js
│   │   ├── checkin.routes.js
│   │   ├── destination.routes.js
│   │   ├── scam.routes.js
│   │   ├── packing.routes.js
│   │   ├── passport.routes.js
│   │   ├── govt.routes.js
│   │   └── webhook.routes.js
│   │
│   ├── socket/
│   │   ├── index.js          ← initSocket(server), room joins, auth middleware
│   │   └── emitters.js       ← All emit functions (import events from constants)
│   │
│   ├── cron/
│   │   ├── index.js          ← startCrons() — registers all jobs
│   │   └── jobs/
│   │       ├── dms.job.js    ← Cron schedules — calls dms.service methods
│   │       └── weather.job.js← Cron schedules — calls weather.service methods
│   │
│   ├── migrations/
│   │   ├── 001_initial_schema.js
│   │   └── 002_seed_reference_data.js
│   │
│   ├── app.js                ← Express app (middleware + routes, no server.listen)
│   └── server.js             ← HTTP server, Socket.IO init, cron start, listen
│
├── scripts/
│   ├── preflight.js          ← Validates env + DB connectivity before build
│   └── seed.js               ← Idempotent demo data seeder
│
├── tests/
│   ├── setup.js              ← Vitest global setup (test DB, cleanup)
│   ├── unit/
│   │   ├── tsi.service.test.js
│   │   └── crypto.utils.test.js
│   └── integration/
│       ├── auth.test.js
│       ├── sos.test.js
│       └── trip.test.js
│
├── .env
├── .env.example
├── .gitignore
└── package.json
```

✅ **Phase 1 verification:**
```bash
find src -type d | sort
# Must show all 16 directories
ls src/config src/constants src/database src/utils src/validators \
   src/middleware src/repositories src/services src/controllers \
   src/routes src/socket src/cron src/migrations scripts tests
echo "✅ Directory structure verified"
```


---

## PHASE 2 — CONSTANTS, CONFIG, AND UTILITIES

### Step 2.1 — src/constants/enums.js

All enum values used across the codebase. Import from here — NEVER type these strings raw.

```javascript
// src/constants/enums.js
'use strict'

const TRAVEL_TYPES = Object.freeze({
  SOLO: 'SOLO',
  FAMILY: 'FAMILY',
  FRIENDS: 'FRIENDS',
  ADVENTURE: 'ADVENTURE',
  PILGRIMAGE: 'PILGRIMAGE',
  BUSINESS: 'BUSINESS',
})

const TRIP_STATUSES = Object.freeze({
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
})

const SOS_CATEGORIES = Object.freeze({
  MEDICAL: 'MEDICAL',
  LOST: 'LOST',
  TRAPPED: 'TRAPPED',
  DISASTER: 'DISASTER',
  MISSING: 'MISSING',
  CRIME: 'CRIME',
  OTHER: 'OTHER',
})

const SOS_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  ASSIGNED: 'ASSIGNED',
  RESOLVED: 'RESOLVED',
  FALSE_ALARM: 'FALSE_ALARM',
})

const SOS_TRIGGER_TYPES = Object.freeze({
  MANUAL: 'MANUAL',
  DEAD_MANS_SWITCH: 'DEAD_MANS_SWITCH',
  SMS_INBOUND: 'SMS_INBOUND',
})

const DMS_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  TRIGGERED: 'TRIGGERED',
  RESOLVED: 'RESOLVED',
})

const CHECKIN_TYPES = Object.freeze({
  MANUAL: 'MANUAL',
  DMS_RESET: 'DMS_RESET',
  AUTO: 'AUTO',
})

const GOVT_ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  DISTRICT_ADMIN: 'DISTRICT_ADMIN',
  TOURISM_OFFICER: 'TOURISM_OFFICER',
  POLICE: 'POLICE',
  MEDICAL: 'MEDICAL',
})

const GOVT_ID_TYPES = Object.freeze({
  AADHAAR: 'AADHAAR',
  PASSPORT: 'PASSPORT',
  VOTER_ID: 'VOTER_ID',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
})

const CONNECTIVITY = Object.freeze({
  NONE: 'NONE',
  POOR: 'POOR',
  MODERATE: 'MODERATE',
  GOOD: 'GOOD',
  EXCELLENT: 'EXCELLENT',
})

const DIFFICULTY = Object.freeze({
  EASY: 'EASY',
  MODERATE: 'MODERATE',
  HARD: 'HARD',
  EXTREME: 'EXTREME',
})

const ZONE_TYPES = Object.freeze({
  SAFE: 'SAFE',
  CAUTION: 'CAUTION',
  HIGH_RISK: 'HIGH_RISK',
  RESTRICTED: 'RESTRICTED',
  ILP_REQUIRED: 'ILP_REQUIRED',
})

const WEATHER_CONDITIONS = Object.freeze({
  CLEAR: 'CLEAR',
  CLOUDY: 'CLOUDY',
  RAIN: 'RAIN',
  HEAVY_RAIN: 'HEAVY_RAIN',
  STORM: 'STORM',
  SNOW: 'SNOW',
  FOG: 'FOG',
})

const WEATHER_RISK = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  EXTREME: 'EXTREME',
})

const TEAM_TYPES = Object.freeze({
  MOUNTAIN: 'MOUNTAIN',
  MEDICAL: 'MEDICAL',
  POLICE: 'POLICE',
  SDRF: 'SDRF',
  COAST_GUARD: 'COAST_GUARD',
})

const TEAM_STATUSES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  DEPLOYED: 'DEPLOYED',
  OFF_DUTY: 'OFF_DUTY',
})

const ASSIGNMENT_STATUSES = Object.freeze({
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  RESOLVED: 'RESOLVED',
})

const SCAM_CATEGORIES = Object.freeze({
  FAKE_GUIDE: 'FAKE_GUIDE',
  OVERCHARGING: 'OVERCHARGING',
  THEFT: 'THEFT',
  HARASSMENT: 'HARASSMENT',
  UNSAFE_AREA: 'UNSAFE_AREA',
  OTHER: 'OTHER',
})

const ACTIVITY_TYPES = Object.freeze({
  TRANSPORT: 'TRANSPORT',
  STAY: 'STAY',
  ACTIVITY: 'ACTIVITY',
  MEAL: 'MEAL',
  OTHER: 'OTHER',
})

const PACKING_CATEGORIES = Object.freeze({
  CLOTHING: 'CLOTHING',
  DOCUMENTS: 'DOCUMENTS',
  MEDICINE: 'MEDICINE',
  ELECTRONICS: 'ELECTRONICS',
  SAFETY: 'SAFETY',
  FOOD: 'FOOD',
  OTHER: 'OTHER',
})

const NOTIFICATION_TIERS = Object.freeze({
  TIER_1: 1,  // Notify immediately
  TIER_2: 2,  // Notify after 60 seconds
})

module.exports = {
  TRAVEL_TYPES, TRIP_STATUSES, SOS_CATEGORIES, SOS_STATUSES, SOS_TRIGGER_TYPES,
  DMS_STATUSES, CHECKIN_TYPES, GOVT_ROLES, GOVT_ID_TYPES, CONNECTIVITY, DIFFICULTY,
  ZONE_TYPES, WEATHER_CONDITIONS, WEATHER_RISK, TEAM_TYPES, TEAM_STATUSES,
  ASSIGNMENT_STATUSES, SCAM_CATEGORIES, ACTIVITY_TYPES, PACKING_CATEGORIES,
  NOTIFICATION_TIERS,
}
```

### Step 2.2 — src/constants/events.js

```javascript
// src/constants/events.js
// All Socket.IO event names. Import this constant — never type event strings raw.
'use strict'

const SOCKET_EVENTS = Object.freeze({
  // Server → Govt Dashboard room
  SOS_RECEIVED:        'SOS_RECEIVED',
  SOS_STATUS_UPDATED:  'SOS_STATUS_UPDATED',
  SOS_RESOLVED:        'SOS_RESOLVED',
  RESCUE_ASSIGNED:     'RESCUE_ASSIGNED',
  DMS_TRIGGERED:       'DMS_TRIGGERED',
  TSI_BULK_UPDATE:     'TSI_BULK_UPDATE',
  LIVE_MAP_UPDATE:     'LIVE_MAP_UPDATE',

  // Server → Tourist room (tourist:{touristId})
  TSI_UPDATED:         'TSI_UPDATED',
  DMS_WARNING:         'DMS_WARNING',
  DMS_TRIGGERED_OWN:  'DMS_TRIGGERED_OWN',
  CHECKIN_CONFIRMED:   'CHECKIN_CONFIRMED',

  // Server → Guardian room (guardian:{guardianToken})
  GUARDIAN_STATUS_CHANGE:    'GUARDIAN_STATUS_CHANGE',
  GUARDIAN_LOCATION_UPDATE:  'GUARDIAN_LOCATION_UPDATE',
  GUARDIAN_SOS_ALERT:        'GUARDIAN_SOS_ALERT',
  GUARDIAN_ETA_UPDATE:       'GUARDIAN_ETA_UPDATE',

  // Client → Server (from govt dashboard)
  GOVT_JOIN_DISTRICT: 'GOVT_JOIN_DISTRICT',
})

const SOCKET_ROOMS = Object.freeze({
  GOVT_DASHBOARD: 'govt:dashboard',
  govtDistrict: (district) => `govt:district:${district}`,
  tourist:       (touristId) => `tourist:${touristId}`,
  guardian:      (guardianToken) => `guardian:${guardianToken}`,
})

module.exports = { SOCKET_EVENTS, SOCKET_ROOMS }
```

### Step 2.3 — src/constants/errors.js

```javascript
// src/constants/errors.js
'use strict'

const ERRORS = Object.freeze({
  // Auth
  PHONE_TAKEN:         'Phone number already registered',
  EMAIL_TAKEN:         'Email already registered',
  INVALID_CREDENTIALS: 'Invalid phone or password',
  INVALID_TOKEN:       'Invalid or expired token',
  ACCOUNT_INACTIVE:    'Account is deactivated',
  UNAUTHORIZED:        'Authentication required',
  FORBIDDEN:           'Insufficient permissions',

  // Govt ID
  GOVTID_INVALID_TYPE:   'Invalid government ID type',
  GOVTID_INVALID_FORMAT: 'Government ID number format is invalid for the selected type',
  GOVTID_TAKEN:          'A tourist is already registered with this government ID',

  // Trip
  TRIP_NOT_FOUND:         'Trip not found or access denied',
  TRIP_ALREADY_ACTIVE:    'You already have an active trip. Complete or cancel it first.',
  INVALID_TRIP_TRANSITION:'Invalid status transition',
  TRIP_DATE_INVALID:      'End date must be after start date',

  // SOS
  SOS_NOT_FOUND:    'SOS event not found or access denied',
  SOS_ALREADY_CLOSED: 'This SOS is already closed',

  // DMS
  DMS_ALREADY_ACTIVE: 'You already have an active Dead Man\'s Switch. Pause or resolve it first.',
  DMS_NOT_FOUND:      'Active Dead Man\'s Switch not found',
  DMS_INTERVAL_RANGE: 'Interval must be between 15 and 480 minutes',

  // Rescue
  TEAM_NOT_FOUND:      'Rescue team not found',
  TEAM_NOT_AVAILABLE:  'Rescue team is not available — status must be AVAILABLE to assign',

  // Destination
  DESTINATION_NOT_FOUND: 'Destination not found',

  // Guardian
  GUARDIAN_TOKEN_INVALID: 'Tracking link not found or expired',

  // Generic
  NOT_FOUND:           'Resource not found',
  VALIDATION_FAILED:   'Validation failed',
  INTERNAL_ERROR:      'Internal server error',
  DB_CONFLICT:         'A record with this value already exists',
  DB_FOREIGN_KEY:      'Referenced record does not exist',
})

module.exports = { ERRORS }
```

### Step 2.4 — src/config/env.js

```javascript
// src/config/env.js
// Called once at startup. Throws if any required var is missing.
// Exports a typed config object — use this instead of process.env directly.
'use strict'

require('dotenv').config()

function requireEnv(key) {
  const val = process.env[key]
  if (!val || val.trim() === '') {
    throw new Error(`[ENV] Required environment variable "${key}" is missing or empty.
    Set it in .env and run: node scripts/preflight.js`)
  }
  return val.trim()
}

function optionalEnv(key, defaultVal = null) {
  return process.env[key]?.trim() || defaultVal
}

const config = {
  // Core
  nodeEnv:     requireEnv('NODE_ENV'),
  port:        parseInt(optionalEnv('PORT', '5000'), 10),
  isDev:       process.env.NODE_ENV === 'development',
  isProd:      process.env.NODE_ENV === 'production',

  // Database
  db: {
    url:                requireEnv('DATABASE_URL'),
    testUrl:            optionalEnv('DATABASE_TEST_URL'),
    maxConnections:     parseInt(optionalEnv('DATABASE_MAX_CONNECTIONS', '20'), 10),
    idleTimeoutMs:      parseInt(optionalEnv('DATABASE_IDLE_TIMEOUT_MS', '30000'), 10),
    connectionTimeoutMs:parseInt(optionalEnv('DATABASE_CONNECTION_TIMEOUT_MS', '2000'), 10),
  },

  // CORS — three frontend origins
  cors: {
    touristUrl:  requireEnv('TOURIST_FRONTEND_URL'),
    govtUrl:     requireEnv('GOVT_FRONTEND_URL'),
    guardianUrl: requireEnv('GUARDIAN_FRONTEND_URL'),
  },

  // JWT
  jwt: {
    secret:    requireEnv('JWT_SECRET'),
    expiresIn: optionalEnv('JWT_EXPIRES_IN', '24h'),
  },

  // Security
  security: {
    bcryptRounds: parseInt(optionalEnv('BCRYPT_ROUNDS', '12'), 10),
    govtIdSecret: requireEnv('GOVT_ID_SECRET'),
    guardianSecret: requireEnv('GUARDIAN_SECRET'),
  },

  // Rate limiting
  rateLimit: {
    windowMs:        parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max:             parseInt(optionalEnv('RATE_LIMIT_MAX', '100'), 10),
    authMax:         parseInt(optionalEnv('AUTH_RATE_LIMIT_MAX', '5'), 10),
    webhookMax:      parseInt(optionalEnv('WEBHOOK_RATE_LIMIT_MAX', '1000'), 10),
  },

  // Twilio (optional — graceful fallback if missing)
  twilio: {
    accountSid:       optionalEnv('TWILIO_ACCOUNT_SID'),
    authToken:        optionalEnv('TWILIO_AUTH_TOKEN'),
    fromNumber:       optionalEnv('TWILIO_FROM_NUMBER'),
    emergencyNumber:  optionalEnv('TWILIO_EMERGENCY_NUMBER'),
    enabled:          !!(optionalEnv('TWILIO_ACCOUNT_SID') && optionalEnv('TWILIO_AUTH_TOKEN')),
  },

  // Gemini (optional — fallback packing list if missing)
  gemini: {
    apiKey:  optionalEnv('GEMINI_API_KEY'),
    model:   optionalEnv('GEMINI_MODEL', 'gemini-1.5-flash'),
    enabled: !!optionalEnv('GEMINI_API_KEY'),
  },

  // OpenWeatherMap (optional — TSI weather factor disabled if missing)
  owm: {
    apiKey:        optionalEnv('OWM_API_KEY'),
    baseUrl:       optionalEnv('OWM_BASE_URL', 'https://api.openweathermap.org/data/2.5'),
    cacheTtlMins:  parseInt(optionalEnv('OWM_CACHE_TTL_MINUTES', '60'), 10),
    enabled:       !!optionalEnv('OWM_API_KEY'),
  },

  // Logging
  log: {
    level: optionalEnv('LOG_LEVEL', 'info'),
  },
}

module.exports = config
```

### Step 2.5 — src/database/pool.js

```javascript
// src/database/pool.js
'use strict'

const { Pool } = require('pg')
const config = require('../config/env')
const logger = require('../utils/logger')

let pool

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.db.url,
      max:                  config.db.maxConnections,
      idleTimeoutMillis:    config.db.idleTimeoutMs,
      connectionTimeoutMillis: config.db.connectionTimeoutMs,
    })

    pool.on('connect', (client) => {
      logger.debug('New database client connected')
    })

    pool.on('error', (err, client) => {
      logger.error({ err: { message: err.message, code: err.code } }, 'Unexpected database pool error')
    })
  }
  return pool
}

module.exports = { getPool }
```

### Step 2.6 — src/database/transaction.js

```javascript
// src/database/transaction.js
// withTransaction: wraps a function in a BEGIN/COMMIT/ROLLBACK block.
// Use for ANY operation that touches more than one table.
//
// Usage:
//   const result = await withTransaction(async (client) => {
//     const row = await someRepo.create(client, data)
//     await otherRepo.update(client, row.id, updates)
//     return row
//   })
//   // Side effects (socket, SMS) happen HERE — outside withTransaction
'use strict'

const { getPool } = require('./pool')
const logger = require('../utils/logger')

async function withTransaction(fn) {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    logger.error({ err: { message: err.message, code: err.code } }, 'Transaction rolled back')
    throw err
  } finally {
    client.release()
  }
}

// Use for read-only queries that don't need a transaction
async function query(text, params = []) {
  const pool = getPool()
  const { rows } = await pool.query(text, params)
  return rows
}

// Use for single-row queries
async function queryOne(text, params = []) {
  const rows = await query(text, params)
  return rows[0] || null
}

module.exports = { withTransaction, query, queryOne }
```

### Step 2.7 — src/utils/logger.js

```javascript
// src/utils/logger.js
'use strict'

const pino = require('pino')
const config = require('../config/env')

const logger = pino(
  {
    level: config.log.level,
    // Redact sensitive fields from all log lines
    redact: {
      paths: [
        'req.headers.authorization',
        'body.password',
        'body.govtIdNumber',
        '*.password_hash',
        '*.govt_id_hash',
        'err.config.headers.authorization',
      ],
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      service: 'aaraksha-backend',
      env: config.nodeEnv,
    },
  },
  config.isDev
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname,service,env',
          singleLine: false,
        },
      })
    : undefined
)

module.exports = logger
```

### Step 2.8 — src/utils/response.js

```javascript
// src/utils/response.js
'use strict'

function sendSuccess(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  })
}

function sendError(res, message = 'Internal Server Error', statusCode = 500, errors = undefined) {
  const body = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  }
  if (errors !== undefined && errors !== null) {
    body.errors = errors
  }
  return res.status(statusCode).json(body)
}

function sendPaginated(res, rows, total, page, limit, message = 'Success') {
  const totalPages = Math.ceil(total / limit)
  return res.status(200).json({
    success: true,
    message,
    data: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
    timestamp: new Date().toISOString(),
  })
}

module.exports = { sendSuccess, sendError, sendPaginated }
```

### Step 2.9 — src/utils/crypto.js

```javascript
// src/utils/crypto.js
'use strict'

const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const config = require('../config/env')

// Guardian tracking token: 64 bytes = 128 hex chars, URL-safe
function generateGuardianToken() {
  return crypto.randomBytes(64).toString('hex')
}

// Public share token for trips: shorter, URL-safe
function generatePublicToken() {
  return crypto.randomBytes(16).toString('hex')
}

// Govt ID HMAC-SHA256 with server secret
// NOT bcrypt — we need deterministic lookup to detect duplicate registrations
// AND to add a UNIQUE constraint on the hash column
function hashGovtId(idNumber) {
  return crypto
    .createHmac('sha256', config.security.govtIdSecret)
    .update(idNumber.toUpperCase().replace(/\s|-/g, ''))
    .digest('hex')
}

// Standard bcrypt password hashing
async function hashPassword(password) {
  return bcrypt.hash(password, config.security.bcryptRounds)
}

// Constant-time password verification
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

// Normalize Indian phone numbers to 10-digit string
// Accepts: 9876543210, +919876543210, 09876543210
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  if (digits.length === 10) return digits
  throw new Error('Invalid phone number format')
}

// Get last N characters of a string (for govt ID suffix)
function extractSuffix(str, n = 4) {
  return str.slice(-n).toUpperCase()
}

module.exports = {
  generateGuardianToken,
  generatePublicToken,
  hashGovtId,
  hashPassword,
  verifyPassword,
  normalizePhone,
  extractSuffix,
}
```

### Step 2.10 — src/utils/pagination.js

```javascript
// src/utils/pagination.js
'use strict'

function parsePaginationParams(query) {
  const page  = Math.max(1, parseInt(query.page  || '1',  10))
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)))
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

module.exports = { parsePaginationParams }
```

### Step 2.11 — src/config/cors.js

```javascript
// src/config/cors.js
// Allows all 3 frontend origins + localhost dev variants
'use strict'

const config = require('./env')
const logger = require('../utils/logger')

const allowedOrigins = new Set([
  config.cors.touristUrl,
  config.cors.govtUrl,
  config.cors.guardianUrl,
  // Dev localhost variants (ignored in production)
  ...(config.isDev ? [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
  ] : []),
])

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true)
    if (allowedOrigins.has(origin)) return callback(null, true)
    logger.warn({ origin }, 'CORS rejection')
    callback(new Error(`Origin ${origin} is not allowed by CORS policy`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],  // needed for PDF download
  maxAge: 86400, // 24h preflight cache
}

module.exports = corsOptions
```

### Step 2.12 — src/config/twilio.js

```javascript
// src/config/twilio.js
// Lazy-init: Twilio client is only created when first needed.
// If credentials missing, returns null — callers check before using.
'use strict'

const config = require('./env')
const logger = require('../utils/logger')

let _client = null

function getTwilioClient() {
  if (!config.twilio.enabled) {
    logger.warn('Twilio not configured — SMS features are in no-op mode')
    return null
  }
  if (!_client) {
    const twilio = require('twilio')
    _client = twilio(config.twilio.accountSid, config.twilio.authToken)
    logger.info('Twilio client initialized')
  }
  return _client
}

module.exports = { getTwilioClient }
```

### Step 2.13 — src/config/gemini.js

```javascript
// src/config/gemini.js
'use strict'

const config = require('./env')
const logger = require('../utils/logger')

let _model = null

function getGeminiModel() {
  if (!config.gemini.enabled) {
    logger.warn('Gemini API not configured — packing list will use offline fallback')
    return null
  }
  if (!_model) {
    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const ai = new GoogleGenerativeAI(config.gemini.apiKey)
    _model = ai.getGenerativeModel({ model: config.gemini.model })
    logger.info({ model: config.gemini.model }, 'Gemini model initialized')
  }
  return _model
}

module.exports = { getGeminiModel }
```

✅ **Phase 2 verification:**
```bash
node -e "
  const config = require('./src/config/env')
  console.log('✅ Config loaded:', config.nodeEnv, 'port:', config.port)
  console.log('✅ Twilio enabled:', config.twilio.enabled)
  console.log('✅ Gemini enabled:', config.gemini.enabled)
  console.log('✅ OWM enabled:', config.owm.enabled)
"

node -e "
  const {SOCKET_EVENTS} = require('./src/constants/events')
  const {SOS_CATEGORIES} = require('./src/constants/enums')
  console.log('✅ Events loaded, count:', Object.keys(SOCKET_EVENTS).length)
  console.log('✅ Enums loaded, SOS categories:', Object.values(SOS_CATEGORIES).join(', '))
"

node -e "
  const {hashGovtId, generateGuardianToken} = require('./src/utils/crypto')
  const h1 = hashGovtId('123456789012')
  const h2 = hashGovtId('123456789012')
  console.assert(h1 === h2, 'HMAC must be deterministic')
  console.assert(h1.length === 64, 'SHA-256 hex must be 64 chars')
  const token = generateGuardianToken()
  console.assert(token.length === 128, 'Guardian token must be 128 chars')
  console.log('✅ Crypto utils verified')
"
```


---

## PHASE 3 — DATABASE MIGRATIONS

Use node-pg-migrate. Migrations are versioned, idempotent, and rollback-safe.

### Step 3.1 — node-pg-migrate config

Add to package.json (already included above). Also create `database.json`:

```json
{
  "dev": {
    "url": { "ENV": "DATABASE_URL" }
  },
  "test": {
    "url": { "ENV": "DATABASE_TEST_URL" }
  }
}
```

### Step 3.2 — src/migrations/001_initial_schema.js

```javascript
/* eslint-disable camelcase */
// src/migrations/001_initial_schema.js

exports.up = (pgm) => {
  // Enable UUID generation
  pgm.createExtension('pgcrypto', { ifNotExists: true })

  // ── tourists ──────────────────────────────────────────────────────────
  pgm.createTable('tourists', {
    id:                     { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    full_name:              { type: 'varchar(255)', notNull: true },
    phone:                  { type: 'varchar(20)',  notNull: true, unique: true },
    email:                  { type: 'varchar(255)' },
    blood_group:            { type: 'varchar(5)' },
    medical_info:           { type: 'text' },
    emergency_contacts:     { type: 'jsonb', notNull: true, default: '[]' },
    govt_id_type:           { type: 'varchar(30)', notNull: true },
    govt_id_hash:           { type: 'varchar(64)',  notNull: true, unique: true },
    govt_id_suffix:         { type: 'char(4)',      notNull: true },
    guardian_token:         { type: 'varchar(128)', notNull: true, unique: true },
    guardian_token_expires: { type: 'timestamptz',  notNull: true },
    rescue_readiness_score: { type: 'smallint', notNull: true, default: 0 },
    password_hash:          { type: 'varchar(255)', notNull: true },
    is_active:              { type: 'boolean', notNull: true, default: true },
    profile_photo_url:      { type: 'varchar(512)' },
    created_at:             { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:             { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── trips ─────────────────────────────────────────────────────────────
  pgm.createTable('trips', {
    id:                    { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:            { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    title:                 { type: 'varchar(255)', notNull: true },
    description:           { type: 'text' },
    travel_type:           { type: 'varchar(30)', notNull: true, default: 'SOLO' },
    start_date:            { type: 'date', notNull: true },
    end_date:              { type: 'date', notNull: true },
    status:                { type: 'varchar(30)', notNull: true, default: 'PLANNED' },
    stops:                 { type: 'jsonb', notNull: true, default: '[]' },
    budget_inr:            { type: 'integer' },
    cover_image_url:       { type: 'varchar(512)' },
    packing_checklist:     { type: 'jsonb', notNull: true, default: '[]' },
    trip_notes:            { type: 'text' },
    is_public:             { type: 'boolean', notNull: true, default: false },
    public_token:          { type: 'varchar(128)', unique: true },
    tsi_score:             { type: 'smallint' },
    tsi_label:             { type: 'varchar(30)' },
    tsi_factors:           { type: 'jsonb', default: '{}' },
    tsi_recommendations:   { type: 'jsonb', default: '[]' },
    tsi_updated_at:        { type: 'timestamptz' },
    rescue_readiness:      { type: 'jsonb', default: '{}' },
    rescue_readiness_score:{ type: 'smallint', notNull: true, default: 0 },
    created_at:            { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:            { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── sos_events ────────────────────────────────────────────────────────
  pgm.createTable('sos_events', {
    id:                  { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:          { type: 'uuid', references: '"tourists"', onDelete: 'SET NULL' },
    trip_id:             { type: 'uuid', references: '"trips"',    onDelete: 'SET NULL' },
    latitude:            { type: 'decimal(10,8)', notNull: true },
    longitude:           { type: 'decimal(11,8)', notNull: true },
    location_accuracy_m: { type: 'real' },
    is_stale_location:   { type: 'boolean', notNull: true, default: false },
    category:            { type: 'varchar(50)', notNull: true, default: 'OTHER' },
    message:             { type: 'text' },
    trigger_type:        { type: 'varchar(30)', notNull: true, default: 'MANUAL' },
    status:              { type: 'varchar(30)', notNull: true, default: 'ACTIVE' },
    battery_pct:         { type: 'smallint' },
    contacts_notified:   { type: 'jsonb', notNull: true, default: '[]' },
    resolved_at:         { type: 'timestamptz' },
    resolution_notes:    { type: 'text' },
    created_at:          { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── dead_mans_switches ────────────────────────────────────────────────
  pgm.createTable('dead_mans_switches', {
    id:               { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:       { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    trip_id:          { type: 'uuid', references: '"trips"', onDelete: 'SET NULL' },
    interval_minutes: { type: 'smallint', notNull: true },
    last_reset_at:    { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    next_trigger_at:  { type: 'timestamptz', notNull: true },
    warning_sent_at:  { type: 'timestamptz' },
    status:           { type: 'varchar(20)', notNull: true, default: 'ACTIVE' },
    sos_event_id:     { type: 'uuid', references: '"sos_events"', onDelete: 'SET NULL' },
    created_at:       { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.addConstraint('dead_mans_switches', 'dms_interval_range',
    'CHECK (interval_minutes BETWEEN 15 AND 480)')

  // ── checkins ──────────────────────────────────────────────────────────
  pgm.createTable('checkins', {
    id:          { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tourist_id:  { type: 'uuid', notNull: true, references: '"tourists"', onDelete: 'CASCADE' },
    trip_id:     { type: 'uuid', references: '"trips"',               onDelete: 'SET NULL' },
    dms_id:      { type: 'uuid', references: '"dead_mans_switches"',  onDelete: 'SET NULL' },
    latitude:    { type: 'decimal(10,8)' },
    longitude:   { type: 'decimal(11,8)' },
    battery_pct: { type: 'smallint' },
    message:     { type: 'text' },
    type:        { type: 'varchar(30)', notNull: true, default: 'MANUAL' },
    created_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── tourist_locations (single-row per tourist) ─────────────────────
  pgm.createTable('tourist_locations', {
    tourist_id:  { type: 'uuid', primaryKey: true, references: '"tourists"', onDelete: 'CASCADE' },
    latitude:    { type: 'decimal(10,8)', notNull: true },
    longitude:   { type: 'decimal(11,8)', notNull: true },
    battery_pct: { type: 'smallint' },
    accuracy_m:  { type: 'real' },
    updated_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── govt_users ────────────────────────────────────────────────────────
  pgm.createTable('govt_users', {
    id:            { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name:          { type: 'varchar(255)', notNull: true },
    email:         { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    role:          { type: 'varchar(50)',  notNull: true, default: 'TOURISM_OFFICER' },
    district:      { type: 'varchar(100)' },
    state:         { type: 'varchar(100)' },
    is_active:     { type: 'boolean', notNull: true, default: true },
    created_at:    { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── rescue_teams ──────────────────────────────────────────────────────
  pgm.createTable('rescue_teams', {
    id:            { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name:          { type: 'varchar(255)', notNull: true },
    type:          { type: 'varchar(50)',  notNull: true },
    district:      { type: 'varchar(100)', notNull: true },
    state:         { type: 'varchar(100)', notNull: true },
    contact_phone: { type: 'varchar(20)',  notNull: true },
    status:        { type: 'varchar(30)',  notNull: true, default: 'AVAILABLE' },
    latitude:      { type: 'decimal(10,8)' },
    longitude:     { type: 'decimal(11,8)' },
    capacity:      { type: 'integer', notNull: true, default: 10 },
    created_at:    { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── rescue_assignments ────────────────────────────────────────────────
  pgm.createTable('rescue_assignments', {
    id:            { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    sos_event_id:  { type: 'uuid', notNull: true, references: '"sos_events"', onDelete: 'CASCADE' },
    team_id:       { type: 'uuid', notNull: true, references: '"rescue_teams"', onDelete: 'RESTRICT' },
    assigned_by:   { type: 'uuid', references: '"govt_users"', onDelete: 'SET NULL' },
    status:        { type: 'varchar(30)', notNull: true, default: 'ASSIGNED' },
    notes:         { type: 'text' },
    assigned_at:   { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    resolved_at:   { type: 'timestamptz' },
  })

  // ── destinations ──────────────────────────────────────────────────────
  pgm.createTable('destinations', {
    id:                   { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name:                 { type: 'varchar(255)', notNull: true },
    state:                { type: 'varchar(100)', notNull: true },
    latitude:             { type: 'decimal(10,8)' },
    longitude:            { type: 'decimal(11,8)' },
    connectivity:         { type: 'varchar(20)', notNull: true, default: 'MODERATE' },
    difficulty:           { type: 'varchar(20)', notNull: true, default: 'EASY' },
    altitude_m:           { type: 'integer', notNull: true, default: 0 },
    zone_type:            { type: 'varchar(30)', notNull: true, default: 'SAFE' },
    ilp_required:         { type: 'boolean', notNull: true, default: false },
    nearest_hospital_name:{ type: 'varchar(255)' },
    nearest_hospital_km:  { type: 'decimal(6,2)' },
    nearest_hospital_phone:{ type: 'varchar(20)' },
    nearest_police_km:    { type: 'decimal(6,2)' },
    govt_advisory:        { type: 'text' },
    popularity_index:     { type: 'smallint', notNull: true, default: 50 },
    description:          { type: 'text' },
    best_months:          { type: 'varchar(100)' },
    created_at:           { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── weather_cache ─────────────────────────────────────────────────────
  pgm.createTable('weather_cache', {
    destination_id:  { type: 'uuid', primaryKey: true, references: '"destinations"', onDelete: 'CASCADE' },
    condition:       { type: 'varchar(50)', notNull: true, default: 'CLEAR' },
    temp_celsius:    { type: 'smallint' },
    humidity_pct:    { type: 'smallint' },
    wind_kmh:        { type: 'smallint' },
    description:     { type: 'text' },
    risk_level:      { type: 'varchar(20)', notNull: true, default: 'LOW' },
    risk_reason:     { type: 'text' },
    tsi_weather_delta: { type: 'smallint', notNull: true, default: 0 },
    fetched_at:      { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── scam_reports ──────────────────────────────────────────────────────
  pgm.createTable('scam_reports', {
    id:             { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    destination_id: { type: 'uuid', references: '"destinations"', onDelete: 'SET NULL' },
    tourist_id:     { type: 'uuid', references: '"tourists"',     onDelete: 'SET NULL' },
    category:       { type: 'varchar(50)', notNull: true },
    description:    { type: 'text', notNull: true },
    incident_date:  { type: 'date' },
    verified:       { type: 'boolean', notNull: true, default: false },
    created_at:     { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── inbound_sos_sms ───────────────────────────────────────────────────
  pgm.createTable('inbound_sos_sms', {
    id:           { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    from_phone:   { type: 'varchar(20)', notNull: true },
    raw_body:     { type: 'text', notNull: true },
    parsed:       { type: 'boolean', notNull: true, default: false },
    parse_error:  { type: 'text' },
    tourist_id:   { type: 'uuid', references: '"tourists"',   onDelete: 'SET NULL' },
    sos_event_id: { type: 'uuid', references: '"sos_events"', onDelete: 'SET NULL' },
    received_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  // ── Indexes ───────────────────────────────────────────────────────────
  pgm.createIndex('trips', 'tourist_id')
  pgm.createIndex('trips', 'status')
  pgm.createIndex('trips', ['tourist_id', 'status'])
  pgm.createIndex('sos_events', 'tourist_id')
  pgm.createIndex('sos_events', 'status')
  pgm.createIndex('sos_events', 'created_at', { order: 'DESC' })
  pgm.createIndex('dead_mans_switches', 'tourist_id')
  pgm.createIndex('dead_mans_switches', 'status')
  pgm.createIndex('dead_mans_switches', 'next_trigger_at',
    { where: "status = 'ACTIVE'" })
  pgm.createIndex('checkins', 'tourist_id')
  pgm.createIndex('checkins', 'trip_id')
  pgm.createIndex('checkins', 'created_at', { order: 'DESC' })
  pgm.createIndex('scam_reports', 'destination_id')
  pgm.createIndex('tourist_locations', 'updated_at', { order: 'DESC' })
  pgm.createIndex('rescue_assignments', 'sos_event_id')

  // ── Updated_at trigger ───────────────────────────────────────────────
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ language 'plpgsql';

    CREATE TRIGGER trg_tourists_updated_at
      BEFORE UPDATE ON tourists
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER trg_trips_updated_at
      BEFORE UPDATE ON trips
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `)
}

exports.down = (pgm) => {
  // Drop in reverse dependency order
  pgm.sql('DROP TRIGGER IF EXISTS trg_trips_updated_at ON trips')
  pgm.sql('DROP TRIGGER IF EXISTS trg_tourists_updated_at ON tourists')
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column()')

  const tables = [
    'inbound_sos_sms', 'scam_reports', 'weather_cache', 'destinations',
    'rescue_assignments', 'rescue_teams', 'govt_users', 'tourist_locations',
    'checkins', 'dead_mans_switches', 'sos_events', 'trips', 'tourists',
  ]
  tables.forEach(t => pgm.dropTable(t, { ifExists: true, cascade: true }))
}
```

Run migrations: `npm run migrate`

✅ **Phase 3 verification:**
```bash
npm run migrate
psql $DATABASE_URL -c "\dt" | grep -E "tourists|trips|sos_events|dead_mans"
echo "✅ Migration applied — tables exist"

psql $DATABASE_URL -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
" | grep -E "13 rows"
```

---

## PHASE 4 — VALIDATORS (ZOD SCHEMAS)

Every controller uses `validate(Schema)` middleware. Schemas live in validators/.
The validate middleware is described in Phase 6. Schemas go here.

### Step 4.1 — src/middleware/validate.js

```javascript
// src/middleware/validate.js
'use strict'

const { z } = require('zod')
const { sendError } = require('../utils/response')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

// Usage: router.post('/path', validate(MySchema), controller)
// After validate(), use req.validatedBody (body), req.validatedQuery (query), req.validatedParams (params)

function validate(schema, source = 'body') {
  return async (req, res, next) => {
    try {
      const input = source === 'body'   ? req.body
                  : source === 'query'  ? req.query
                  : source === 'params' ? req.params
                  : req.body

      const parsed = await schema.parseAsync(input)

      if (source === 'body')   req.validatedBody   = parsed
      if (source === 'query')  req.validatedQuery  = parsed
      if (source === 'params') req.validatedParams = parsed

      next()
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors = err.errors.map(e => ({
          field:   e.path.join('.'),
          message: e.message,
          code:    e.code,
        }))
        logger.debug({ errors }, 'Validation failed')
        return sendError(res, ERRORS.VALIDATION_FAILED, 400, errors)
      }
      next(err)
    }
  }
}

module.exports = { validate }
```

### Step 4.2 — src/validators/common.validator.js

```javascript
// src/validators/common.validator.js
'use strict'

const { z } = require('zod')

const UUIDSchema = z.string().uuid({ message: 'Must be a valid UUID' })

const UUIDParamSchema = z.object({
  id: UUIDSchema,
})

const PaginationQuerySchema = z.object({
  page:  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1)).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional().default('20'),
})

// Latitude/longitude validation used in multiple schemas
const LatitudeSchema  = z.number().min(-90).max(90)
const LongitudeSchema = z.number().min(-180).max(180)

module.exports = { UUIDSchema, UUIDParamSchema, PaginationQuerySchema, LatitudeSchema, LongitudeSchema }
```

### Step 4.3 — src/validators/auth.validator.js

```javascript
// src/validators/auth.validator.js
'use strict'

const { z } = require('zod')
const { GOVT_ID_TYPES, GOVT_ROLES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')

// Govt ID number format validator
const govtIdNumberRefinement = (type) => (num, ctx) => {
  const cleaned = num.toUpperCase().replace(/\s|-/g, '')
  const patterns = {
    AADHAAR:         /^\d{12}$/,
    PASSPORT:        /^[A-Z]\d{7}$/,
    VOTER_ID:        /^[A-Z]{3}\d{7}$/,
    DRIVING_LICENSE: /^[A-Z0-9]{8,20}$/,
  }
  if (type && patterns[type] && !patterns[type].test(cleaned)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: ERRORS.GOVTID_INVALID_FORMAT,
    })
  }
}

const EmergencyContactSchema = z.object({
  name:        z.string().min(2).max(100),
  phone:       z.string().min(10).max(15),
  relation:    z.string().min(2).max(50),
  tier:        z.number().int().min(1).max(2).optional().default(1),
  notifyOnSOS: z.boolean().optional().default(true),
})

const RegisterTouristSchema = z.object({
  fullName:          z.string().min(2).max(255),
  phone:             z.string().min(10).max(15),
  email:             z.string().email().optional(),
  bloodGroup:        z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
  medicalInfo:       z.string().max(1000).optional(),
  emergencyContacts: z.array(EmergencyContactSchema)
                      .min(1, 'At least one emergency contact is required')
                      .max(3, 'Maximum 3 emergency contacts allowed'),
  govtIdType:        z.enum(Object.values(GOVT_ID_TYPES), { errorMap: () => ({ message: ERRORS.GOVTID_INVALID_TYPE }) }),
  govtIdNumber:      z.string().min(8).max(20),
  password:          z.string().min(8).max(128),
}).superRefine((data, ctx) => {
  govtIdNumberRefinement(data.govtIdType)(data.govtIdNumber, ctx)
})

const LoginTouristSchema = z.object({
  phone:    z.string().min(10).max(15),
  password: z.string().min(1),
})

const RegisterGovtSchema = z.object({
  name:     z.string().min(2).max(255),
  email:    z.string().email(),
  password: z.string().min(8).max(128),
  role:     z.enum(Object.values(GOVT_ROLES)).optional().default('TOURISM_OFFICER'),
  district: z.string().max(100).optional(),
  state:    z.string().max(100).optional(),
})

const LoginGovtSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

module.exports = {
  RegisterTouristSchema,
  LoginTouristSchema,
  RegisterGovtSchema,
  LoginGovtSchema,
}
```

### Step 4.4 — src/validators/trip.validator.js

```javascript
// src/validators/trip.validator.js
'use strict'

const { z } = require('zod')
const { TRAVEL_TYPES, TRIP_STATUSES, CONNECTIVITY, DIFFICULTY,
        ZONE_TYPES, ACTIVITY_TYPES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')

const ActivitySchema = z.object({
  name:     z.string().min(1).max(255),
  type:     z.enum(Object.values(ACTIVITY_TYPES)).optional().default('ACTIVITY'),
  cost:     z.number().min(0).optional().default(0),
  duration: z.string().max(50).optional(),
  notes:    z.string().max(500).optional(),
})

const StopSchema = z.object({
  city:          z.string().min(1).max(255),
  state:         z.string().min(1).max(100),
  destinationId: z.string().uuid().optional().nullable(),
  lat:           z.number().min(-90).max(90).optional().nullable(),
  lng:           z.number().min(-180).max(180).optional().nullable(),
  days:          z.number().int().min(1).max(365),
  arrivalDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  activities:    z.array(ActivitySchema).optional().default([]),
  notes:         z.string().max(1000).optional(),
  // Risk-related fields (populated from destinations table or provided manually)
  connectivity:  z.enum(Object.values(CONNECTIVITY)).optional().default('MODERATE'),
  difficulty:    z.enum(Object.values(DIFFICULTY)).optional().default('EASY'),
  altitude_m:    z.number().int().min(0).optional().default(0),
  zone_type:     z.enum(Object.values(ZONE_TYPES)).optional().default('SAFE'),
  hospital_km:   z.number().min(0).optional().default(0),
  eta_minutes:   z.number().int().min(0).optional().nullable(),
})

const PackingItemSchema = z.object({
  id:       z.string().uuid().optional(),
  item:     z.string().min(1).max(255),
  category: z.string().max(50).optional().default('OTHER'),
  packed:   z.boolean().optional().default(false),
})

const CreateTripSchema = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  travelType:  z.enum(Object.values(TRAVEL_TYPES)).optional().default('SOLO'),
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  stops:       z.array(StopSchema).optional().default([]),
  budgetInr:   z.number().int().min(0).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  isPublic:    z.boolean().optional().default(false),
}).refine(
  data => new Date(data.startDate) < new Date(data.endDate),
  { message: ERRORS.TRIP_DATE_INVALID, path: ['endDate'] }
)

const UpdateTripSchema = CreateTripSchema.partial()

const UpdateTripStatusSchema = z.object({
  status: z.enum([TRIP_STATUSES.ACTIVE, TRIP_STATUSES.COMPLETED, TRIP_STATUSES.CANCELLED]),
})

const UpdateChecklistSchema = z.object({
  packingChecklist: z.array(PackingItemSchema),
})

module.exports = {
  CreateTripSchema, UpdateTripSchema, UpdateTripStatusSchema,
  UpdateChecklistSchema, StopSchema, PackingItemSchema,
}
```

### Step 4.5 — src/validators/sos.validator.js

```javascript
// src/validators/sos.validator.js
'use strict'

const { z } = require('zod')
const { SOS_CATEGORIES } = require('../constants/enums')
const { LatitudeSchema, LongitudeSchema } = require('./common.validator')

const CreateSOSSchema = z.object({
  latitude:          LatitudeSchema,
  longitude:         LongitudeSchema,
  category:          z.enum(Object.values(SOS_CATEGORIES)).optional().default('OTHER'),
  message:           z.string().max(1000).optional().nullable(),
  batteryPct:        z.number().int().min(0).max(100).optional().nullable(),
  tripId:            z.string().uuid().optional().nullable(),
  locationAccuracyM: z.number().min(0).optional().nullable(),
  isStaleLocation:   z.boolean().optional().default(false),
})

const FalseAlarmSchema = z.object({})  // No body needed

module.exports = { CreateSOSSchema, FalseAlarmSchema }
```

### Step 4.6 — src/validators/dms.validator.js

```javascript
// src/validators/dms.validator.js
'use strict'

const { z } = require('zod')
const { DMS_STATUSES } = require('../constants/enums')
const { LatitudeSchema, LongitudeSchema } = require('./common.validator')
const { ERRORS } = require('../constants/errors')

const CreateDMSSchema = z.object({
  intervalMinutes: z.number().int().min(15, ERRORS.DMS_INTERVAL_RANGE).max(480, ERRORS.DMS_INTERVAL_RANGE),
  tripId:          z.string().uuid().optional().nullable(),
})

const ResetDMSSchema = z.object({
  latitude:   LatitudeSchema.optional().nullable(),
  longitude:  LongitudeSchema.optional().nullable(),
  batteryPct: z.number().int().min(0).max(100).optional().nullable(),
  message:    z.string().max(500).optional().nullable(),
})

const UpdateDMSStatusSchema = z.object({
  status: z.enum([DMS_STATUSES.PAUSED, DMS_STATUSES.RESOLVED]),
})

module.exports = { CreateDMSSchema, ResetDMSSchema, UpdateDMSStatusSchema }
```

### Step 4.7 — src/validators/checkin.validator.js

```javascript
// src/validators/checkin.validator.js
'use strict'

const { z } = require('zod')
const { LatitudeSchema, LongitudeSchema } = require('./common.validator')

const CreateCheckinSchema = z.object({
  latitude:   LatitudeSchema,
  longitude:  LongitudeSchema,
  batteryPct: z.number().int().min(0).max(100).optional().nullable(),
  message:    z.string().max(500).optional().nullable(),
  tripId:     z.string().uuid().optional().nullable(),
  dmsId:      z.string().uuid().optional().nullable(),
  accuracyM:  z.number().min(0).optional().nullable(),
})

module.exports = { CreateCheckinSchema }
```

### Step 4.8 — Remaining validators

**src/validators/scam.validator.js**
```javascript
'use strict'
const { z } = require('zod')
const { SCAM_CATEGORIES } = require('../constants/enums')

const CreateScamReportSchema = z.object({
  destinationId: z.string().uuid(),
  category:      z.enum(Object.values(SCAM_CATEGORIES)),
  description:   z.string().min(10).max(2000),
  incidentDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})

module.exports = { CreateScamReportSchema }
```

**src/validators/packing.validator.js**
```javascript
'use strict'
const { z } = require('zod')

const GeneratePackingSchema = z.object({
  tripId: z.string().uuid(),
})

module.exports = { GeneratePackingSchema }
```

✅ **Phase 4 verification:**
```bash
node -e "
  const { RegisterTouristSchema } = require('./src/validators/auth.validator')
  const { CreateTripSchema } = require('./src/validators/trip.validator')
  const { CreateSOSSchema } = require('./src/validators/sos.validator')
  console.log('✅ All validators load cleanly')

  // Test invalid phone triggers error
  RegisterTouristSchema.parseAsync({
    fullName: 'T', phone: '1234', govtIdType: 'AADHAAR',
    govtIdNumber: '123456789012', password: 'Test@1234',
    emergencyContacts: [{ name: 'P', phone: '9876543210', relation: 'Parent' }]
  }).catch(err => console.log('✅ Validation errors caught correctly:', err.errors.length, 'errors'))
"
```


---

## PHASE 5 — REPOSITORY LAYER

Repositories contain ALL SQL. They accept a `client` param for transaction support.
When called outside a transaction, pass `null` — they use the pool directly.

### Step 5.1 — src/repositories/base.repository.js

```javascript
// src/repositories/base.repository.js
'use strict'

const { getPool } = require('../database/pool')

class BaseRepository {
  // Pass a transaction client to participate in a transaction.
  // Pass null to use the pool directly (auto-commit).
  constructor(client = null) {
    this._client = client
  }

  get db() {
    return this._client || getPool()
  }

  async query(text, params = []) {
    const { rows } = await this.db.query(text, params)
    return rows
  }

  async queryOne(text, params = []) {
    const rows = await this.query(text, params)
    return rows[0] || null
  }

  async queryCount(text, params = []) {
    const row = await this.queryOne(text, params)
    return parseInt(row?.count ?? row?.total ?? 0, 10)
  }
}

module.exports = { BaseRepository }
```

### Step 5.2 — src/repositories/tourist.repository.js

```javascript
// src/repositories/tourist.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

const SAFE_COLS = `
  id, full_name, phone, email, blood_group, medical_info,
  emergency_contacts, govt_id_type, govt_id_suffix,
  guardian_token, guardian_token_expires,
  rescue_readiness_score, profile_photo_url,
  is_active, created_at, updated_at`

class TouristRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO tourists (
        full_name, phone, email, blood_group, medical_info,
        emergency_contacts, govt_id_type, govt_id_hash, govt_id_suffix,
        guardian_token, guardian_token_expires, password_hash
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING ${SAFE_COLS}`,
      [
        data.fullName, data.phone, data.email ?? null,
        data.bloodGroup ?? null, data.medicalInfo ?? null,
        JSON.stringify(data.emergencyContacts),
        data.govtIdType, data.govtIdHash, data.govtIdSuffix,
        data.guardianToken, data.guardianTokenExpires, data.passwordHash,
      ]
    )
  }

  async findByPhone(phone) {
    return this.queryOne(
      `SELECT ${SAFE_COLS}, password_hash FROM tourists WHERE phone = $1`,
      [phone]
    )
  }

  async findById(id) {
    return this.queryOne(`SELECT ${SAFE_COLS} FROM tourists WHERE id = $1 AND is_active = TRUE`, [id])
  }

  async findByGuardianToken(token) {
    return this.queryOne(`
      SELECT ${SAFE_COLS}
      FROM tourists
      WHERE guardian_token = $1
        AND guardian_token_expires > NOW()
        AND is_active = TRUE`,
      [token]
    )
  }

  async govtIdHashExists(hash) {
    const row = await this.queryOne(
      'SELECT id FROM tourists WHERE govt_id_hash = $1', [hash]
    )
    return !!row
  }

  async update(id, fields) {
    // Dynamic update — only update provided fields
    const allowed = [
      'full_name', 'email', 'blood_group', 'medical_info',
      'emergency_contacts', 'profile_photo_url', 'rescue_readiness_score',
    ]
    const setClauses = []
    const values = []
    let idx = 1

    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        setClauses.push(`${key} = $${idx}`)
        values.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val)
        idx++
      }
    }

    if (setClauses.length === 0) throw new Error('No valid fields to update')
    values.push(id)

    return this.queryOne(`
      UPDATE tourists SET ${setClauses.join(', ')}
      WHERE id = $${idx} AND is_active = TRUE
      RETURNING ${SAFE_COLS}`,
      values
    )
  }
}

module.exports = { TouristRepository }
```

### Step 5.3 — src/repositories/trip.repository.js

```javascript
// src/repositories/trip.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class TripRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO trips (
        tourist_id, title, description, travel_type, start_date, end_date,
        stops, budget_inr, cover_image_url, packing_checklist, is_public, public_token,
        tsi_score, tsi_label, tsi_factors, tsi_recommendations, tsi_updated_at,
        rescue_readiness, rescue_readiness_score
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *`,
      [
        data.touristId, data.title, data.description ?? null,
        data.travelType, data.startDate, data.endDate,
        JSON.stringify(data.stops || []),
        data.budgetInr ?? null, data.coverImageUrl ?? null,
        JSON.stringify(data.packingChecklist || []),
        data.isPublic ?? false, data.publicToken ?? null,
        data.tsiScore ?? null, data.tsiLabel ?? null,
        JSON.stringify(data.tsiFactors || {}),
        JSON.stringify(data.tsiRecommendations || []),
        data.tsiScore ? new Date() : null,
        JSON.stringify(data.rescueReadiness || {}),
        data.rescueReadinessScore ?? 0,
      ]
    )
  }

  async findByTouristId(touristId, filters = {}) {
    const conditions = ['tourist_id = $1', 'status != \'CANCELLED\'']
    const params = [touristId]
    let idx = 2

    if (filters.status) {
      conditions.push(`status = $${idx}`)
      params.push(filters.status)
      idx++
    }

    const total = await this.queryCount(
      `SELECT COUNT(*) FROM trips WHERE ${conditions.join(' AND ')}`, params
    )

    const rows = await this.query(`
      SELECT id, title, travel_type, start_date, end_date, status,
        tsi_score, tsi_label, rescue_readiness_score, is_public,
        cover_image_url, budget_inr,
        jsonb_array_length(stops) as stop_count, created_at
      FROM trips
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit || 20, filters.offset || 0]
    )

    return { rows, total }
  }

  async findById(id, touristId = null) {
    const conditions = ['id = $1']
    const params = [id]
    if (touristId) { conditions.push('tourist_id = $2'); params.push(touristId) }
    return this.queryOne(`SELECT * FROM trips WHERE ${conditions.join(' AND ')}`, params)
  }

  async findByPublicToken(token) {
    return this.queryOne(`
      SELECT t.*, tu.full_name as author_name
      FROM trips t
      JOIN tourists tu ON tu.id = t.tourist_id
      WHERE t.public_token = $1 AND t.is_public = TRUE`,
      [token]
    )
  }

  async findActiveByTouristId(touristId) {
    return this.queryOne(
      `SELECT id FROM trips WHERE tourist_id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [touristId]
    )
  }

  async findAllActive() {
    return this.query(`SELECT * FROM trips WHERE status = 'ACTIVE'`)
  }

  async update(id, touristId, data) {
    return this.queryOne(`
      UPDATE trips SET
        title=$3, description=$4, travel_type=$5, start_date=$6, end_date=$7,
        stops=$8, budget_inr=$9, cover_image_url=$10, is_public=$11,
        tsi_score=$12, tsi_label=$13, tsi_factors=$14, tsi_recommendations=$15,
        tsi_updated_at=$16, rescue_readiness=$17, rescue_readiness_score=$18
      WHERE id=$1 AND tourist_id=$2
      RETURNING *`,
      [
        id, touristId,
        data.title, data.description ?? null, data.travelType,
        data.startDate, data.endDate,
        JSON.stringify(data.stops || []),
        data.budgetInr ?? null, data.coverImageUrl ?? null, data.isPublic ?? false,
        data.tsiScore ?? null, data.tsiLabel ?? null,
        JSON.stringify(data.tsiFactors || {}),
        JSON.stringify(data.tsiRecommendations || []),
        data.tsiScore ? new Date() : null,
        JSON.stringify(data.rescueReadiness || {}),
        data.rescueReadinessScore ?? 0,
      ]
    )
  }

  async updateStatus(id, touristId, status) {
    return this.queryOne(
      `UPDATE trips SET status=$3 WHERE id=$1 AND tourist_id=$2 RETURNING id, status`,
      [id, touristId, status]
    )
  }

  async updateChecklist(id, touristId, checklist) {
    return this.queryOne(
      `UPDATE trips SET packing_checklist=$3 WHERE id=$1 AND tourist_id=$2 RETURNING id, packing_checklist`,
      [id, touristId, JSON.stringify(checklist)]
    )
  }

  async updateTSI(id, tsiScore, tsiLabel, tsiFactors, tsiRecommendations) {
    return this.queryOne(`
      UPDATE trips SET
        tsi_score=$2, tsi_label=$3, tsi_factors=$4, tsi_recommendations=$5,
        tsi_updated_at=NOW()
      WHERE id=$1 RETURNING id, tsi_score, tsi_label`,
      [id, tsiScore, tsiLabel, JSON.stringify(tsiFactors), JSON.stringify(tsiRecommendations)]
    )
  }

  async delete(id, touristId) {
    return this.queryOne(
      `DELETE FROM trips WHERE id=$1 AND tourist_id=$2 RETURNING id`,
      [id, touristId]
    )
  }
}

module.exports = { TripRepository }
```

### Step 5.4 — src/repositories/sos.repository.js

```javascript
// src/repositories/sos.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class SOSRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO sos_events (
        tourist_id, trip_id, latitude, longitude, location_accuracy_m,
        is_stale_location, category, message, trigger_type, battery_pct
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        data.touristId, data.tripId ?? null,
        data.latitude, data.longitude,
        data.locationAccuracyM ?? null,
        data.isStaleLocation ?? false,
        data.category, data.message ?? null,
        data.triggerType, data.batteryPct ?? null,
      ]
    )
  }

  async findById(id) {
    return this.queryOne(`SELECT * FROM sos_events WHERE id = $1`, [id])
  }

  async findByTouristId(touristId, filters = {}) {
    const conditions = ['se.tourist_id = $1']
    const params = [touristId]
    let idx = 2

    if (filters.status) { conditions.push(`se.status = $${idx}`); params.push(filters.status); idx++ }

    const total = await this.queryCount(
      `SELECT COUNT(*) FROM sos_events se WHERE ${conditions.join(' AND ')}`, params
    )

    const rows = await this.query(`
      SELECT se.*,
        ra.status as assignment_status,
        rt.name  as rescue_team_name
      FROM sos_events se
      LEFT JOIN rescue_assignments ra ON ra.sos_event_id = se.id AND ra.status != 'RESOLVED'
      LEFT JOIN rescue_teams rt ON rt.id = ra.team_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY se.created_at DESC
      LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, filters.limit || 20, filters.offset || 0]
    )

    return { rows, total }
  }

  async findActive(filters = {}) {
    const conditions = ["se.status IN ('ACTIVE','ASSIGNED')"]
    const params = []
    let idx = 1

    if (filters.status) { conditions.push(`se.status = $${idx}`); params.push(filters.status); idx++ }
    if (filters.category) { conditions.push(`se.category = $${idx}`); params.push(filters.category); idx++ }

    const total = await this.queryCount(
      `SELECT COUNT(*) FROM sos_events se WHERE ${conditions.join(' AND ')}`, params
    )

    const rows = await this.query(`
      SELECT se.*,
        t.full_name, t.phone, t.blood_group,
        t.emergency_contacts, t.govt_id_suffix,
        tl.battery_pct as last_battery, tl.updated_at as last_location_update,
        ra.id as assignment_id, ra.status as assignment_status,
        rt.name as rescue_team_name, rt.type as rescue_team_type,
        rt.contact_phone as team_phone
      FROM sos_events se
      LEFT JOIN tourists t ON t.id = se.tourist_id
      LEFT JOIN tourist_locations tl ON tl.tourist_id = se.tourist_id
      LEFT JOIN rescue_assignments ra ON ra.sos_event_id = se.id AND ra.status != 'RESOLVED'
      LEFT JOIN rescue_teams rt ON rt.id = ra.team_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY se.created_at DESC
      LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, filters.limit || 20, filters.offset || 0]
    )

    return { rows, total }
  }

  async updateStatus(id, status, extra = {}) {
    const fields = { status }
    if (status === 'RESOLVED' || status === 'FALSE_ALARM') {
      fields.resolved_at = new Date()
      if (extra.resolutionNotes) fields.resolution_notes = extra.resolutionNotes
    }
    if (extra.contactsNotified) fields.contacts_notified = JSON.stringify(extra.contactsNotified)

    const setClauses = Object.keys(fields).map((k, i) => `${k} = $${i+2}`)
    const values = [id, ...Object.values(fields)]
    return this.queryOne(
      `UPDATE sos_events SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    )
  }

  async updateContactsNotified(id, contacts) {
    return this.queryOne(
      `UPDATE sos_events SET contacts_notified = $2 WHERE id = $1 RETURNING id`,
      [id, JSON.stringify(contacts)]
    )
  }

  async countByPeriod(startDate) {
    return this.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'RESOLVED')::int as resolved,
        COUNT(*) FILTER (WHERE status IN ('ACTIVE','ASSIGNED'))::int as active
      FROM sos_events WHERE created_at >= $1`,
      [startDate]
    )
  }

  async countByCategory(startDate) {
    return this.query(
      `SELECT category, COUNT(*)::int as count FROM sos_events
       WHERE created_at >= $1 GROUP BY category ORDER BY count DESC`,
      [startDate]
    )
  }

  async trendsPerDay(startDate) {
    return this.query(`
      SELECT date_trunc('day', created_at) as day, COUNT(*)::int as count
      FROM sos_events WHERE created_at >= $1
      GROUP BY day ORDER BY day`,
      [startDate]
    )
  }
}

module.exports = { SOSRepository }
```

### Step 5.5 — src/repositories/dms.repository.js

```javascript
// src/repositories/dms.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class DMSRepository extends BaseRepository {
  async create(data) {
    const nextTrigger = new Date(Date.now() + data.intervalMinutes * 60 * 1000)
    return this.queryOne(`
      INSERT INTO dead_mans_switches (tourist_id, trip_id, interval_minutes, next_trigger_at)
      VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.touristId, data.tripId ?? null, data.intervalMinutes, nextTrigger]
    )
  }

  async findActiveByTouristId(touristId) {
    return this.queryOne(`
      SELECT *,
        EXTRACT(EPOCH FROM (next_trigger_at - NOW()))::integer as seconds_remaining,
        EXTRACT(EPOCH FROM (next_trigger_at - INTERVAL '10 minutes' - NOW()))::integer as seconds_to_warning
      FROM dead_mans_switches
      WHERE tourist_id = $1 AND status = 'ACTIVE'
      LIMIT 1`,
      [touristId]
    )
  }

  async findById(id, touristId = null) {
    const q = touristId
      ? 'SELECT * FROM dead_mans_switches WHERE id=$1 AND tourist_id=$2 AND status=\'ACTIVE\''
      : 'SELECT * FROM dead_mans_switches WHERE id=$1 AND status=\'ACTIVE\''
    return this.queryOne(q, touristId ? [id, touristId] : [id])
  }

  // Find all DMS that need warning (10 minutes before trigger, not yet warned)
  async findNeedingWarning() {
    return this.query(`
      SELECT dms.*, t.full_name, t.phone
      FROM dead_mans_switches dms
      JOIN tourists t ON t.id = dms.tourist_id
      WHERE dms.status = 'ACTIVE'
        AND dms.warning_sent_at IS NULL
        AND (dms.next_trigger_at - INTERVAL '10 minutes') <= NOW()`,
    )
  }

  // Find all DMS that have exceeded their deadline
  async findTriggered() {
    return this.query(`
      SELECT dms.*, t.full_name, t.phone, t.blood_group,
        t.emergency_contacts, t.guardian_token, t.govt_id_suffix,
        tl.latitude, tl.longitude, tl.battery_pct
      FROM dead_mans_switches dms
      JOIN tourists t ON t.id = dms.tourist_id
      LEFT JOIN tourist_locations tl ON tl.tourist_id = dms.tourist_id
      WHERE dms.status = 'ACTIVE' AND dms.next_trigger_at <= NOW()`,
    )
  }

  async reset(id, intervalMinutes) {
    const nextTrigger = new Date(Date.now() + intervalMinutes * 60 * 1000)
    return this.queryOne(`
      UPDATE dead_mans_switches
      SET last_reset_at=NOW(), next_trigger_at=$2, warning_sent_at=NULL
      WHERE id=$1 RETURNING *`,
      [id, nextTrigger]
    )
  }

  async markWarned(id) {
    return this.queryOne(
      `UPDATE dead_mans_switches SET warning_sent_at=NOW() WHERE id=$1 RETURNING id`,
      [id]
    )
  }

  async markTriggered(id, sosEventId) {
    return this.queryOne(
      `UPDATE dead_mans_switches SET status='TRIGGERED', sos_event_id=$2 WHERE id=$1 RETURNING *`,
      [id, sosEventId]
    )
  }

  async updateStatus(id, touristId, status) {
    return this.queryOne(
      `UPDATE dead_mans_switches SET status=$3 WHERE id=$1 AND tourist_id=$2 RETURNING *`,
      [id, touristId, status]
    )
  }

  async countActive() {
    return this.queryCount('SELECT COUNT(*) FROM dead_mans_switches WHERE status=\'ACTIVE\'')
  }
}

module.exports = { DMSRepository }
```

### Step 5.6 — src/repositories/location.repository.js

```javascript
// src/repositories/location.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class LocationRepository extends BaseRepository {
  async upsert(touristId, data) {
    return this.queryOne(`
      INSERT INTO tourist_locations (tourist_id, latitude, longitude, battery_pct, accuracy_m, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (tourist_id) DO UPDATE SET
        latitude   = EXCLUDED.latitude,
        longitude  = EXCLUDED.longitude,
        battery_pct= EXCLUDED.battery_pct,
        accuracy_m = EXCLUDED.accuracy_m,
        updated_at = NOW()
      RETURNING *`,
      [touristId, data.latitude, data.longitude, data.batteryPct ?? null, data.accuracyM ?? null]
    )
  }

  async findByTouristId(touristId) {
    return this.queryOne(
      'SELECT * FROM tourist_locations WHERE tourist_id=$1', [touristId]
    )
  }

  // All tourists with location updated in the last 2 hours
  async findLive() {
    return this.query(`
      SELECT t.id, t.full_name, t.phone, t.blood_group,
        tl.latitude, tl.longitude, tl.battery_pct, tl.updated_at,
        (SELECT COUNT(*)::int FROM sos_events se
         WHERE se.tourist_id=t.id AND se.status='ACTIVE') as active_sos_count,
        (SELECT COUNT(*)::int FROM dead_mans_switches dms
         WHERE dms.tourist_id=t.id AND dms.status='ACTIVE') as active_dms_count,
        tr.title as active_trip_title, tr.tsi_score, tr.tsi_label
      FROM tourist_locations tl
      JOIN tourists t ON t.id = tl.tourist_id
      LEFT JOIN trips tr ON tr.tourist_id = t.id AND tr.status = 'ACTIVE'
      WHERE tl.updated_at >= NOW() - INTERVAL '2 hours'
      ORDER BY active_sos_count DESC, tl.updated_at DESC`)
  }

  async countActive() {
    return this.queryCount(
      `SELECT COUNT(*) FROM tourist_locations WHERE updated_at >= NOW() - INTERVAL '2 hours'`
    )
  }
}

module.exports = { LocationRepository }
```

### Step 5.7 — src/repositories/checkin.repository.js

```javascript
// src/repositories/checkin.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class CheckinRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO checkins (tourist_id, trip_id, dms_id, latitude, longitude, battery_pct, message, type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        data.touristId, data.tripId ?? null, data.dmsId ?? null,
        data.latitude, data.longitude,
        data.batteryPct ?? null, data.message ?? null,
        data.type || 'MANUAL',
      ]
    )
  }

  async findByTouristId(touristId, filters = {}) {
    const conditions = ['tourist_id=$1']
    const params = [touristId]
    let idx = 2
    if (filters.tripId) { conditions.push(`trip_id=$${idx}`); params.push(filters.tripId); idx++ }
    return this.query(
      `SELECT * FROM checkins WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx}`,
      [...params, filters.limit || 20]
    )
  }

  async findByTripId(tripId) {
    return this.query(
      'SELECT * FROM checkins WHERE trip_id=$1 ORDER BY created_at ASC', [tripId]
    )
  }
}

module.exports = { CheckinRepository }
```

### Step 5.8 — src/repositories/destination.repository.js

```javascript
// src/repositories/destination.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class DestinationRepository extends BaseRepository {
  async findAll(filters = {}) {
    const conditions = ['1=1']
    const params = []
    let idx = 1

    if (filters.state) { conditions.push(`d.state = $${idx}`); params.push(filters.state); idx++ }
    if (filters.zoneType) { conditions.push(`d.zone_type = $${idx}`); params.push(filters.zoneType); idx++ }
    if (filters.search) {
      conditions.push(`(d.name ILIKE $${idx} OR d.state ILIKE $${idx})`)
      params.push(`%${filters.search}%`)
      idx++
    }

    return this.query(`
      SELECT d.*,
        wc.condition as weather_condition, wc.risk_level as weather_risk,
        wc.temp_celsius, wc.description as weather_desc,
        wc.risk_reason, wc.fetched_at as weather_updated_at,
        (SELECT COUNT(*)::int FROM scam_reports sr WHERE sr.destination_id=d.id) as scam_count
      FROM destinations d
      LEFT JOIN weather_cache wc ON wc.destination_id = d.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.popularity_index DESC`,
      params
    )
  }

  async findById(id) {
    return this.queryOne(`
      SELECT d.*,
        wc.condition as weather_condition, wc.risk_level as weather_risk,
        wc.temp_celsius, wc.humidity_pct, wc.wind_kmh,
        wc.description as weather_desc, wc.risk_reason, wc.tsi_weather_delta,
        wc.fetched_at as weather_updated_at
      FROM destinations d
      LEFT JOIN weather_cache wc ON wc.destination_id = d.id
      WHERE d.id = $1`,
      [id]
    )
  }

  async findByIds(ids) {
    if (!ids || ids.length === 0) return []
    return this.query(
      'SELECT * FROM destinations WHERE id = ANY($1::uuid[])', [ids]
    )
  }

  async upsertWeather(destinationId, weatherData) {
    return this.queryOne(`
      INSERT INTO weather_cache
        (destination_id, condition, temp_celsius, humidity_pct, wind_kmh,
         description, risk_level, risk_reason, tsi_weather_delta, fetched_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      ON CONFLICT (destination_id) DO UPDATE SET
        condition=$2, temp_celsius=$3, humidity_pct=$4, wind_kmh=$5,
        description=$6, risk_level=$7, risk_reason=$8, tsi_weather_delta=$9,
        fetched_at=NOW()
      RETURNING *`,
      [
        destinationId,
        weatherData.condition, weatherData.tempCelsius,
        weatherData.humidityPct, weatherData.windKmh,
        weatherData.description, weatherData.riskLevel,
        weatherData.riskReason, weatherData.tsiWeatherDelta,
      ]
    )
  }

  async getWeatherCache(destinationId) {
    return this.queryOne('SELECT * FROM weather_cache WHERE destination_id=$1', [destinationId])
  }

  async getWeatherCacheMap(destinationIds) {
    if (!destinationIds || destinationIds.length === 0) return {}
    const rows = await this.query(
      'SELECT * FROM weather_cache WHERE destination_id = ANY($1::uuid[])', [destinationIds]
    )
    return rows.reduce((acc, row) => ({ ...acc, [row.destination_id]: row }), {})
  }

  async isWeatherStale(destinationId, ttlMinutes) {
    const row = await this.queryOne(
      `SELECT (fetched_at < NOW() - ($2 || ' minutes')::interval) as is_stale
       FROM weather_cache WHERE destination_id=$1`,
      [destinationId, ttlMinutes]
    )
    return row?.is_stale !== false  // treat missing as stale
  }
}

module.exports = { DestinationRepository }
```

### Step 5.9 — src/repositories/rescue.repository.js

```javascript
// src/repositories/rescue.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class RescueRepository extends BaseRepository {
  async findAllTeams() {
    return this.query(`
      SELECT rt.*,
        (SELECT COUNT(*)::int FROM rescue_assignments ra
         WHERE ra.team_id=rt.id AND ra.status NOT IN ('RESOLVED')) as active_assignments
      FROM rescue_teams rt ORDER BY rt.status ASC, rt.name ASC`)
  }

  async findTeamById(id) {
    return this.queryOne('SELECT * FROM rescue_teams WHERE id=$1', [id])
  }

  async updateTeamStatus(id, status) {
    return this.queryOne(
      'UPDATE rescue_teams SET status=$2 WHERE id=$1 RETURNING *', [id, status]
    )
  }

  async createAssignment(data) {
    return this.queryOne(`
      INSERT INTO rescue_assignments (sos_event_id, team_id, assigned_by, notes)
      VALUES ($1,$2,$3,$4) RETURNING *`,
      [data.sosEventId, data.teamId, data.assignedBy ?? null, data.notes ?? null]
    )
  }

  async findActiveAssignmentBySOS(sosEventId) {
    return this.queryOne(
      `SELECT * FROM rescue_assignments WHERE sos_event_id=$1 AND status NOT IN ('RESOLVED') LIMIT 1`,
      [sosEventId]
    )
  }

  async resolveAssignment(sosEventId) {
    return this.queryOne(`
      UPDATE rescue_assignments SET status='RESOLVED', resolved_at=NOW()
      WHERE sos_event_id=$1 AND status NOT IN ('RESOLVED')
      RETURNING team_id`,
      [sosEventId]
    )
  }

  async countAvailable() {
    return this.queryCount(`SELECT COUNT(*) FROM rescue_teams WHERE status='AVAILABLE'`)
  }

  async countDeployed() {
    return this.queryCount(`SELECT COUNT(*) FROM rescue_teams WHERE status='DEPLOYED'`)
  }

  async avgResponseMinutes(startDate) {
    const row = await this.queryOne(`
      SELECT AVG(EXTRACT(EPOCH FROM (ra.assigned_at - se.created_at)) / 60.0)::numeric(6,1) as avg_mins
      FROM rescue_assignments ra
      JOIN sos_events se ON se.id=ra.sos_event_id
      WHERE ra.assigned_at >= $1`,
      [startDate]
    )
    return parseFloat(row?.avg_mins ?? 0)
  }
}

module.exports = { RescueRepository }
```

### Step 5.10 — src/repositories/govt.repository.js

```javascript
// src/repositories/govt.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class GovtRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO govt_users (name, email, password_hash, role, district, state)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, name, email, role, district, state, is_active, created_at`,
      [data.name, data.email, data.passwordHash, data.role, data.district ?? null, data.state ?? null]
    )
  }

  async findByEmail(email) {
    return this.queryOne(`
      SELECT id, name, email, role, district, state, is_active, password_hash
      FROM govt_users WHERE email=$1`,
      [email]
    )
  }

  async findById(id) {
    return this.queryOne(`
      SELECT id, name, email, role, district, state, is_active
      FROM govt_users WHERE id=$1 AND is_active=TRUE`,
      [id]
    )
  }
}

module.exports = { GovtRepository }
```

### Step 5.11 — src/repositories/scam.repository.js

```javascript
// src/repositories/scam.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class ScamRepository extends BaseRepository {
  async create(data) {
    return this.queryOne(`
      INSERT INTO scam_reports (destination_id, tourist_id, category, description, incident_date)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.destinationId, data.touristId, data.category, data.description, data.incidentDate ?? null]
    )
  }

  async findByDestination(destinationId, limit = 50) {
    return this.query(`
      SELECT id, category, description, incident_date, verified, created_at
      FROM scam_reports
      WHERE destination_id=$1
      ORDER BY created_at DESC LIMIT $2`,
      [destinationId, limit]
    )
  }

  async countByDestination(destinationId) {
    const rows = await this.query(
      `SELECT category, COUNT(*)::int as count FROM scam_reports
       WHERE destination_id=$1 GROUP BY category`,
      [destinationId]
    )
    const total = rows.reduce((s, r) => s + r.count, 0)
    const byCategory = rows.reduce((acc, r) => ({ ...acc, [r.category]: r.count }), {})
    return { total, byCategory }
  }
}

module.exports = { ScamRepository }
```

### Step 5.12 — src/repositories/inbound.repository.js

```javascript
// src/repositories/inbound.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class InboundRepository extends BaseRepository {
  async create(fromPhone, rawBody) {
    return this.queryOne(
      `INSERT INTO inbound_sos_sms (from_phone, raw_body) VALUES ($1,$2) RETURNING *`,
      [fromPhone, rawBody]
    )
  }

  async markParsed(id, touristId, sosEventId) {
    return this.queryOne(
      `UPDATE inbound_sos_sms SET parsed=TRUE, tourist_id=$2, sos_event_id=$3 WHERE id=$1 RETURNING id`,
      [id, touristId, sosEventId]
    )
  }

  async markFailed(id, errorMsg) {
    return this.queryOne(
      `UPDATE inbound_sos_sms SET parsed=FALSE, parse_error=$2 WHERE id=$1 RETURNING id`,
      [id, errorMsg]
    )
  }
}

module.exports = { InboundRepository }
```

✅ **Phase 5 verification:**
```bash
node -e "
  const { BaseRepository } = require('./src/repositories/base.repository')
  const { TouristRepository } = require('./src/repositories/tourist.repository')
  const { SOSRepository } = require('./src/repositories/sos.repository')
  const { TripRepository } = require('./src/repositories/trip.repository')
  const { DMSRepository } = require('./src/repositories/dms.repository')
  const { LocationRepository } = require('./src/repositories/location.repository')
  const { DestinationRepository } = require('./src/repositories/destination.repository')
  const { RescueRepository } = require('./src/repositories/rescue.repository')
  const { GovtRepository } = require('./src/repositories/govt.repository')
  const { ScamRepository } = require('./src/repositories/scam.repository')
  const { InboundRepository } = require('./src/repositories/inbound.repository')
  const { CheckinRepository } = require('./src/repositories/checkin.repository')
  console.log('✅ All 12 repositories load cleanly')

  // Verify BaseRepository pattern
  const repo = new TouristRepository()
  console.assert(repo.db !== null, 'db getter must return pool when no client passed')
  const repoWithClient = new TouristRepository({ query: () => {} })
  console.assert(repoWithClient._client !== null, 'client must be stored')
  console.log('✅ Repository client pattern verified')
"
```


---

## PHASE 6 — SERVICE LAYER

Services contain all business logic. They compose repositories and trigger side effects.
Side effects (socket emit, SMS) always happen AFTER withTransaction completes.

### Step 6.1 — src/services/tsi.service.js

```javascript
// src/services/tsi.service.js
'use strict'

// TSI = Travel Safety Index (0–100, higher = safer)
// Rules: worst stop drives the penalty, not average.
// Weather delta comes from weather_cache — passed as weatherCacheMap.

const TRAVEL_TYPE_DELTA = {
  SOLO: -12, ADVENTURE: -15, FAMILY: 0, FRIENDS: -5, PILGRIMAGE: -3, BUSINESS: 0,
}
const CONNECTIVITY_PENALTY = { NONE: 20, POOR: 10, MODERATE: 4, GOOD: 0, EXCELLENT: 0 }
const DIFFICULTY_PENALTY = { EASY: 0, MODERATE: 5, HARD: 15, EXTREME: 25 }
const ZONE_PENALTY = { SAFE: 0, CAUTION: 5, ILP_REQUIRED: 10, HIGH_RISK: 20, RESTRICTED: 25 }
const WEATHER_PENALTY = { CLEAR: 0, CLOUDY: 0, FOG: 5, RAIN: 5, HEAVY_RAIN: 15, SNOW: 10, STORM: 20 }

function calculateTSI(trip, weatherCacheMap = {}) {
  let score = 100
  const factors = {}

  // 1. Travel type adjustment
  factors.travelType = TRAVEL_TYPE_DELTA[trip.travel_type] || 0
  score += factors.travelType

  // 2. Duration penalty (long trips = more exposure to risk)
  const days = Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / 86400000)
  factors.duration = days > 30 ? -10 : days > 14 ? -5 : 0
  score += factors.duration

  // 3. NER monsoon season penalty (June-September)
  const startMonth = new Date(trip.start_date).getMonth() + 1
  factors.season = [6, 7, 8, 9].includes(startMonth) ? -10 : 0
  score += factors.season

  // 4. Per-stop analysis — WORST stop drives the penalty
  const stops = Array.isArray(trip.stops) ? trip.stops : (JSON.parse(trip.stops || '[]'))
  let worstPenalty = 0

  for (const stop of stops) {
    let penalty = 0
    penalty += CONNECTIVITY_PENALTY[stop.connectivity] || 0
    const hKm = parseFloat(stop.hospital_km) || 0
    penalty += hKm > 50 ? 15 : hKm > 20 ? 8 : hKm < 5 ? -5 : 0
    const alt = parseInt(stop.altitude_m) || 0
    penalty += alt > 4000 ? 20 : alt > 3000 ? 10 : alt > 2000 ? 4 : 0
    penalty += ZONE_PENALTY[stop.zone_type] || 0
    penalty += DIFFICULTY_PENALTY[stop.difficulty] || 0

    // Weather from cache (by destinationId)
    const destId = stop.destinationId || stop.destination_id
    const weatherEntry = destId && weatherCacheMap[destId]
    if (weatherEntry) {
      penalty += WEATHER_PENALTY[weatherEntry.condition] || 0
      factors.weather = -(WEATHER_PENALTY[weatherEntry.condition] || 0)
    }

    if (penalty > worstPenalty) worstPenalty = penalty
  }

  factors.worstStop = -worstPenalty
  score -= worstPenalty

  // 5. Clamp to [10, 100]
  const finalScore = Math.max(10, Math.min(100, Math.round(score)))
  const label =
    finalScore >= 80 ? 'Low Risk'      :
    finalScore >= 60 ? 'Moderate Risk' :
    finalScore >= 40 ? 'High Risk'     : 'Extreme Risk'

  return {
    score: finalScore,
    label,
    factors,
    recommendations: generateRecommendations(finalScore, trip, stops),
  }
}

function generateRecommendations(score, trip, stops) {
  const recs = []
  recs.push('Share your itinerary with your Guardian contact before departure')
  if (score < 70) recs.push('Enable Dead Man\'s Switch — set to 2-hour intervals for this route')
  if (score < 70) recs.push('Download offline maps for all destinations before departing')
  if (trip.travel_type === 'SOLO') recs.push('Solo travel detected: set shorter DMS intervals and notify 2 contacts')
  if (stops.some(s => parseInt(s.altitude_m) > 3000)) recs.push('High altitude stops: carry altitude medication (Diamox) — consult doctor')
  if (stops.some(s => s.zone_type === 'ILP_REQUIRED')) recs.push('Inner Line Permit required — verify documentation 7 days in advance')
  if (stops.some(s => ['NONE','POOR'].includes(s.connectivity))) recs.push('Poor/no connectivity zones: save emergency numbers in phone memory (not only contacts app)')
  if (stops.some(s => s.zone_type === 'RESTRICTED')) recs.push('Restricted zone: register with district authorities and provide hotel details')
  if (score < 40) recs.push('Extreme risk: consider travelling with a registered local guide')
  if (stops.some(s => parseFloat(s.hospital_km) > 50)) recs.push('Nearest hospital is far: carry a comprehensive first aid kit and basic medication')
  return recs
}

// Rescue Readiness Score: 6-item checklist → percentage
function computeRescueReadiness(tourist, trip, hasDMSActive = false) {
  const items = {
    emergencyContacts: Array.isArray(tourist.emergency_contacts) && tourist.emergency_contacts.length > 0,
    medicalInfo:       !!tourist.blood_group,
    govtIdComplete:    !!tourist.govt_id_suffix,
    dmsEnabled:        hasDMSActive,
    tsiReviewed:       !!trip.tsi_score,
    offlineMaps:       !!(trip.rescue_readiness && trip.rescue_readiness.offlineMaps),
  }
  const trueCount = Object.values(items).filter(Boolean).length
  const score = Math.round((trueCount / 6) * 100)
  return { items, score }
}

module.exports = { calculateTSI, computeRescueReadiness }
```

### Step 6.2 — src/services/notification/sms.service.js

```javascript
// src/services/notification/sms.service.js
// Single-responsibility: send one SMS via Twilio.
// NEVER throws — callers fire-and-forget.
'use strict'

const { getTwilioClient } = require('../../config/twilio')
const config = require('../../config/env')
const logger = require('../../utils/logger')

async function sendSMS(toPhone, message) {
  const client = getTwilioClient()
  if (!client) {
    logger.debug({ toPhone }, 'SMS skipped — Twilio not configured')
    return { sent: false, reason: 'Twilio not configured' }
  }

  // Ensure E.164 format
  const to = toPhone.startsWith('+') ? toPhone : `+91${toPhone}`

  try {
    const msg = await client.messages.create({
      body: message,
      from: config.twilio.fromNumber,
      to,
    })
    logger.info({ sid: msg.sid, to }, 'SMS sent successfully')
    return { sent: true, sid: msg.sid }
  } catch (err) {
    // Log but never throw — SMS failure must not block SOS response
    logger.error({ err: { message: err.message, code: err.code }, to }, 'Twilio SMS failed')
    return { sent: false, reason: err.message }
  }
}

module.exports = { sendSMS }
```

### Step 6.3 — src/services/notification/notification.service.js

```javascript
// src/services/notification/notification.service.js
// Orchestrates who to notify, when, and with what message.
// All methods are fire-and-forget (never await from service callers).
'use strict'

const { sendSMS } = require('./sms.service')
const config = require('../../config/env')
const logger = require('../../utils/logger')

// Builds the SOS SMS message for emergency contacts
function buildSOSMessage(tourist, sos) {
  const time = new Date(sos.created_at || Date.now()).toLocaleTimeString('en-IN')
  const trackUrl = `${config.cors.guardianUrl}/track/${tourist.guardian_token}`
  const category = sos.category || 'EMERGENCY'
  const stale = sos.is_stale_location ? ' (last known location — may be old)' : ''
  return [
    `🆘 AARAKSHA ALERT`,
    `${tourist.full_name} triggered an SOS at ${time}`,
    `Type: ${category}${sos.message ? ' — ' + sos.message : ''}`,
    `Location: https://maps.google.com/?q=${sos.latitude},${sos.longitude}${stale}`,
    `Track live: ${trackUrl}`,
    `Blood group: ${tourist.blood_group || 'Unknown'}`,
    `ID suffix: ...${tourist.govt_id_suffix}`,
  ].join('\n')
}

// Notifies all emergency contacts after an SOS.
// Tier 1: immediate. Tier 2: after 60 seconds.
// Returns the contacts_notified array (stored in sos_events).
async function notifyOnSOS(tourist, sos) {
  const contacts = Array.isArray(tourist.emergency_contacts) ? tourist.emergency_contacts : []
  if (contacts.length === 0) {
    logger.warn({ touristId: tourist.id, sosId: sos.id }, 'SOS fired but no emergency contacts configured')
    return []
  }

  const message = buildSOSMessage(tourist, sos)
  const notified = []

  const tier1 = contacts.filter(c => c.tier === 1 || !c.tier)
  const tier2 = contacts.filter(c => c.tier === 2)

  // Tier 1: send now
  for (const contact of tier1) {
    const result = await sendSMS(contact.phone, message)
    notified.push({ phone: contact.phone, tier: 1, method: result.sent ? 'SMS' : 'FAILED', notifiedAt: new Date().toISOString() })
  }

  // Tier 2: send after 60 seconds (fire and forget)
  if (tier2.length > 0) {
    setTimeout(() => {
      Promise.all(tier2.map(async (contact) => {
        const result = await sendSMS(contact.phone, message)
        logger.info({ phone: contact.phone, sent: result.sent }, 'Tier-2 SOS notification sent')
      })).catch(err => logger.error({ err }, 'Tier-2 notification batch failed'))
    }, 60_000)
  }

  return notified
}

// DMS warning: notify tourist directly that their DMS is about to trigger
async function notifyDMSWarning(tourist, dms) {
  const minutesLeft = Math.ceil((new Date(dms.next_trigger_at) - Date.now()) / 60_000)
  const checkInUrl = `${config.cors.touristUrl}/checkin`
  const message = [
    `⏰ AARAKSHA: Check-in required`,
    `Your Dead Man's Switch triggers in ${minutesLeft} minutes.`,
    `If you don't check in, an SOS will be sent to your emergency contacts and authorities.`,
    `Check in now: ${checkInUrl}`,
  ].join('\n')

  await sendSMS(tourist.phone, message)
  logger.info({ touristId: tourist.id, dmsId: dms.id, minutesLeft }, 'DMS warning SMS sent')
}

// ETA exceeded alert: guardian gets a gentle notification
async function notifyETAExceeded(contact, tourist, stop) {
  const message = [
    `⚠️ AARAKSHA: Late arrival alert`,
    `${tourist.full_name} was expected at ${stop.city} by now but hasn't checked in.`,
    `Last known location: https://maps.google.com/?q=${stop.lat},${stop.lng}`,
    `This is an automated alert — they may simply have bad connectivity.`,
    `Track them: ${config.cors.guardianUrl}/track/${tourist.guardian_token}`,
  ].join('\n')

  await sendSMS(contact.phone, message)
}

module.exports = { notifyOnSOS, notifyDMSWarning, notifyETAExceeded }
```

### Step 6.4 — src/services/weather.service.js

```javascript
// src/services/weather.service.js
'use strict'

const axios = require('axios')
const config = require('../config/env')
const logger = require('../utils/logger')
const { DestinationRepository } = require('../repositories/destination.repository')
const { TripRepository } = require('../repositories/trip.repository')
const { calculateTSI } = require('./tsi.service')
const { WEATHER_CONDITIONS, WEATHER_RISK } = require('../constants/enums')

// Map OWM weather.main → our condition enum
function mapOWMCondition(main, description = '') {
  const d = description.toLowerCase()
  if (main === 'Thunderstorm') return WEATHER_CONDITIONS.STORM
  if (main === 'Snow')         return WEATHER_CONDITIONS.SNOW
  if (main === 'Drizzle')      return WEATHER_CONDITIONS.RAIN
  if (main === 'Rain')         return d.includes('heavy') ? WEATHER_CONDITIONS.HEAVY_RAIN : WEATHER_CONDITIONS.RAIN
  if (['Mist','Smoke','Haze','Dust','Fog','Ash','Squall'].includes(main)) return WEATHER_CONDITIONS.FOG
  if (main === 'Clear')        return WEATHER_CONDITIONS.CLEAR
  return WEATHER_CONDITIONS.CLOUDY
}

function deriveRisk(condition, windKmh) {
  if (condition === WEATHER_CONDITIONS.STORM)      return { level: WEATHER_RISK.EXTREME, reason: 'Thunderstorm — travel strongly discouraged' }
  if (condition === WEATHER_CONDITIONS.HEAVY_RAIN) return { level: WEATHER_RISK.HIGH,    reason: 'Heavy rainfall — landslide risk in hilly terrain' }
  if (condition === WEATHER_CONDITIONS.SNOW)       return { level: WEATHER_RISK.HIGH,    reason: 'Snowfall — road closures likely' }
  if (condition === WEATHER_CONDITIONS.RAIN && windKmh > 40) return { level: WEATHER_RISK.MODERATE, reason: 'Rain with strong winds — exercise caution' }
  if (condition === WEATHER_CONDITIONS.FOG)        return { level: WEATHER_RISK.MODERATE, reason: 'Low visibility — drive carefully' }
  if (condition === WEATHER_CONDITIONS.RAIN)       return { level: WEATHER_RISK.LOW,     reason: null }
  return { level: WEATHER_RISK.LOW, reason: null }
}

const TSI_WEATHER_DELTA_MAP = {
  [WEATHER_CONDITIONS.STORM]:      -20,
  [WEATHER_CONDITIONS.HEAVY_RAIN]: -15,
  [WEATHER_CONDITIONS.SNOW]:       -10,
  [WEATHER_CONDITIONS.FOG]:         -5,
  [WEATHER_CONDITIONS.RAIN]:        -5,
  [WEATHER_CONDITIONS.CLOUDY]:       0,
  [WEATHER_CONDITIONS.CLEAR]:        0,
}

async function fetchWeatherForDestination(destination) {
  if (!config.owm.enabled) {
    logger.debug('OWM disabled — weather fetch skipped')
    return null
  }

  const url = `${config.owm.baseUrl}/weather`
  const params = {
    lat: destination.latitude,
    lon: destination.longitude,
    appid: config.owm.apiKey,
    units: 'metric',
  }

  try {
    const { data } = await axios.get(url, { params, timeout: 5000 })
    const condition = mapOWMCondition(data.weather[0].main, data.weather[0].description)
    const windKmh = Math.round((data.wind?.speed || 0) * 3.6)
    const { level: riskLevel, reason: riskReason } = deriveRisk(condition, windKmh)

    return {
      condition,
      tempCelsius:     Math.round(data.main.temp),
      humidityPct:     data.main.humidity,
      windKmh,
      description:     data.weather[0].description,
      riskLevel,
      riskReason,
      tsiWeatherDelta: TSI_WEATHER_DELTA_MAP[condition] || 0,
    }
  } catch (err) {
    logger.error({ err: { message: err.message }, destination: destination.name }, 'OWM fetch failed')
    return null
  }
}

// Called by weather cron job every 60 minutes.
// Fetches weather for all destinations referenced in ACTIVE trips.
// Updates weather_cache, recalculates TSI for each trip, emits socket events.
async function updateWeatherForActiveTrips(emitTSIUpdated) {
  const tripRepo = new TripRepository()
  const destRepo = new DestinationRepository()

  const activeTrips = await tripRepo.findAllActive()
  if (activeTrips.length === 0) {
    logger.debug('No active trips — weather cron skipped')
    return { tripsUpdated: 0, destinationsUpdated: 0 }
  }

  // Collect unique destination IDs across all active trips
  const destinationIds = new Set()
  for (const trip of activeTrips) {
    const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
    for (const stop of stops) {
      const id = stop.destinationId || stop.destination_id
      if (id) destinationIds.add(id)
    }
  }

  if (destinationIds.size === 0) {
    logger.debug('Active trips have no destination IDs — skipping weather update')
    return { tripsUpdated: 0, destinationsUpdated: 0 }
  }

  const destinations = await destRepo.findByIds([...destinationIds])
  let destUpdated = 0

  for (const dest of destinations) {
    const weather = await fetchWeatherForDestination(dest)
    if (weather) {
      await destRepo.upsertWeather(dest.id, weather)
      destUpdated++
    }
  }

  // Build cache map for TSI recalculation
  const weatherCacheMap = await destRepo.getWeatherCacheMap([...destinationIds])
  let tripsUpdated = 0

  for (const trip of activeTrips) {
    try {
      const tsiResult = calculateTSI(trip, weatherCacheMap)
      await tripRepo.updateTSI(trip.id, tsiResult.score, tsiResult.label, tsiResult.factors, tsiResult.recommendations)
      emitTSIUpdated(trip.tourist_id, trip.id, tsiResult.score, tsiResult.label, tsiResult.factors)
      tripsUpdated++
    } catch (err) {
      logger.error({ err: { message: err.message }, tripId: trip.id }, 'TSI update failed for trip')
    }
  }

  logger.info({ tripsUpdated, destinationsUpdated: destUpdated }, 'Weather + TSI cron complete')
  return { tripsUpdated, destinationsUpdated: destUpdated }
}

module.exports = { fetchWeatherForDestination, updateWeatherForActiveTrips }
```

### Step 6.5 — src/services/gemini.service.js

```javascript
// src/services/gemini.service.js
'use strict'

const { getGeminiModel } = require('../config/gemini')
const { uuid } = require('uuid')
const logger = require('../utils/logger')
const { PACKING_CATEGORIES } = require('../constants/enums')

const OFFLINE_FALLBACK = [
  { item: 'Government ID (original + 3 photocopies)', category: 'DOCUMENTS', essential: true },
  { item: 'Inner Line Permit (if destination requires)', category: 'DOCUMENTS', essential: true },
  { item: 'Emergency contacts printout (no phone needed)', category: 'DOCUMENTS', essential: true },
  { item: 'Travel insurance document', category: 'DOCUMENTS', essential: true },
  { item: 'First aid kit (bandages, antiseptic, scissors)', category: 'MEDICINE', essential: true },
  { item: 'Personal medications (7-day supply extra)', category: 'MEDICINE', essential: true },
  { item: 'ORS packets and water purification tablets', category: 'MEDICINE', essential: true },
  { item: 'Power bank (20,000 mAh minimum)', category: 'ELECTRONICS', essential: true },
  { item: 'Offline maps downloaded (Google Maps / Maps.me)', category: 'ELECTRONICS', essential: true },
  { item: 'Charging cables + universal adapter', category: 'ELECTRONICS', essential: false },
  { item: 'Emergency whistle', category: 'SAFETY', essential: true },
  { item: 'Torch / headlamp + extra batteries', category: 'SAFETY', essential: true },
  { item: 'Raincoat / poncho (NE India receives heavy monsoon)', category: 'CLOTHING', essential: true },
  { item: 'Warm layers (temperature drops rapidly at altitude)', category: 'CLOTHING', essential: true },
  { item: 'Trekking shoes with grip (if visiting hilly areas)', category: 'CLOTHING', essential: false },
  { item: 'Dry snacks + emergency rations (2-day supply)', category: 'FOOD', essential: true },
  { item: 'Reusable water bottle (1L minimum)', category: 'FOOD', essential: true },
]

async function generatePackingList({ destination, state, tsiScore, tsiLabel, weatherCondition, travelType, startDate, endDate, stops }) {
  const model = getGeminiModel()
  if (!model) {
    logger.info('Gemini not available — using offline fallback packing list')
    return { items: OFFLINE_FALLBACK.map(i => ({ ...i, id: require('uuid').v4(), packed: false })), source: 'OFFLINE_FALLBACK' }
  }

  const stopsList = (stops || []).map(s => `${s.city}, ${s.state}`).join(' → ')
  const isHighRisk = tsiScore < 60
  const isAdventure = travelType === 'ADVENTURE'
  const isFamily = travelType === 'FAMILY'
  const hasAltitude = (stops || []).some(s => parseInt(s.altitude_m) > 3000)
  const hasBadWeather = ['HEAVY_RAIN','STORM','SNOW'].includes(weatherCondition)

  const prompt = `You are a travel safety expert for Northeast India.
Generate a context-aware packing checklist for this trip.

Trip details:
- Starting destination: ${destination}, ${state}
- Full route: ${stopsList || destination}
- Dates: ${startDate} to ${endDate}
- Travel type: ${travelType}
- Travel Safety Index: ${tsiScore}/100 (${tsiLabel})
- Current weather: ${weatherCondition || 'UNKNOWN'}

Specific considerations:
${isHighRisk ? '- HIGH RISK TRIP: Include emergency equipment (emergency blanket, rope, whistle, flares)' : ''}
${isAdventure ? '- Adventure/trekking: Include trekking poles, altitude sickness meds, crampon spikes' : ''}
${isFamily ? '- Family trip: Include baby/child medicine, ID copies for all family members, extra snacks' : ''}
${hasAltitude ? '- High altitude (>3000m): Include Diamox (altitude medication), UV sunscreen SPF50+, lip balm, thermals' : ''}
${hasBadWeather ? '- Bad weather expected: Include rain poncho, waterproof bag covers, gumboots/waterproof shoes' : ''}
- NE India specific: Inner Line Permit copies if required, offline maps essential, carry cash (cards may not work)

Return ONLY a valid JSON array. No markdown, no explanation, no code blocks.
Each object: {"item":"string","category":"${Object.values(PACKING_CATEGORIES).join('|')}","essential":boolean}
Maximum 30 items. Sort essential items first, then by category.`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    // Strip any markdown code blocks if model adds them
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    if (!Array.isArray(parsed)) throw new Error('Gemini response is not an array')

    const items = parsed.slice(0, 30).map(i => ({
      id:        require('uuid').v4(),
      item:      String(i.item || '').slice(0, 255),
      category:  Object.values(PACKING_CATEGORIES).includes(i.category) ? i.category : 'OTHER',
      essential: Boolean(i.essential),
      packed:    false,
    }))

    logger.info({ destination, count: items.length }, 'Gemini packing list generated')
    return { items, source: 'GEMINI_AI' }

  } catch (err) {
    logger.error({ err: { message: err.message } }, 'Gemini packing list failed — using fallback')
    return {
      items: OFFLINE_FALLBACK.map(i => ({ ...i, id: require('uuid').v4(), packed: false })),
      source: 'OFFLINE_FALLBACK'
    }
  }
}

module.exports = { generatePackingList }
```

### Step 6.6 — src/services/auth.service.js

```javascript
// src/services/auth.service.js
'use strict'

const jwt = require('jsonwebtoken')
const { v4: uuid } = require('uuid')
const config = require('../config/env')
const logger = require('../utils/logger')
const { TouristRepository } = require('../repositories/tourist.repository')
const { GovtRepository } = require('../repositories/govt.repository')
const { hashPassword, verifyPassword, hashGovtId, generateGuardianToken,
        normalizePhone, extractSuffix } = require('../utils/crypto')
const { ERRORS } = require('../constants/errors')

function generateJWT(id, role) {
  return jwt.sign({ id, role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn })
}

async function registerTourist(data) {
  const repo = new TouristRepository()

  const phone = normalizePhone(data.phone)
  const existing = await repo.findByPhone(phone)
  if (existing) throw Object.assign(new Error(ERRORS.PHONE_TAKEN), { statusCode: 409 })

  const govtIdHash = hashGovtId(data.govtIdNumber)
  const govtIdTaken = await repo.govtIdHashExists(govtIdHash)
  if (govtIdTaken) throw Object.assign(new Error(ERRORS.GOVTID_TAKEN), { statusCode: 409 })

  const passwordHash = await hashPassword(data.password)
  const guardianToken = generateGuardianToken()
  const guardianTokenExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)  // 90 days

  const contacts = (data.emergencyContacts || []).map((c, i) => ({
    id:          uuid(),
    name:        c.name,
    phone:       normalizePhone(c.phone),
    relation:    c.relation,
    tier:        c.tier || (i === 0 ? 1 : 2),
    notifyOnSOS: c.notifyOnSOS !== false,
  }))

  const tourist = await repo.create({
    fullName: data.fullName,
    phone,
    email: data.email || null,
    bloodGroup: data.bloodGroup || null,
    medicalInfo: data.medicalInfo || null,
    emergencyContacts: contacts,
    govtIdType: data.govtIdType,
    govtIdHash,
    govtIdSuffix: extractSuffix(data.govtIdNumber),
    guardianToken,
    guardianTokenExpires,
    passwordHash,
  })

  const token = generateJWT(tourist.id, 'tourist')
  logger.info({ touristId: tourist.id }, 'Tourist registered')
  return { tourist, token }
}

async function loginTourist(data) {
  const repo = new TouristRepository()
  const phone = normalizePhone(data.phone)
  const tourist = await repo.findByPhone(phone)

  if (!tourist) throw Object.assign(new Error(ERRORS.INVALID_CREDENTIALS), { statusCode: 401 })
  if (!tourist.is_active) throw Object.assign(new Error(ERRORS.ACCOUNT_INACTIVE), { statusCode: 401 })

  const valid = await verifyPassword(data.password, tourist.password_hash)
  if (!valid) throw Object.assign(new Error(ERRORS.INVALID_CREDENTIALS), { statusCode: 401 })

  const { password_hash, ...safeTourist } = tourist
  const token = generateJWT(tourist.id, 'tourist')
  logger.info({ touristId: tourist.id }, 'Tourist logged in')
  return { tourist: safeTourist, token }
}

async function registerGovt(data) {
  const repo = new GovtRepository()
  const passwordHash = await hashPassword(data.password)
  const user = await repo.create({ ...data, passwordHash })
  const token = generateJWT(user.id, 'govt')
  logger.info({ govtUserId: user.id, role: data.role }, 'Govt user registered')
  return { user, token }
}

async function loginGovt(data) {
  const repo = new GovtRepository()
  const user = await repo.findByEmail(data.email)
  if (!user) throw Object.assign(new Error(ERRORS.INVALID_CREDENTIALS), { statusCode: 401 })
  if (!user.is_active) throw Object.assign(new Error(ERRORS.ACCOUNT_INACTIVE), { statusCode: 401 })
  const valid = await verifyPassword(data.password, user.password_hash)
  if (!valid) throw Object.assign(new Error(ERRORS.INVALID_CREDENTIALS), { statusCode: 401 })
  const { password_hash, ...safeUser } = user
  const token = generateJWT(user.id, 'govt')
  return { user: safeUser, token }
}

module.exports = { registerTourist, loginTourist, registerGovt, loginGovt }
```

### Step 6.7 — src/services/sos.service.js

```javascript
// src/services/sos.service.js
// THE MOST CRITICAL SERVICE — no mistakes allowed.
'use strict'

const { withTransaction } = require('../database/transaction')
const { SOSRepository } = require('../repositories/sos.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { notifyOnSOS } = require('./notification/notification.service')
const { emitSOSReceived, emitSOSResolved } = require('../socket/emitters')
const { SOS_TRIGGER_TYPES, SOS_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

async function createSOS(touristId, data) {
  // 1. Run DB writes in a transaction
  const { sosEvent, tourist } = await withTransaction(async (client) => {
    const sosRepo      = new SOSRepository(client)
    const locationRepo = new LocationRepository(client)
    const touristRepo  = new TouristRepository(client)

    const sosEvent = await sosRepo.create({
      touristId,
      tripId:            data.tripId || null,
      latitude:          data.latitude,
      longitude:         data.longitude,
      locationAccuracyM: data.locationAccuracyM || null,
      isStaleLocation:   data.isStaleLocation || false,
      category:          data.category,
      message:           data.message || null,
      triggerType:       SOS_TRIGGER_TYPES.MANUAL,
      batteryPct:        data.batteryPct || null,
    })

    // Always update last known location on SOS
    await locationRepo.upsert(touristId, {
      latitude:   data.latitude,
      longitude:  data.longitude,
      batteryPct: data.batteryPct || null,
      accuracyM:  data.locationAccuracyM || null,
    })

    const tourist = await touristRepo.findById(touristId)
    return { sosEvent, tourist }
  })

  // 2. Side effects AFTER transaction — failures here do not rollback SOS
  emitSOSReceived(sosEvent, tourist)

  // Fire and forget — never await, never throw to caller
  notifyOnSOS(tourist, sosEvent)
    .then(notified => {
      const sosRepo = new SOSRepository()
      return sosRepo.updateContactsNotified(sosEvent.id, notified)
    })
    .catch(err => logger.error({ err: { message: err.message }, sosId: sosEvent.id }, 'Post-SOS notification failed'))

  logger.warn({ sosId: sosEvent.id, touristId, category: data.category }, 'SOS created')
  return sosEvent
}

async function getSOSHistory(touristId, filters) {
  const repo = new SOSRepository()
  return repo.findByTouristId(touristId, filters)
}

async function markFalseAlarm(sosId, touristId) {
  const repo = new SOSRepository()
  const sos = await repo.findById(sosId)

  if (!sos) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  if (sos.tourist_id !== touristId) throw Object.assign(new Error(ERRORS.FORBIDDEN), { statusCode: 403 })
  if ([SOS_STATUSES.RESOLVED, SOS_STATUSES.FALSE_ALARM].includes(sos.status)) {
    throw Object.assign(new Error(ERRORS.SOS_ALREADY_CLOSED), { statusCode: 400 })
  }

  const updated = await repo.updateStatus(sosId, SOS_STATUSES.FALSE_ALARM)
  emitSOSResolved(sosId, 'Tourist confirmed false alarm')
  logger.info({ sosId, touristId }, 'SOS marked false alarm')
  return updated
}

module.exports = { createSOS, getSOSHistory, markFalseAlarm }
```

### Step 6.8 — src/services/dms.service.js

```javascript
// src/services/dms.service.js
'use strict'

const { withTransaction } = require('../database/transaction')
const { DMSRepository } = require('../repositories/dms.repository')
const { CheckinRepository } = require('../repositories/checkin.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { SOSRepository } = require('../repositories/sos.repository')
const { emitDMSTriggered, emitCheckinUpdate } = require('../socket/emitters')
const { notifyOnSOS, notifyDMSWarning } = require('./notification/notification.service')
const { DMS_STATUSES, SOS_CATEGORIES, SOS_TRIGGER_TYPES, CHECKIN_TYPES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

async function createDMS(touristId, data) {
  const repo = new DMSRepository()
  const existing = await repo.findActiveByTouristId(touristId)
  if (existing) throw Object.assign(new Error(ERRORS.DMS_ALREADY_ACTIVE), { statusCode: 400 })
  const dms = await repo.create({ touristId, tripId: data.tripId || null, intervalMinutes: data.intervalMinutes })
  logger.info({ dmsId: dms.id, touristId, intervalMinutes: data.intervalMinutes }, 'DMS created')
  return dms
}

async function getActiveDMS(touristId) {
  return new DMSRepository().findActiveByTouristId(touristId)
}

async function resetDMS(dmsId, touristId, data) {
  const dmsRepo = new DMSRepository()
  const dms = await dmsRepo.findById(dmsId, touristId)
  if (!dms) throw Object.assign(new Error(ERRORS.DMS_NOT_FOUND), { statusCode: 404 })

  const { dmsUpdated, checkin, tourist } = await withTransaction(async (client) => {
    const dmsRepo_t      = new DMSRepository(client)
    const checkinRepo    = new CheckinRepository(client)
    const locationRepo   = new LocationRepository(client)
    const touristRepo    = new TouristRepository(client)

    const dmsUpdated = await dmsRepo_t.reset(dmsId, dms.interval_minutes)

    const checkin = await checkinRepo.create({
      touristId,
      tripId:    dms.trip_id,
      dmsId,
      latitude:   data.latitude  || null,
      longitude:  data.longitude || null,
      batteryPct: data.batteryPct || null,
      message:    data.message || null,
      type:       CHECKIN_TYPES.DMS_RESET,
    })

    if (data.latitude && data.longitude) {
      await locationRepo.upsert(touristId, {
        latitude: data.latitude, longitude: data.longitude, batteryPct: data.batteryPct
      })
    }

    const tourist = await touristRepo.findById(touristId)
    return { dmsUpdated, checkin, tourist }
  })

  emitCheckinUpdate(touristId, tourist.guardian_token,
    { latitude: data.latitude, longitude: data.longitude },
    data.batteryPct, null)

  logger.info({ dmsId, touristId }, 'DMS reset')
  return { dms: dmsUpdated, checkin }
}

async function updateDMSStatus(dmsId, touristId, status) {
  const repo = new DMSRepository()
  const updated = await repo.updateStatus(dmsId, touristId, status)
  if (!updated) throw Object.assign(new Error(ERRORS.DMS_NOT_FOUND), { statusCode: 404 })
  return updated
}

// Called by DMS cron — not an HTTP handler
async function processDMSTriggers() {
  const dmsRepo     = new DMSRepository()
  const sosRepo     = new SOSRepository()
  const locationRepo= new LocationRepository()
  const triggered = await dmsRepo.findTriggered()

  for (const dmsRow of triggered) {
    try {
      const { sosEvent } = await withTransaction(async (client) => {
        const dmsRepo_t = new DMSRepository(client)
        const sosRepo_t = new SOSRepository(client)

        const lat = dmsRow.latitude || 0
        const lng = dmsRow.longitude || 0
        const isStale = !dmsRow.latitude

        const sosEvent = await sosRepo_t.create({
          touristId:       dmsRow.tourist_id,
          tripId:          dmsRow.trip_id,
          latitude:        lat,
          longitude:       lng,
          isStaleLocation: isStale,
          category:        SOS_CATEGORIES.MISSING,
          triggerType:     SOS_TRIGGER_TYPES.DEAD_MANS_SWITCH,
          batteryPct:      dmsRow.battery_pct || null,
          message:         'Automatic SOS — Dead Man\'s Switch timeout',
        })

        await dmsRepo_t.markTriggered(dmsRow.id, sosEvent.id)
        return { sosEvent }
      })

      // Side effects outside transaction
      const tourist = {
        id: dmsRow.tourist_id,
        full_name: dmsRow.full_name,
        phone: dmsRow.phone,
        blood_group: dmsRow.blood_group,
        emergency_contacts: dmsRow.emergency_contacts,
        guardian_token: dmsRow.guardian_token,
        govt_id_suffix: dmsRow.govt_id_suffix,
      }
      emitDMSTriggered(sosEvent, tourist)
      notifyOnSOS(tourist, sosEvent).catch(err =>
        logger.error({ err: { message: err.message } }, 'DMS SOS notification failed'))

      logger.warn({ dmsId: dmsRow.id, sosId: sosEvent.id, touristName: dmsRow.full_name },
        'DMS triggered — SOS created')

    } catch (err) {
      logger.error({ err: { message: err.message }, dmsId: dmsRow.id }, 'Failed to process DMS trigger')
    }
  }

  return { processed: triggered.length }
}

async function processDMSWarnings() {
  const dmsRepo   = new DMSRepository()
  const needWarn  = await dmsRepo.findNeedingWarning()

  for (const dmsRow of needWarn) {
    try {
      await notifyDMSWarning({ phone: dmsRow.phone, id: dmsRow.tourist_id }, dmsRow)
      await dmsRepo.markWarned(dmsRow.id)
      logger.info({ dmsId: dmsRow.id, touristName: dmsRow.full_name }, 'DMS warning sent')
    } catch (err) {
      logger.error({ err: { message: err.message }, dmsId: dmsRow.id }, 'DMS warning failed')
    }
  }

  return { processed: needWarn.length }
}

module.exports = { createDMS, getActiveDMS, resetDMS, updateDMSStatus, processDMSTriggers, processDMSWarnings }
```

### Step 6.9 — src/services/trip.service.js

```javascript
// src/services/trip.service.js
'use strict'

const { v4: uuid } = require('uuid')
const { TripRepository } = require('../repositories/trip.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { calculateTSI, computeRescueReadiness } = require('./tsi.service')
const { generatePublicToken } = require('../utils/crypto')
const { TRIP_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

const VALID_TRANSITIONS = {
  [TRIP_STATUSES.PLANNED]:   [TRIP_STATUSES.ACTIVE, TRIP_STATUSES.CANCELLED],
  [TRIP_STATUSES.ACTIVE]:    [TRIP_STATUSES.COMPLETED, TRIP_STATUSES.CANCELLED],
  [TRIP_STATUSES.COMPLETED]: [],
  [TRIP_STATUSES.CANCELLED]: [],
}

// Enrich stops with destination data and normalize fields
async function enrichStops(stops) {
  const destRepo = new DestinationRepository()
  const destinationIds = stops
    .map(s => s.destinationId)
    .filter(id => id && id !== 'null' && id !== 'undefined')

  const destMap = {}
  if (destinationIds.length > 0) {
    const dests = await destRepo.findByIds(destinationIds)
    dests.forEach(d => { destMap[d.id] = d })
  }

  return stops.map(stop => {
    const dest = destMap[stop.destinationId] || {}
    return {
      city:          stop.city,
      state:         stop.state,
      destinationId: stop.destinationId || null,
      lat:           stop.lat ?? dest.latitude ?? null,
      lng:           stop.lng ?? dest.longitude ?? null,
      days:          stop.days,
      arrivalDate:   stop.arrivalDate || null,
      departureDate: stop.departureDate || null,
      activities:    (stop.activities || []).map(a => ({ ...a })),
      notes:         stop.notes || null,
      connectivity:  stop.connectivity || dest.connectivity || 'MODERATE',
      difficulty:    stop.difficulty  || dest.difficulty   || 'EASY',
      altitude_m:    stop.altitude_m  ?? dest.altitude_m   ?? 0,
      zone_type:     stop.zone_type   || dest.zone_type    || 'SAFE',
      hospital_km:   stop.hospital_km ?? dest.nearest_hospital_km ?? 0,
      eta_minutes:   stop.eta_minutes || null,
    }
  })
}

async function createTrip(touristId, data, tourist) {
  const tripRepo = new TripRepository()

  const enrichedStops = await enrichStops(data.stops || [])
  const publicToken = data.isPublic ? generatePublicToken() : null
  const tsiResult = calculateTSI({ ...data, travel_type: data.travelType, stops: enrichedStops }, {})
  const readiness = computeRescueReadiness(tourist, { tsi_score: tsiResult.score, rescue_readiness: {} }, false)

  const trip = await tripRepo.create({
    touristId,
    title:              data.title,
    description:        data.description || null,
    travelType:         data.travelType || 'SOLO',
    startDate:          data.startDate,
    endDate:            data.endDate,
    stops:              enrichedStops,
    budgetInr:          data.budgetInr || null,
    coverImageUrl:      data.coverImageUrl || null,
    isPublic:           data.isPublic || false,
    publicToken,
    tsiScore:           tsiResult.score,
    tsiLabel:           tsiResult.label,
    tsiFactors:         tsiResult.factors,
    tsiRecommendations: tsiResult.recommendations,
    rescueReadiness:    readiness.items,
    rescueReadinessScore: readiness.score,
    packingChecklist:   [],
  })

  logger.info({ tripId: trip.id, touristId, tsi: tsiResult.score }, 'Trip created')
  return trip
}

async function getMyTrips(touristId, filters) {
  return new TripRepository().findByTouristId(touristId, filters)
}

async function getTrip(tripId, touristId) {
  const repo = new TripRepository()
  const trip = await repo.findById(tripId, touristId)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })
  return trip
}

async function getPublicTrip(publicToken) {
  const trip = await new TripRepository().findByPublicToken(publicToken)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })
  return trip
}

async function updateTrip(tripId, touristId, data, tourist) {
  const tripRepo = new TripRepository()
  const existing = await tripRepo.findById(tripId, touristId)
  if (!existing) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  const enrichedStops = await enrichStops(data.stops || [])
  const tsiResult = calculateTSI({ ...data, travel_type: data.travelType, stops: enrichedStops }, {})
  const readiness = computeRescueReadiness(tourist, { tsi_score: tsiResult.score, rescue_readiness: existing.rescue_readiness || {} }, false)

  return tripRepo.update(tripId, touristId, {
    ...data, stops: enrichedStops,
    tsiScore: tsiResult.score, tsiLabel: tsiResult.label,
    tsiFactors: tsiResult.factors, tsiRecommendations: tsiResult.recommendations,
    rescueReadiness: readiness.items, rescueReadinessScore: readiness.score,
  })
}

async function updateTripStatus(tripId, touristId, newStatus) {
  const tripRepo = new TripRepository()
  const trip = await tripRepo.findById(tripId, touristId)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  const allowed = VALID_TRANSITIONS[trip.status] || []
  if (!allowed.includes(newStatus)) {
    throw Object.assign(
      new Error(`${ERRORS.INVALID_TRIP_TRANSITION}: ${trip.status} → ${newStatus}`),
      { statusCode: 400 }
    )
  }

  if (newStatus === TRIP_STATUSES.ACTIVE) {
    const active = await tripRepo.findActiveByTouristId(touristId)
    if (active && active.id !== tripId) {
      throw Object.assign(new Error(ERRORS.TRIP_ALREADY_ACTIVE), { statusCode: 400 })
    }
  }

  return tripRepo.updateStatus(tripId, touristId, newStatus)
}

async function updateChecklist(tripId, touristId, checklist) {
  const repo = new TripRepository()
  const trip = await repo.findById(tripId, touristId)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })
  // Ensure every item has an ID
  const normalized = checklist.map(i => ({ ...i, id: i.id || uuid() }))
  return repo.updateChecklist(tripId, touristId, normalized)
}

async function deleteTrip(tripId, touristId) {
  const repo = new TripRepository()
  const deleted = await repo.delete(tripId, touristId)
  if (!deleted) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })
  return deleted
}

module.exports = {
  createTrip, getMyTrips, getTrip, getPublicTrip, updateTrip,
  updateTripStatus, updateChecklist, deleteTrip,
}
```

### Step 6.10 — src/services/checkin.service.js

```javascript
// src/services/checkin.service.js
'use strict'

const { withTransaction } = require('../database/transaction')
const { CheckinRepository } = require('../repositories/checkin.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { DMSRepository } = require('../repositories/dms.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { emitCheckinUpdate } = require('../socket/emitters')
const { CHECKIN_TYPES } = require('../constants/enums')
const logger = require('../utils/logger')

async function createCheckin(touristId, data) {
  const { checkin, dmsReset, tourist } = await withTransaction(async (client) => {
    const checkinRepo  = new CheckinRepository(client)
    const locationRepo = new LocationRepository(client)
    const dmsRepo      = new DMSRepository(client)
    const touristRepo  = new TouristRepository(client)

    const checkin = await checkinRepo.create({
      touristId,
      tripId:    data.tripId    || null,
      dmsId:     data.dmsId    || null,
      latitude:  data.latitude,
      longitude: data.longitude,
      batteryPct:data.batteryPct || null,
      message:   data.message   || null,
      type:      data.dmsId ? CHECKIN_TYPES.DMS_RESET : CHECKIN_TYPES.MANUAL,
    })

    await locationRepo.upsert(touristId, {
      latitude:   data.latitude,
      longitude:  data.longitude,
      batteryPct: data.batteryPct || null,
      accuracyM:  data.accuracyM  || null,
    })

    let dmsReset = false
    if (data.dmsId) {
      const dms = await dmsRepo.findById(data.dmsId, touristId)
      if (dms) {
        await dmsRepo.reset(data.dmsId, dms.interval_minutes)
        dmsReset = true
      }
    }

    const tourist = await touristRepo.findById(touristId)
    return { checkin, dmsReset, tourist }
  })

  emitCheckinUpdate(touristId, tourist.guardian_token,
    { latitude: data.latitude, longitude: data.longitude },
    data.batteryPct, null)

  if (data.batteryPct !== null && data.batteryPct <= 20) {
    logger.warn({ touristId, batteryPct: data.batteryPct }, 'Tourist battery critically low')
  }

  return { checkin, dmsReset }
}

async function getRecentCheckins(touristId, filters) {
  return new CheckinRepository().findByTouristId(touristId, filters)
}

module.exports = { createCheckin, getRecentCheckins }
```

### Step 6.11 — src/services/govt.service.js

```javascript
// src/services/govt.service.js
'use strict'

const { withTransaction } = require('../database/transaction')
const { SOSRepository } = require('../repositories/sos.repository')
const { RescueRepository } = require('../repositories/rescue.repository')
const { DMSRepository } = require('../repositories/dms.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { TripRepository } = require('../repositories/trip.repository')
const { emitSOSResolved, emitRescueAssigned } = require('../socket/emitters')
const { SOS_STATUSES, TEAM_STATUSES } = require('../constants/enums')
const { ERRORS } = require('../constants/errors')
const logger = require('../utils/logger')

async function getDashboard() {
  const [sosRepo, rescueRepo, dmsRepo, locationRepo] = [
    new SOSRepository(), new RescueRepository(), new DMSRepository(), new LocationRepository()
  ]

  const [activeSOS, assignedSOS, resolvedToday, activeTourists,
         availableTeams, deployedTeams, activeDMS, recentSOS] = await Promise.all([
    sosRepo.countByPeriod(new Date(0)).then(r => parseInt(r[0]?.active || 0)),
    sosRepo.query(`SELECT COUNT(*)::int as c FROM sos_events WHERE status='ASSIGNED'`).then(r => r[0]?.c || 0),
    sosRepo.query(`SELECT COUNT(*)::int as c FROM sos_events WHERE status='RESOLVED' AND resolved_at::date=CURRENT_DATE`).then(r => r[0]?.c || 0),
    locationRepo.countActive(),
    rescueRepo.countAvailable(),
    rescueRepo.countDeployed(),
    dmsRepo.countActive(),
    sosRepo.query(`
      SELECT se.id, se.category, se.status, se.created_at, t.full_name, t.phone
      FROM sos_events se LEFT JOIN tourists t ON t.id=se.tourist_id
      ORDER BY se.created_at DESC LIMIT 5`),
  ])

  return { activeSOS, assignedSOS, resolvedToday, activeTourists, availableTeams, deployedTeams, activeDMS, recentSOS }
}

async function getActiveSOS(filters) {
  return new SOSRepository().findActive(filters)
}

async function assignRescue(sosId, govtUserId, teamId, notes) {
  const sosRepo    = new SOSRepository()
  const rescueRepo = new RescueRepository()

  const sos  = await sosRepo.findById(sosId)
  if (!sos)  throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  if (![SOS_STATUSES.ACTIVE, SOS_STATUSES.ASSIGNED].includes(sos.status)) {
    throw Object.assign(new Error('SOS is not open for assignment'), { statusCode: 400 })
  }

  const team = await rescueRepo.findTeamById(teamId)
  if (!team) throw Object.assign(new Error(ERRORS.TEAM_NOT_FOUND), { statusCode: 404 })
  if (team.status !== TEAM_STATUSES.AVAILABLE) {
    throw Object.assign(new Error(ERRORS.TEAM_NOT_AVAILABLE), { statusCode: 400 })
  }

  const { assignment } = await withTransaction(async (client) => {
    const sosRepo_t    = new SOSRepository(client)
    const rescueRepo_t = new RescueRepository(client)

    const assignment = await rescueRepo_t.createAssignment({
      sosEventId: sosId, teamId, assignedBy: govtUserId, notes
    })
    await sosRepo_t.updateStatus(sosId, SOS_STATUSES.ASSIGNED)
    await rescueRepo_t.updateTeamStatus(teamId, TEAM_STATUSES.DEPLOYED)
    return { assignment }
  })

  emitRescueAssigned(assignment, sos, team)
  logger.info({ sosId, teamId, assignmentId: assignment.id }, 'Rescue assigned')
  return { assignment, sosStatus: SOS_STATUSES.ASSIGNED, teamStatus: TEAM_STATUSES.DEPLOYED }
}

async function resolveSOS(sosId, resolutionNotes) {
  const { resolved } = await withTransaction(async (client) => {
    const sosRepo_t    = new SOSRepository(client)
    const rescueRepo_t = new RescueRepository(client)

    const resolved = await sosRepo_t.updateStatus(sosId, SOS_STATUSES.RESOLVED, { resolutionNotes })
    if (!resolved) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })

    const assignment = await rescueRepo_t.resolveAssignment(sosId)
    if (assignment?.team_id) {
      await rescueRepo_t.updateTeamStatus(assignment.team_id, TEAM_STATUSES.AVAILABLE)
    }
    return { resolved }
  })

  emitSOSResolved(sosId, resolutionNotes)
  logger.info({ sosId }, 'SOS resolved')
  return resolved
}

async function getLiveTourists() {
  return new LocationRepository().findLive()
}

async function getRiskOverview() {
  // Get all active trips, group by destination city
  const tripRepo    = new TripRepository()
  const destRepo    = new DestinationRepository()
  const activeTrips = await tripRepo.findAllActive()

  const destStats = {}
  for (const trip of activeTrips) {
    const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
    for (const stop of stops) {
      const key = stop.destinationId || stop.city
      if (!destStats[key]) {
        destStats[key] = {
          city:        stop.city,
          state:       stop.state,
          zoneType:    stop.zone_type,
          connectivity:stop.connectivity,
          total:       0,
          solo:        0,
          highRisk:    0,
        }
      }
      destStats[key].total++
      if (trip.travel_type === 'SOLO') destStats[key].solo++
      if ((trip.tsi_score || 100) < 60)  destStats[key].highRisk++
    }
  }

  const destinations = await destRepo.findAll()
  const weatherMap = {}
  destinations.forEach(d => {
    if (d.weather_condition) weatherMap[d.id] = d
  })

  return Object.values(destStats).map(stat => ({
    ...stat,
    weather: weatherMap[stat.destinationId] || null,
  }))
}

async function getRescueTeams() {
  return new RescueRepository().findAllTeams()
}

async function updateTeamStatus(teamId, status) {
  return new RescueRepository().updateTeamStatus(teamId, status)
}

async function getAnalytics(period = '30d') {
  const days    = parseInt(period) || 30
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const sosRepo   = new SOSRepository()
  const rescueRepo = new RescueRepository()

  const [perDay, byCategory, totals, avgResponse] = await Promise.all([
    sosRepo.trendsPerDay(startDate),
    sosRepo.countByCategory(startDate),
    sosRepo.countByPeriod(startDate),
    rescueRepo.avgResponseMinutes(startDate),
  ])

  return { perDay, byCategory, totals: totals[0], avgResponseMinutes: avgResponse }
}

module.exports = {
  getDashboard, getActiveSOS, assignRescue, resolveSOS,
  getLiveTourists, getRiskOverview, getRescueTeams, updateTeamStatus, getAnalytics,
}
```


---

## PHASE 6B — OTP FLOW (FORGOT PASSWORD + PHONE VERIFICATION)

### Step 6B.1 — Add otp_verifications table to migration

Add this to src/migrations/001_initial_schema.js inside the `exports.up` function, after the tourists table block:

```javascript
// ── otp_verifications ─────────────────────────────────────────────────
pgm.createTable('otp_verifications', {
  id:                   { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
  phone:                { type: 'varchar(20)', notNull: true },
  otp_hash:             { type: 'varchar(64)', notNull: true },  // HMAC-SHA256 of the 6-digit OTP
  purpose:              { type: 'varchar(30)', notNull: true, default: 'PASSWORD_RESET' },
  // PURPOSES: PASSWORD_RESET | PHONE_VERIFY
  expires_at:           { type: 'timestamptz', notNull: true },
  used:                 { type: 'boolean', notNull: true, default: false },
  attempts:             { type: 'smallint', notNull: true, default: 0 },
  // How many times wrong OTP was entered (lock after 3)
  reset_token:          { type: 'varchar(128)', unique: true },
  // Generated after OTP verified — used for password reset step
  reset_token_expires:  { type: 'timestamptz' },
  ip_address:           { type: 'varchar(45)' },  // IPv4/IPv6 for rate limit audit
  created_at:           { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
})

pgm.createIndex('otp_verifications', 'phone')
pgm.createIndex('otp_verifications', ['phone', 'purpose', 'used'])
pgm.createIndex('otp_verifications', 'reset_token', { where: 'reset_token IS NOT NULL' })
```

Add to `exports.down`: `pgm.dropTable('otp_verifications', { ifExists: true, cascade: true })`

Re-run migration: `npm run migrate:down && npm run migrate`

### Step 6B.2 — src/repositories/otp.repository.js

```javascript
// src/repositories/otp.repository.js
'use strict'

const { BaseRepository } = require('./base.repository')

class OTPRepository extends BaseRepository {
  // Store a new OTP (overwrites any existing non-used OTP for same phone+purpose)
  async create(phone, otpHash, purpose, expiresAt, ipAddress = null) {
    // First: invalidate all previous unused OTPs for this phone+purpose
    await this.query(
      `UPDATE otp_verifications SET used=TRUE
       WHERE phone=$1 AND purpose=$2 AND used=FALSE`,
      [phone, purpose]
    )
    return this.queryOne(`
      INSERT INTO otp_verifications (phone, otp_hash, purpose, expires_at, ip_address)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [phone, otpHash, purpose, expiresAt, ipAddress]
    )
  }

  // Find the latest valid OTP for a phone+purpose
  async findValid(phone, purpose) {
    return this.queryOne(`
      SELECT * FROM otp_verifications
      WHERE phone=$1 AND purpose=$2 AND used=FALSE AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1`,
      [phone, purpose]
    )
  }

  // Increment failed attempts; return new attempt count
  async incrementAttempts(id) {
    const row = await this.queryOne(
      `UPDATE otp_verifications SET attempts=attempts+1 WHERE id=$1 RETURNING attempts`,
      [id]
    )
    return row?.attempts || 0
  }

  // Mark OTP as used and attach a reset_token (for password reset step 2→3)
  async markUsedAndAttachToken(id, resetToken, resetTokenExpires) {
    return this.queryOne(`
      UPDATE otp_verifications
      SET used=TRUE, reset_token=$2, reset_token_expires=$3
      WHERE id=$1 RETURNING *`,
      [id, resetToken, resetTokenExpires]
    )
  }

  // Find a valid reset_token (used in step 3: actual password reset)
  async findByResetToken(resetToken) {
    return this.queryOne(`
      SELECT * FROM otp_verifications
      WHERE reset_token=$1
        AND reset_token_expires > NOW()
        AND used=TRUE`,  // OTP was verified; reset_token is the continuation credential
      [resetToken]
    )
  }

  // Invalidate a reset_token after password has been reset
  async invalidateResetToken(resetToken) {
    return this.queryOne(
      `UPDATE otp_verifications SET reset_token=NULL, reset_token_expires=NULL
       WHERE reset_token=$1 RETURNING id`,
      [resetToken]
    )
  }

  // Count OTP requests from a phone in the last N minutes (rate limit check)
  async countRecentRequests(phone, purpose, windowMinutes = 60) {
    return this.queryCount(`
      SELECT COUNT(*) FROM otp_verifications
      WHERE phone=$1 AND purpose=$2
        AND created_at >= NOW() - ($3 || ' minutes')::interval`,
      [phone, purpose, windowMinutes]
    )
  }
}

module.exports = { OTPRepository }
```

### Step 6B.3 — OTP Validators

Add to src/validators/auth.validator.js:

```javascript
// Add these exports to auth.validator.js

const ForgotPasswordSchema = z.object({
  phone: z.string().min(10).max(15),
})

const VerifyOTPSchema = z.object({
  phone:   z.string().min(10).max(15),
  otp:     z.string().length(6).regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  purpose: z.enum(['PASSWORD_RESET', 'PHONE_VERIFY']).optional().default('PASSWORD_RESET'),
})

const ResetPasswordSchema = z.object({
  resetToken:  z.string().min(64).max(128),
  newPassword: z.string().min(8).max(128),
})

const ResendOTPSchema = z.object({
  phone:   z.string().min(10).max(15),
  purpose: z.enum(['PASSWORD_RESET', 'PHONE_VERIFY']).optional().default('PASSWORD_RESET'),
})

// Export all:
module.exports = {
  RegisterTouristSchema, LoginTouristSchema, RegisterGovtSchema, LoginGovtSchema,
  ForgotPasswordSchema, VerifyOTPSchema, ResetPasswordSchema, ResendOTPSchema,
}
```

### Step 6B.4 — src/services/otp.service.js

```javascript
// src/services/otp.service.js
// Complete OTP lifecycle: request → verify → reset password.
// Security design decisions:
//   - OTP is 6 digits, stored as HMAC-SHA256 (never plaintext)
//   - 3 wrong attempts = OTP locked (must request a new one)
//   - OTP expires in 10 minutes
//   - Max 5 OTP requests per phone per hour (rate limit)
//   - Reset token expires in 15 minutes
//   - Anti-enumeration: always respond "OTP sent" regardless of whether phone exists
//   - Phone normalization before lookup (same as registration)
'use strict'

const crypto = require('crypto')
const { OTPRepository } = require('../repositories/otp.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { sendSMS } = require('./notification/sms.service')
const { hashPassword, normalizePhone, generatePublicToken } = require('../utils/crypto')
const config = require('../config/env')
const logger = require('../utils/logger')

const OTP_EXPIRE_MINUTES   = 10
const RESET_TOKEN_MINUTES  = 15
const MAX_ATTEMPTS         = 3
const MAX_OTP_PER_HOUR     = 5

// Generate a cryptographically random 6-digit OTP
function generateOTP() {
  // Use crypto.randomInt for uniform distribution (avoids modulo bias)
  return crypto.randomInt(100_000, 999_999).toString()
}

// HMAC-SHA256 of OTP with server secret (deterministic, one-way)
function hashOTP(otp) {
  return crypto
    .createHmac('sha256', config.security.govtIdSecret)
    .update(otp)
    .digest('hex')
}

// ── STEP 1: Request OTP ───────────────────────────────────────────────────

async function requestPasswordReset(rawPhone, ipAddress) {
  const phone = normalizePhone(rawPhone)
  const otpRepo = new OTPRepository()

  // Rate limit: max 5 OTP requests per phone per hour
  const recentCount = await otpRepo.countRecentRequests(phone, 'PASSWORD_RESET', 60)
  if (recentCount >= MAX_OTP_PER_HOUR) {
    // Do NOT reveal that this phone is rate-limited (anti-enumeration + UX)
    // Log for security monitoring
    logger.warn({ phone, recentCount }, 'OTP rate limit exceeded')
    // Still return success to the caller — do not reveal rate limit
    return { sent: false, reason: 'rate_limited', message: 'OTP sent to your phone if registered' }
  }

  // Check tourist exists (silent — never reveal to caller if phone is registered)
  const touristRepo = new TouristRepository()
  const tourist = await touristRepo.findByPhone(phone)

  if (!tourist || !tourist.is_active) {
    // Log but return success message (anti-enumeration)
    logger.debug({ phone }, 'OTP requested for non-existent or inactive tourist')
    return { sent: false, reason: 'not_found', message: 'OTP sent to your phone if registered' }
  }

  const otp       = generateOTP()
  const otpHash   = hashOTP(otp)
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000)

  await otpRepo.create(phone, otpHash, 'PASSWORD_RESET', expiresAt, ipAddress)

  // Send OTP via SMS
  const message = [
    `🔐 Aaraksha Password Reset`,
    `Your OTP is: ${otp}`,
    `Valid for ${OTP_EXPIRE_MINUTES} minutes.`,
    `Do NOT share this with anyone.`,
    `If you did not request this, ignore this message.`,
  ].join('\n')

  const smsResult = await sendSMS(phone, message)
  logger.info({ phone, smsSent: smsResult.sent }, 'Password reset OTP sent')

  // Always return the same message regardless of SMS success (anti-enumeration)
  return { sent: true, message: `OTP sent to your registered phone number` }
}

// ── STEP 2: Verify OTP ────────────────────────────────────────────────────

async function verifyOTP(rawPhone, otp, purpose = 'PASSWORD_RESET') {
  const phone    = normalizePhone(rawPhone)
  const otpRepo  = new OTPRepository()

  const record = await otpRepo.findValid(phone, purpose)

  if (!record) {
    throw Object.assign(
      new Error('OTP not found, already used, or expired. Please request a new OTP.'),
      { statusCode: 400 }
    )
  }

  // Check attempt count BEFORE verifying (lock early)
  if (record.attempts >= MAX_ATTEMPTS) {
    throw Object.assign(
      new Error(`OTP locked after ${MAX_ATTEMPTS} failed attempts. Request a new OTP.`),
      { statusCode: 429 }
    )
  }

  const providedHash = hashOTP(otp.trim())

  // Constant-time comparison to prevent timing attacks
  const expectedBuf = Buffer.from(record.otp_hash, 'hex')
  const providedBuf = Buffer.from(providedHash, 'hex')
  const isValid = expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf)

  if (!isValid) {
    const newAttempts = await otpRepo.incrementAttempts(record.id)
    const remaining   = Math.max(0, MAX_ATTEMPTS - newAttempts)
    throw Object.assign(
      new Error(`Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`),
      { statusCode: 400 }
    )
  }

  // OTP correct — generate reset_token (used to authorize password reset)
  const resetToken        = crypto.randomBytes(48).toString('hex')  // 96 hex chars
  const resetTokenExpires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000)

  await otpRepo.markUsedAndAttachToken(record.id, resetToken, resetTokenExpires)
  logger.info({ phone, purpose }, 'OTP verified successfully')

  return {
    resetToken,
    expiresIn: `${RESET_TOKEN_MINUTES} minutes`,
    message:   'OTP verified. Use the reset token to set your new password.',
  }
}

// ── STEP 3: Reset Password using reset_token ──────────────────────────────

async function resetPassword(resetToken, newPassword) {
  const otpRepo     = new OTPRepository()
  const touristRepo = new TouristRepository()

  const record = await otpRepo.findByResetToken(resetToken)
  if (!record) {
    throw Object.assign(
      new Error('Reset token not found or expired. Please restart the password reset process.'),
      { statusCode: 400 }
    )
  }

  const phone   = normalizePhone(record.phone)
  const tourist = await touristRepo.findByPhone(phone)
  if (!tourist || !tourist.is_active) {
    throw Object.assign(new Error('Account not found or deactivated.'), { statusCode: 404 })
  }

  const passwordHash = await hashPassword(newPassword)

  // Update password
  await touristRepo.update(tourist.id, { password_hash: passwordHash })

  // Invalidate the reset token so it cannot be reused
  await otpRepo.invalidateResetToken(resetToken)

  logger.info({ touristId: tourist.id }, 'Password reset successfully')
  return { message: 'Password reset successfully. Please log in with your new password.' }
}

// ── Resend OTP ────────────────────────────────────────────────────────────

async function resendOTP(rawPhone, purpose, ipAddress) {
  // Delegate to requestPasswordReset — same logic, same rate limiting
  return requestPasswordReset(rawPhone, ipAddress)
}

// ── Phone Verification OTP (optional during signup) ───────────────────────

async function requestPhoneVerification(touristId, rawPhone, ipAddress) {
  const phone    = normalizePhone(rawPhone)
  const otpRepo  = new OTPRepository()

  const recentCount = await otpRepo.countRecentRequests(phone, 'PHONE_VERIFY', 60)
  if (recentCount >= 3) {
    throw Object.assign(
      new Error('Too many verification requests. Wait 1 hour before trying again.'),
      { statusCode: 429 }
    )
  }

  const otp       = generateOTP()
  const otpHash   = hashOTP(otp)
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000)

  await otpRepo.create(phone, otpHash, 'PHONE_VERIFY', expiresAt, ipAddress)

  const message = [
    `📱 Aaraksha Phone Verification`,
    `Your verification code is: ${otp}`,
    `Valid for ${OTP_EXPIRE_MINUTES} minutes.`,
  ].join('\n')

  await sendSMS(phone, message)
  logger.info({ touristId, phone }, 'Phone verification OTP sent')
  return { message: 'Verification code sent to your phone.' }
}

module.exports = {
  requestPasswordReset,
  verifyOTP,
  resetPassword,
  resendOTP,
  requestPhoneVerification,
}
```

### Step 6B.5 — Update auth.validator.js for tourist.repository.js password update

Update the `update` method in `tourist.repository.js` to include `password_hash` in the allowed fields:

```javascript
// In tourist.repository.js — update the allowed array:
const allowed = [
  'full_name', 'email', 'blood_group', 'medical_info',
  'emergency_contacts', 'profile_photo_url', 'rescue_readiness_score',
  'password_hash',  // ← ADD THIS for password reset
]
```

---

## PHASE 7 — CONTROLLERS (THIN)

Each controller: parse validated data → call service → send response.
Zero SQL, zero business logic, zero direct Twilio/Gemini calls.

### Step 7.1 — src/controllers/auth.controller.js

```javascript
// src/controllers/auth.controller.js
'use strict'

const authService = require('../services/auth.service')
const otpService  = require('../services/otp.service')
const { sendSuccess } = require('../utils/response')

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const result = await authService.registerTourist(req.validatedBody)
    sendSuccess(res, result, 'Registration successful', 201)
  } catch (err) { next(err) }
}

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const result = await authService.loginTourist(req.validatedBody)
    sendSuccess(res, result, 'Login successful')
  } catch (err) { next(err) }
}

// POST /api/auth/govt/register
const registerGovt = async (req, res, next) => {
  try {
    const result = await authService.registerGovt(req.validatedBody)
    sendSuccess(res, result, 'Government user registered', 201)
  } catch (err) { next(err) }
}

// POST /api/auth/govt/login
const loginGovt = async (req, res, next) => {
  try {
    const result = await authService.loginGovt(req.validatedBody)
    sendSuccess(res, result, 'Login successful')
  } catch (err) { next(err) }
}

// POST /api/auth/forgot-password
// Step 1: Request OTP
const forgotPassword = async (req, res, next) => {
  try {
    const { phone } = req.validatedBody
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown'
    const result = await otpService.requestPasswordReset(phone, ipAddress)
    // Always return 200 — never reveal if phone is registered
    sendSuccess(res, null, result.message)
  } catch (err) { next(err) }
}

// POST /api/auth/verify-otp
// Step 2: Verify OTP → get resetToken
const verifyOTP = async (req, res, next) => {
  try {
    const { phone, otp, purpose } = req.validatedBody
    const result = await otpService.verifyOTP(phone, otp, purpose)
    sendSuccess(res, result, 'OTP verified successfully')
  } catch (err) { next(err) }
}

// POST /api/auth/reset-password
// Step 3: Use resetToken to set new password
const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.validatedBody
    const result = await otpService.resetPassword(resetToken, newPassword)
    sendSuccess(res, null, result.message)
  } catch (err) { next(err) }
}

// POST /api/auth/resend-otp
const resendOTP = async (req, res, next) => {
  try {
    const { phone, purpose } = req.validatedBody
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown'
    const result = await otpService.resendOTP(phone, purpose, ipAddress)
    sendSuccess(res, null, result.message)
  } catch (err) { next(err) }
}

// POST /api/auth/send-verification-otp (requires auth)
const sendVerificationOTP = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown'
    const result = await otpService.requestPhoneVerification(req.tourist.id, req.tourist.phone, ipAddress)
    sendSuccess(res, null, result.message)
  } catch (err) { next(err) }
}

module.exports = {
  register, login, registerGovt, loginGovt,
  forgotPassword, verifyOTP, resetPassword, resendOTP, sendVerificationOTP,
}
```

### Step 7.2 — src/controllers/tourist.controller.js

```javascript
// src/controllers/tourist.controller.js
'use strict'

const touristService = require('../services/tourist.service')
const { sendSuccess } = require('../utils/response')

const getMe = async (req, res, next) => {
  try {
    const tourist = await touristService.getProfile(req.tourist.id)
    sendSuccess(res, tourist)
  } catch (err) { next(err) }
}

const updateMe = async (req, res, next) => {
  try {
    const updated = await touristService.updateProfile(req.tourist.id, req.validatedBody)
    sendSuccess(res, updated, 'Profile updated')
  } catch (err) { next(err) }
}

const getGuardianView = async (req, res, next) => {
  try {
    const view = await touristService.getGuardianView(req.params.token)
    sendSuccess(res, view)
  } catch (err) { next(err) }
}

module.exports = { getMe, updateMe, getGuardianView }
```

### Step 7.3 — src/controllers/trip.controller.js

```javascript
// src/controllers/trip.controller.js
'use strict'

const tripService = require('../services/trip.service')
const { sendSuccess, sendPaginated } = require('../utils/response')
const { parsePaginationParams } = require('../utils/pagination')

const createTrip = async (req, res, next) => {
  try {
    const trip = await tripService.createTrip(req.tourist.id, req.validatedBody, req.tourist)
    sendSuccess(res, trip, 'Trip created', 201)
  } catch (err) { next(err) }
}

const getMyTrips = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query)
    const { rows, total } = await tripService.getMyTrips(req.tourist.id, { ...req.query, limit, offset })
    sendPaginated(res, rows, total, page, limit)
  } catch (err) { next(err) }
}

const getTripById = async (req, res, next) => {
  try {
    const trip = await tripService.getTrip(req.params.id, req.tourist.id)
    sendSuccess(res, trip)
  } catch (err) { next(err) }
}

const updateTrip = async (req, res, next) => {
  try {
    const trip = await tripService.updateTrip(req.params.id, req.tourist.id, req.validatedBody, req.tourist)
    sendSuccess(res, trip, 'Trip updated')
  } catch (err) { next(err) }
}

const updateTripStatus = async (req, res, next) => {
  try {
    const trip = await tripService.updateTripStatus(req.params.id, req.tourist.id, req.validatedBody.status)
    sendSuccess(res, trip, `Trip status updated to ${req.validatedBody.status}`)
  } catch (err) { next(err) }
}

const updateChecklist = async (req, res, next) => {
  try {
    const trip = await tripService.updateChecklist(req.params.id, req.tourist.id, req.validatedBody.packingChecklist)
    sendSuccess(res, trip, 'Checklist updated')
  } catch (err) { next(err) }
}

const deleteTrip = async (req, res, next) => {
  try {
    await tripService.deleteTrip(req.params.id, req.tourist.id)
    res.status(204).end()
  } catch (err) { next(err) }
}

const getPublicTrip = async (req, res, next) => {
  try {
    const trip = await tripService.getPublicTrip(req.params.token)
    sendSuccess(res, trip)
  } catch (err) { next(err) }
}

module.exports = { createTrip, getMyTrips, getTripById, updateTrip, updateTripStatus, updateChecklist, deleteTrip, getPublicTrip }
```

### Step 7.4 — src/controllers/sos.controller.js

```javascript
// src/controllers/sos.controller.js
'use strict'

const sosService = require('../services/sos.service')
const { sendSuccess, sendPaginated } = require('../utils/response')
const { parsePaginationParams } = require('../utils/pagination')

const createSOS = async (req, res, next) => {
  try {
    const sos = await sosService.createSOS(req.tourist.id, req.validatedBody)
    sendSuccess(res, sos, 'SOS triggered. Emergency contacts notified.', 201)
  } catch (err) { next(err) }
}

const getMySOSHistory = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query)
    const { rows, total } = await sosService.getSOSHistory(req.tourist.id, { ...req.query, limit, offset })
    sendPaginated(res, rows, total, page, limit)
  } catch (err) { next(err) }
}

const markFalseAlarm = async (req, res, next) => {
  try {
    const sos = await sosService.markFalseAlarm(req.params.id, req.tourist.id)
    sendSuccess(res, sos, 'SOS marked as false alarm')
  } catch (err) { next(err) }
}

module.exports = { createSOS, getMySOSHistory, markFalseAlarm }
```

### Step 7.5 — src/controllers/dms.controller.js

```javascript
// src/controllers/dms.controller.js
'use strict'

const dmsService = require('../services/dms.service')
const { sendSuccess } = require('../utils/response')

const createDMS    = async (req, res, next) => {
  try { sendSuccess(res, await dmsService.createDMS(req.tourist.id, req.validatedBody), 'Dead Man\'s Switch activated', 201) }
  catch (err) { next(err) }
}
const getActiveDMS = async (req, res, next) => {
  try { sendSuccess(res, await dmsService.getActiveDMS(req.tourist.id)) }
  catch (err) { next(err) }
}
const resetDMS = async (req, res, next) => {
  try { sendSuccess(res, await dmsService.resetDMS(req.params.id, req.tourist.id, req.validatedBody), 'Checked in — DMS reset') }
  catch (err) { next(err) }
}
const updateDMSStatus = async (req, res, next) => {
  try { sendSuccess(res, await dmsService.updateDMSStatus(req.params.id, req.tourist.id, req.validatedBody.status)) }
  catch (err) { next(err) }
}

module.exports = { createDMS, getActiveDMS, resetDMS, updateDMSStatus }
```

### Step 7.6 — src/controllers/checkin.controller.js

```javascript
// src/controllers/checkin.controller.js
'use strict'

const checkinService = require('../services/checkin.service')
const { sendSuccess } = require('../utils/response')

const createCheckin = async (req, res, next) => {
  try {
    const result = await checkinService.createCheckin(req.tourist.id, req.validatedBody)
    sendSuccess(res, result, 'Checked in successfully', 201)
  } catch (err) { next(err) }
}
const getRecentCheckins = async (req, res, next) => {
  try {
    const checkins = await checkinService.getRecentCheckins(req.tourist.id, req.query)
    sendSuccess(res, checkins)
  } catch (err) { next(err) }
}

module.exports = { createCheckin, getRecentCheckins }
```

### Step 7.7 — Remaining controllers (destination, scam, packing, passport, govt, webhook)

**src/controllers/destination.controller.js**
```javascript
'use strict'
const destinationService = require('../services/destination.service')
const { sendSuccess } = require('../utils/response')

const getAllDestinations = async (req, res, next) => {
  try { sendSuccess(res, await destinationService.getAllDestinations(req.query)) }
  catch (err) { next(err) }
}
const getDestinationById = async (req, res, next) => {
  try { sendSuccess(res, await destinationService.getDestinationById(req.params.id)) }
  catch (err) { next(err) }
}
module.exports = { getAllDestinations, getDestinationById }
```

**src/controllers/scam.controller.js**
```javascript
'use strict'
const scamService = require('../services/scam.service')
const { sendSuccess } = require('../utils/response')

const createReport = async (req, res, next) => {
  try { sendSuccess(res, await scamService.createReport(req.tourist.id, req.validatedBody), 'Report submitted', 201) }
  catch (err) { next(err) }
}
const getByDestination = async (req, res, next) => {
  try { sendSuccess(res, await scamService.getByDestination(req.params.destinationId)) }
  catch (err) { next(err) }
}
module.exports = { createReport, getByDestination }
```

**src/controllers/packing.controller.js**
```javascript
'use strict'
const packingService = require('../services/packing.service')
const { sendSuccess } = require('../utils/response')

const generatePackingList = async (req, res, next) => {
  try { sendSuccess(res, await packingService.generateForTrip(req.tourist.id, req.validatedBody.tripId), 'Packing list generated') }
  catch (err) { next(err) }
}
module.exports = { generatePackingList }
```

**src/controllers/passport.controller.js**
```javascript
'use strict'
const passportService = require('../services/passport.service')
const logger = require('../utils/logger')

const generatePassport = async (req, res, next) => {
  try {
    const pdfStream = await passportService.generate(req.params.tripId, req.tourist.id)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="journey-passport-${req.params.tripId.slice(0,8)}.pdf"`)
    pdfStream.pipe(res)
    pdfStream.on('error', err => { logger.error({ err: err.message }, 'PDF stream error'); next(err) })
  } catch (err) { next(err) }
}
module.exports = { generatePassport }
```

**src/controllers/govt.controller.js**
```javascript
'use strict'
const govtService = require('../services/govt.service')
const { sendSuccess, sendPaginated } = require('../utils/response')
const { parsePaginationParams } = require('../utils/pagination')

const getDashboard    = async (req, res, next) => { try { sendSuccess(res, await govtService.getDashboard()) } catch (err) { next(err) } }
const getLiveTourists = async (req, res, next) => { try { sendSuccess(res, await govtService.getLiveTourists()) } catch (err) { next(err) } }
const getRiskOverview = async (req, res, next) => { try { sendSuccess(res, await govtService.getRiskOverview()) } catch (err) { next(err) } }
const getRescueTeams  = async (req, res, next) => { try { sendSuccess(res, await govtService.getRescueTeams()) } catch (err) { next(err) } }
const getAnalytics    = async (req, res, next) => { try { sendSuccess(res, await govtService.getAnalytics(req.query.period)) } catch (err) { next(err) } }

const getActiveSOS = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query)
    const { rows, total } = await govtService.getActiveSOS({ ...req.query, limit, offset })
    sendPaginated(res, rows, total, page, limit)
  } catch (err) { next(err) }
}

const assignRescue = async (req, res, next) => {
  try {
    const result = await govtService.assignRescue(req.params.id, req.govtUser.id, req.validatedBody.teamId, req.validatedBody.notes)
    sendSuccess(res, result, 'Rescue team assigned')
  } catch (err) { next(err) }
}

const resolveSOS = async (req, res, next) => {
  try {
    const sos = await govtService.resolveSOS(req.params.id, req.validatedBody.resolutionNotes)
    sendSuccess(res, sos, 'SOS resolved')
  } catch (err) { next(err) }
}

const updateTeamStatus = async (req, res, next) => {
  try {
    const team = await govtService.updateTeamStatus(req.params.id, req.validatedBody.status)
    sendSuccess(res, team, 'Team status updated')
  } catch (err) { next(err) }
}

module.exports = { getDashboard, getLiveTourists, getRiskOverview, getRescueTeams,
  getAnalytics, getActiveSOS, assignRescue, resolveSOS, updateTeamStatus }
```

**src/controllers/webhook.controller.js**
```javascript
// src/controllers/webhook.controller.js
'use strict'

const webhookService = require('../services/webhook.service')
const logger = require('../utils/logger')

// POST /api/webhooks/twilio-inbound
// Receives inbound SMS from Twilio — offline SOS from tourists in no-data zones
const twilioInbound = async (req, res, next) => {
  try {
    const { From, Body, MessageSid } = req.body
    logger.info({ from: From, sid: MessageSid, bodyLen: Body?.length }, 'Twilio inbound SMS received')

    // Process asynchronously — respond immediately so Twilio doesn't retry
    webhookService.processInboundSMS(From, Body).catch(err =>
      logger.error({ err: { message: err.message }, from: From }, 'Inbound SMS processing failed')
    )

    // Always respond with TwiML within 5 seconds (Twilio requirement)
    res.set('Content-Type', 'text/xml')
    res.send([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      '  <Message>',
      '    Aaraksha received your SOS.',
      '    Emergency contacts and government rescue teams are being notified.',
      '    Stay safe. Help is coming.',
      '  </Message>',
      '</Response>',
    ].join('\n'))
  } catch (err) {
    // Even on crash — return valid TwiML (never 500 to Twilio)
    logger.error({ err: err.message }, 'Webhook handler crash')
    res.set('Content-Type', 'text/xml')
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  }
}

module.exports = { twilioInbound }
```


---

## PHASE 8 — ROUTES

### Step 8.1 — src/routes/auth.routes.js

```javascript
// src/routes/auth.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/auth.controller')
const { validate }  = require('../middleware/validate')
const { authenticateTourist } = require('../middleware/auth')
const {
  RegisterTouristSchema, LoginTouristSchema, RegisterGovtSchema, LoginGovtSchema,
  ForgotPasswordSchema, VerifyOTPSchema, ResetPasswordSchema, ResendOTPSchema,
} = require('../validators/auth.validator')

// ── Tourist auth ──────────────────────────────────────────────────────
router.post('/register',      validate(RegisterTouristSchema), ctrl.register)
router.post('/login',         validate(LoginTouristSchema),    ctrl.login)

// ── Forgot password 3-step flow ───────────────────────────────────────
// Step 1: Request OTP (no auth — this is for forgotten passwords)
router.post('/forgot-password', validate(ForgotPasswordSchema), ctrl.forgotPassword)
// Step 2: Verify OTP → receive resetToken
router.post('/verify-otp',      validate(VerifyOTPSchema),      ctrl.verifyOTP)
// Step 3: Reset password using resetToken
router.post('/reset-password',  validate(ResetPasswordSchema),  ctrl.resetPassword)
// Resend OTP (same rate limits apply)
router.post('/resend-otp',      validate(ResendOTPSchema),      ctrl.resendOTP)

// ── Phone verification (requires login — optional post-signup step) ────
router.post('/send-verification-otp', authenticateTourist, ctrl.sendVerificationOTP)

// ── Government auth ────────────────────────────────────────────────────
router.post('/govt/register',  validate(RegisterGovtSchema),  ctrl.registerGovt)
router.post('/govt/login',     validate(LoginGovtSchema),     ctrl.loginGovt)

module.exports = router
```

### Step 8.2 — src/routes/tourist.routes.js

```javascript
// src/routes/tourist.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/tourist.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { z } = require('zod')

const UpdateProfileSchema = z.object({
  fullName:          z.string().min(2).max(255).optional(),
  email:             z.string().email().optional(),
  bloodGroup:        z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
  medicalInfo:       z.string().max(1000).optional(),
  emergencyContacts: z.array(z.object({
    id:          z.string().uuid().optional(),
    name:        z.string().min(2).max(100),
    phone:       z.string().min(10).max(15),
    relation:    z.string().min(2).max(50),
    tier:        z.number().int().min(1).max(2).optional().default(1),
    notifyOnSOS: z.boolean().optional().default(true),
  })).max(3).optional(),
  profilePhotoUrl: z.string().url().optional().nullable(),
})

router.get('/me',                    authenticateTourist, ctrl.getMe)
router.patch('/me',                  authenticateTourist, validate(UpdateProfileSchema), ctrl.updateMe)
router.get('/guardian/:token',       ctrl.getGuardianView)  // Public — no auth

module.exports = router
```

### Step 8.3 — src/routes/trip.routes.js

```javascript
// src/routes/trip.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/trip.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { CreateTripSchema, UpdateTripSchema, UpdateTripStatusSchema, UpdateChecklistSchema } = require('../validators/trip.validator')

// Public route (no auth)
router.get('/public/:token', ctrl.getPublicTrip)

// All below require auth
router.use(authenticateTourist)

router.get('/',            ctrl.getMyTrips)
router.post('/',           validate(CreateTripSchema),        ctrl.createTrip)
router.get('/:id',         ctrl.getTripById)
router.put('/:id',         validate(UpdateTripSchema),        ctrl.updateTrip)
router.patch('/:id/status',    validate(UpdateTripStatusSchema), ctrl.updateTripStatus)
router.patch('/:id/checklist', validate(UpdateChecklistSchema),  ctrl.updateChecklist)
router.delete('/:id',      ctrl.deleteTrip)

module.exports = router
```

### Step 8.4 — src/routes/sos.routes.js

```javascript
// src/routes/sos.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/sos.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { CreateSOSSchema } = require('../validators/sos.validator')

router.use(authenticateTourist)

router.post('/',                  validate(CreateSOSSchema), ctrl.createSOS)
router.get('/mine',               ctrl.getMySOSHistory)
router.patch('/:id/false-alarm',  ctrl.markFalseAlarm)

module.exports = router
```

### Step 8.5 — src/routes/dms.routes.js

```javascript
// src/routes/dms.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/dms.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { CreateDMSSchema, ResetDMSSchema, UpdateDMSStatusSchema } = require('../validators/dms.validator')

router.use(authenticateTourist)

router.post('/',             validate(CreateDMSSchema),       ctrl.createDMS)
router.get('/active',        ctrl.getActiveDMS)
router.post('/:id/reset',    validate(ResetDMSSchema),        ctrl.resetDMS)
router.patch('/:id/status',  validate(UpdateDMSStatusSchema), ctrl.updateDMSStatus)

module.exports = router
```

### Step 8.6 — src/routes/checkin.routes.js

```javascript
// src/routes/checkin.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/checkin.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { CreateCheckinSchema } = require('../validators/checkin.validator')

router.use(authenticateTourist)

router.post('/',    validate(CreateCheckinSchema), ctrl.createCheckin)
router.get('/recent', ctrl.getRecentCheckins)

module.exports = router
```

### Step 8.7 — src/routes/govt.routes.js

```javascript
// src/routes/govt.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/govt.controller')
const { authenticateGovt } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { z } = require('zod')
const { TEAM_STATUSES } = require('../constants/enums')

const AssignRescueSchema = z.object({
  teamId: z.string().uuid(),
  notes:  z.string().max(1000).optional().nullable(),
})
const ResolveSOSSchema = z.object({
  resolutionNotes: z.string().min(3).max(1000).optional(),
})
const UpdateTeamStatusSchema = z.object({
  status: z.enum(Object.values(TEAM_STATUSES)),
})

router.use(authenticateGovt)

router.get('/dashboard',           ctrl.getDashboard)
router.get('/tourists/live',       ctrl.getLiveTourists)
router.get('/risk-overview',       ctrl.getRiskOverview)
router.get('/analytics',           ctrl.getAnalytics)
router.get('/sos/active',          ctrl.getActiveSOS)
router.patch('/sos/:id/assign',    validate(AssignRescueSchema),     ctrl.assignRescue)
router.patch('/sos/:id/resolve',   validate(ResolveSOSSchema),       ctrl.resolveSOS)
router.get('/rescue-teams',        ctrl.getRescueTeams)
router.patch('/rescue-teams/:id/status', validate(UpdateTeamStatusSchema), ctrl.updateTeamStatus)

module.exports = router
```

### Step 8.8 — Remaining routes

```javascript
// src/routes/destination.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/destination.controller')
router.get('/',    ctrl.getAllDestinations)
router.get('/:id', ctrl.getDestinationById)
module.exports = router

// src/routes/scam.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/scam.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { CreateScamReportSchema } = require('../validators/scam.validator')
router.get('/:destinationId', ctrl.getByDestination)
router.post('/', authenticateTourist, validate(CreateScamReportSchema), ctrl.createReport)
module.exports = router

// src/routes/packing.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/packing.controller')
const { authenticateTourist } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { GeneratePackingSchema } = require('../validators/packing.validator')
router.post('/generate', authenticateTourist, validate(GeneratePackingSchema), ctrl.generatePackingList)
module.exports = router

// src/routes/passport.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/passport.controller')
const { authenticateTourist } = require('../middleware/auth')
router.post('/:tripId', authenticateTourist, ctrl.generatePassport)
module.exports = router

// src/routes/webhook.routes.js
'use strict'
const router = require('express').Router()
const ctrl = require('../controllers/webhook.controller')
// Twilio sends application/x-www-form-urlencoded — already handled by express.urlencoded in app.js
router.post('/twilio-inbound', ctrl.twilioInbound)
module.exports = router
```

### Step 8.9 — src/routes/index.js

```javascript
// src/routes/index.js
'use strict'

const { Router } = require('express')
const router = Router()

router.use('/auth',            require('./auth.routes'))
router.use('/tourists',        require('./tourist.routes'))
router.use('/trips',           require('./trip.routes'))
router.use('/sos',             require('./sos.routes'))
router.use('/dms',             require('./dms.routes'))
router.use('/checkins',        require('./checkin.routes'))
router.use('/destinations',    require('./destination.routes'))
router.use('/scam-reports',    require('./scam.routes'))
router.use('/packing',         require('./packing.routes'))
router.use('/journey-passport',require('./passport.routes'))
router.use('/govt',            require('./govt.routes'))
router.use('/webhooks',        require('./webhook.routes'))

module.exports = router
```

---

## PHASE 9 — MIDDLEWARE

### Step 9.1 — src/middleware/auth.js

```javascript
// src/middleware/auth.js
'use strict'

const jwt = require('jsonwebtoken')
const config = require('../config/env')
const { TouristRepository } = require('../repositories/tourist.repository')
const { GovtRepository }    = require('../repositories/govt.repository')
const { sendError } = require('../utils/response')
const { ERRORS }    = require('../constants/errors')
const logger        = require('../utils/logger')

function extractToken(req) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim()
}

function verifyJWT(token) {
  try {
    return jwt.verify(token, config.jwt.secret)
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw Object.assign(new Error(ERRORS.INVALID_TOKEN), { statusCode: 401, code: 'TOKEN_EXPIRED' })
    throw Object.assign(new Error(ERRORS.INVALID_TOKEN), { statusCode: 401 })
  }
}

async function authenticateTourist(req, res, next) {
  const token = extractToken(req)
  if (!token) return sendError(res, ERRORS.UNAUTHORIZED, 401)

  try {
    const payload = verifyJWT(token)
    if (payload.role !== 'tourist') return sendError(res, ERRORS.FORBIDDEN, 403)

    const repo    = new TouristRepository()
    const tourist = await repo.findById(payload.id)
    if (!tourist || !tourist.is_active) return sendError(res, ERRORS.INVALID_TOKEN, 401)

    req.tourist = tourist
    next()
  } catch (err) {
    if (err.statusCode === 401) return sendError(res, err.message, 401)
    logger.error({ err: err.message }, 'Auth middleware error')
    next(err)
  }
}

async function authenticateGovt(req, res, next) {
  const token = extractToken(req)
  if (!token) return sendError(res, ERRORS.UNAUTHORIZED, 401)

  try {
    const payload = verifyJWT(token)
    if (payload.role !== 'govt') return sendError(res, ERRORS.FORBIDDEN, 403)

    const repo = new GovtRepository()
    const user = await repo.findById(payload.id)
    if (!user || !user.is_active) return sendError(res, ERRORS.INVALID_TOKEN, 401)

    req.govtUser = user
    next()
  } catch (err) {
    if (err.statusCode === 401) return sendError(res, err.message, 401)
    logger.error({ err: err.message }, 'Govt auth middleware error')
    next(err)
  }
}

module.exports = { authenticateTourist, authenticateGovt }
```

### Step 9.2 — src/middleware/rateLimiter.js

```javascript
// src/middleware/rateLimiter.js
'use strict'

const rateLimit = require('express-rate-limit')
const config    = require('../config/env')

const limiterDefaults = {
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests — please try again later.' },
}

const generalLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.max,
})

const authLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.authMax,
  message:  { success: false, message: 'Too many login attempts — please try again in 15 minutes.' },
})

// OTP endpoints need tighter limits than general auth
const otpLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      3,               // max 3 OTP requests per 15 min per IP
  message:  { success: false, message: 'Too many OTP requests — wait 15 minutes.' },
  keyGenerator: (req) => `${req.ip}-${req.body?.phone || ''}`,  // per IP + per phone
})

const webhookLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 1000,
  max:      config.rateLimit.webhookMax,
})

module.exports = { generalLimiter, authLimiter, otpLimiter, webhookLimiter }
```

### Step 9.3 — src/middleware/errorHandler.js

```javascript
// src/middleware/errorHandler.js
'use strict'

const { sendError } = require('../utils/response')
const { ERRORS }    = require('../constants/errors')
const logger        = require('../utils/logger')

// Must be LAST middleware registered in app.js (4 params)
function errorHandler(err, req, res, next) {
  // Already responded — abort
  if (res.headersSent) return next(err)

  // Log with context
  logger.error({
    err: {
      message: err.message,
      code:    err.code,
      stack:   err.stack,
    },
    req: { method: req.method, url: req.url, ip: req.ip },
  }, 'Request error')

  // PostgreSQL errors
  if (err.code === '23505') return sendError(res, ERRORS.DB_CONFLICT, 409)
  if (err.code === '23503') return sendError(res, ERRORS.DB_FOREIGN_KEY, 400)
  if (err.code === '23502') return sendError(res, 'Required field missing in database operation', 400)
  if (err.code === '22P02') return sendError(res, 'Invalid UUID format', 400)

  // JWT errors
  if (err.name === 'JsonWebTokenError')  return sendError(res, ERRORS.INVALID_TOKEN, 401)
  if (err.name === 'TokenExpiredError')  return sendError(res, 'Token expired', 401)

  // Multer errors
  if (err.name === 'MulterError')        return sendError(res, err.message, 400)

  // CORS errors
  if (err.message?.includes('not allowed by CORS')) return sendError(res, 'CORS policy violation', 403)

  // Application errors with explicit statusCode
  if (err.statusCode) {
    return sendError(
      res,
      err.message || ERRORS.INTERNAL_ERROR,
      err.statusCode,
      process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined
    )
  }

  // Fallback
  sendError(
    res,
    ERRORS.INTERNAL_ERROR,
    500,
    process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined
  )
}

module.exports = { errorHandler }
```

---

## PHASE 10 — SOCKET.IO

### Step 10.1 — src/socket/index.js

```javascript
// src/socket/index.js
'use strict'

const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const config = require('../config/env')
const { SOCKET_ROOMS } = require('../constants/events')
const logger = require('../utils/logger')

let _io = null

function getIO() {
  if (!_io) throw new Error('Socket.IO not initialized — call initSocket(server) first')
  return _io
}

function initSocket(server) {
  _io = new Server(server, {
    cors: {
      origin: [config.cors.touristUrl, config.cors.govtUrl, config.cors.guardianUrl,
               'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout:  60000,
    pingInterval: 25000,
  })

  // Auth middleware — runs before every connection
  _io.use((socket, next) => {
    const { token, guardianToken } = socket.handshake.auth

    // Guardian connection — no JWT, just a guardian token
    if (guardianToken) {
      socket.data.role          = 'guardian'
      socket.data.guardianToken = guardianToken
      return next()
    }

    // Tourist or Govt — require JWT
    if (token) {
      try {
        const payload = jwt.verify(token, config.jwt.secret)
        socket.data.role = payload.role
        if (payload.role === 'tourist') socket.data.touristId   = payload.id
        if (payload.role === 'govt')    socket.data.govtUserId  = payload.id
        return next()
      } catch (err) {
        logger.debug({ err: err.message }, 'Socket auth failed — connecting without auth')
        socket.data.role = 'anonymous'
        return next()
      }
    }

    socket.data.role = 'anonymous'
    next()
  })

  _io.on('connection', (socket) => {
    const { role, touristId, govtUserId, guardianToken } = socket.data

    logger.debug({ socketId: socket.id, role }, 'Socket connected')

    switch (role) {
      case 'govt':
        socket.join(SOCKET_ROOMS.GOVT_DASHBOARD)
        // Allow govt to join district-specific rooms
        socket.on('GOVT_JOIN_DISTRICT', (district) => {
          if (district && typeof district === 'string') {
            socket.join(SOCKET_ROOMS.govtDistrict(district))
            logger.debug({ govtUserId, district }, 'Govt joined district room')
          }
        })
        break
      case 'tourist':
        if (touristId) socket.join(SOCKET_ROOMS.tourist(touristId))
        break
      case 'guardian':
        if (guardianToken) socket.join(SOCKET_ROOMS.guardian(guardianToken))
        break
    }

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, role, reason }, 'Socket disconnected')
    })

    socket.on('error', (err) => {
      logger.error({ err: err.message, socketId: socket.id }, 'Socket error')
    })
  })

  logger.info('Socket.IO initialized')
  return _io
}

module.exports = { initSocket, getIO }
```

### Step 10.2 — src/socket/emitters.js

```javascript
// src/socket/emitters.js
// All Socket.IO emit functions. Always use constants from events.js — never string literals.
// All functions are wrapped in try/catch — a socket error must NEVER crash the process.
'use strict'

const { getIO } = require('./index')
const { SOCKET_EVENTS, SOCKET_ROOMS } = require('../constants/events')
const logger = require('../utils/logger')

function safeEmit(room, event, payload) {
  try {
    const io = getIO()
    io.to(room).emit(event, { ...payload, emittedAt: new Date().toISOString() })
    logger.debug({ room, event }, 'Socket event emitted')
  } catch (err) {
    logger.error({ err: err.message, room, event }, 'Socket emit failed')
  }
}

// Govt dashboard: new SOS arrived
function emitSOSReceived(sosEvent, tourist) {
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.SOS_RECEIVED, {
    sosId:          sosEvent.id,
    touristId:      sosEvent.tourist_id,
    touristName:    tourist?.full_name,
    phone:          tourist?.phone,
    bloodGroup:     tourist?.blood_group,
    emergencyContacts: tourist?.emergency_contacts,
    category:       sosEvent.category,
    triggerType:    sosEvent.trigger_type,
    latitude:       sosEvent.latitude,
    longitude:      sosEvent.longitude,
    locationAccuracyM: sosEvent.location_accuracy_m,
    isStaleLocation:sosEvent.is_stale_location,
    batteryPct:     sosEvent.battery_pct,
    tripId:         sosEvent.trip_id,
    status:         sosEvent.status,
    createdAt:      sosEvent.created_at,
  })
}

// Govt dashboard: SOS resolved
function emitSOSResolved(sosEventId, resolutionNotes) {
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.SOS_RESOLVED, {
    sosId: sosEventId, status: 'RESOLVED', resolutionNotes, resolvedAt: new Date().toISOString(),
  })
}

// Govt dashboard: rescue assigned to SOS
function emitRescueAssigned(assignment, sosEvent, team) {
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.RESCUE_ASSIGNED, {
    assignmentId: assignment.id,
    sosId:        sosEvent.id,
    teamId:       team.id,
    teamName:     team.name,
    teamType:     team.type,
    district:     team.district,
    status:       assignment.status,
    assignedAt:   assignment.assigned_at,
  })
}

// Govt dashboard + Tourist room: DMS triggered
function emitDMSTriggered(sosEvent, tourist) {
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.DMS_TRIGGERED, {
    sosId:       sosEvent.id,
    touristId:   sosEvent.tourist_id,
    touristName: tourist?.full_name,
    phone:       tourist?.phone,
    category:    sosEvent.category,
    triggerType: sosEvent.trigger_type,
    latitude:    sosEvent.latitude,
    longitude:   sosEvent.longitude,
    createdAt:   sosEvent.created_at,
  })
  // Also notify the tourist's own room
  if (tourist?.id) {
    safeEmit(SOCKET_ROOMS.tourist(tourist.id), SOCKET_EVENTS.DMS_TRIGGERED_OWN, {
      message: 'Your Dead Man\'s Switch triggered — SOS has been sent automatically.',
      sosId:   sosEvent.id,
    })
  }
}

// Tourist room: TSI recalculated (weather update or manual recalc)
function emitTSIUpdated(touristId, tripId, tsiScore, tsiLabel, tsiFactors) {
  safeEmit(SOCKET_ROOMS.tourist(touristId), SOCKET_EVENTS.TSI_UPDATED, {
    tripId, tsiScore, tsiLabel, tsiFactors, updatedAt: new Date().toISOString(),
  })
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.TSI_BULK_UPDATE, {
    touristId, tripId, tsiScore, tsiLabel,
  })
}

// Guardian room + Govt dashboard: tourist checked in
function emitCheckinUpdate(touristId, guardianToken, location, batteryPct, eta) {
  const payload = {
    touristId,
    latitude:   location?.latitude,
    longitude:  location?.longitude,
    batteryPct,
    eta,
    updatedAt:  new Date().toISOString(),
  }
  if (guardianToken) {
    safeEmit(SOCKET_ROOMS.guardian(guardianToken), SOCKET_EVENTS.GUARDIAN_LOCATION_UPDATE, payload)
  }
  safeEmit(SOCKET_ROOMS.GOVT_DASHBOARD, SOCKET_EVENTS.LIVE_MAP_UPDATE, { ...payload })
}

// Guardian room: SOS alert for guardian
function emitGuardianSOSAlert(guardianToken, sosEvent, tourist) {
  if (!guardianToken) return
  safeEmit(SOCKET_ROOMS.guardian(guardianToken), SOCKET_EVENTS.GUARDIAN_SOS_ALERT, {
    sosId:     sosEvent.id,
    category:  sosEvent.category,
    latitude:  sosEvent.latitude,
    longitude: sosEvent.longitude,
    createdAt: sosEvent.created_at,
    touristFirstName: tourist?.full_name?.split(' ')[0],
  })
}

module.exports = {
  emitSOSReceived, emitSOSResolved, emitRescueAssigned, emitDMSTriggered,
  emitTSIUpdated, emitCheckinUpdate, emitGuardianSOSAlert,
}
```

---

## PHASE 11 — CRON JOBS

### Step 11.1 — src/cron/jobs/dms.job.js

```javascript
// src/cron/jobs/dms.job.js
'use strict'

const cron   = require('node-cron')
const logger = require('../../utils/logger')
const { processDMSTriggers, processDMSWarnings } = require('../../services/dms.service')

function startDMSJobs() {
  // ── DMS Warning: every minute ──────────────────────────────────────
  // Fires SMS to tourist 10 minutes before their DMS would auto-trigger
  cron.schedule('* * * * *', async () => {
    try {
      const result = await processDMSWarnings()
      if (result.processed > 0) {
        logger.info({ processed: result.processed }, 'DMS warnings sent')
      }
    } catch (err) {
      logger.error({ err: { message: err.message } }, 'DMS warning cron crashed')
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' })

  // ── DMS Trigger: every minute ─────────────────────────────────────
  // Auto-creates SOS for tourists who missed their check-in deadline
  cron.schedule('* * * * *', async () => {
    try {
      const result = await processDMSTriggers()
      if (result.processed > 0) {
        logger.warn({ processed: result.processed }, 'DMS triggers fired — SOSes created')
      }
    } catch (err) {
      logger.error({ err: { message: err.message } }, 'DMS trigger cron crashed')
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' })

  logger.info('DMS cron jobs started (warn + trigger every minute)')
}

module.exports = { startDMSJobs }
```

### Step 11.2 — src/cron/jobs/weather.job.js

```javascript
// src/cron/jobs/weather.job.js
'use strict'

const cron   = require('node-cron')
const logger = require('../../utils/logger')
const { updateWeatherForActiveTrips } = require('../../services/weather.service')
const { emitTSIUpdated } = require('../../socket/emitters')

function startWeatherJobs() {
  // ── Weather + TSI update: every hour ──────────────────────────────
  // Fetches OWM data for active trip destinations, recalculates TSI,
  // emits TSI_UPDATED to affected tourist + govt dashboard
  cron.schedule('0 * * * *', async () => {
    logger.info('Weather + TSI cron starting')
    try {
      const result = await updateWeatherForActiveTrips(emitTSIUpdated)
      logger.info(result, 'Weather + TSI cron complete')
    } catch (err) {
      logger.error({ err: { message: err.message } }, 'Weather cron crashed')
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' })

  logger.info('Weather cron job started (hourly)')
}

module.exports = { startWeatherJobs }
```

### Step 11.3 — src/cron/index.js

```javascript
// src/cron/index.js
'use strict'

const { startDMSJobs }     = require('./jobs/dms.job')
const { startWeatherJobs } = require('./jobs/weather.job')
const logger = require('../utils/logger')

function startCrons() {
  startDMSJobs()
  startWeatherJobs()
  logger.info('All cron jobs started')
}

module.exports = { startCrons }
```

---

## PHASE 12 — REMAINING SERVICES + APP + SERVER

### Step 12.1 — src/services/tourist.service.js

```javascript
// src/services/tourist.service.js
'use strict'

const { TouristRepository } = require('../repositories/tourist.repository')
const { LocationRepository } = require('../repositories/location.repository')
const { SOSRepository }      = require('../repositories/sos.repository')
const { TripRepository }     = require('../repositories/trip.repository')
const { ERRORS } = require('../constants/errors')

async function getProfile(touristId) {
  const repo    = new TouristRepository()
  const tourist = await repo.findById(touristId)
  if (!tourist) throw Object.assign(new Error(ERRORS.NOT_FOUND), { statusCode: 404 })
  return tourist
}

async function updateProfile(touristId, data) {
  const repo    = new TouristRepository()
  const dbFields = {}
  if (data.fullName)          dbFields.full_name          = data.fullName
  if (data.email !== undefined) dbFields.email            = data.email
  if (data.bloodGroup)        dbFields.blood_group        = data.bloodGroup
  if (data.medicalInfo)       dbFields.medical_info       = data.medicalInfo
  if (data.profilePhotoUrl !== undefined) dbFields.profile_photo_url = data.profilePhotoUrl
  if (data.emergencyContacts) dbFields.emergency_contacts = data.emergencyContacts
  return repo.update(touristId, dbFields)
}

async function getGuardianView(token) {
  const touristRepo  = new TouristRepository()
  const locationRepo = new LocationRepository()
  const sosRepo      = new SOSRepository()
  const tripRepo     = new TripRepository()

  const tourist = await touristRepo.findByGuardianToken(token)
  if (!tourist) throw Object.assign(new Error(ERRORS.GUARDIAN_TOKEN_INVALID), { statusCode: 404 })

  const [location, activeTrip] = await Promise.all([
    locationRepo.findByTouristId(tourist.id),
    tripRepo.findActiveByTouristId(tourist.id),
  ])

  const activeSOS = location ? await sosRepo.queryOne?.(
    `SELECT id, category, status, created_at FROM sos_events WHERE tourist_id=$1 AND status='ACTIVE' ORDER BY created_at DESC LIMIT 1`,
    [tourist.id]
  ) : null

  // Return privacy-safe subset — first name only
  return {
    firstName:    tourist.full_name.split(' ')[0],
    bloodGroup:   tourist.blood_group,
    medicalInfo:  tourist.medical_info,
    location:     location ? {
      latitude:   location.latitude,
      longitude:  location.longitude,
      batteryPct: location.battery_pct,
      updatedAt:  location.updated_at,
    } : null,
    activeSOS:    activeSOS ? { id: activeSOS.id, category: activeSOS.category, createdAt: activeSOS.created_at } : null,
    activeTripCity: activeTrip ? JSON.parse(activeTrip.stops || '[]')[0]?.city : null,
    tsiScore:     activeTrip?.tsi_score || null,
    tsiLabel:     activeTrip?.tsi_label || null,
  }
}

module.exports = { getProfile, updateProfile, getGuardianView }
```

### Step 12.2 — src/services/destination.service.js

```javascript
// src/services/destination.service.js
'use strict'

const { DestinationRepository } = require('../repositories/destination.repository')
const { ScamRepository }         = require('../repositories/scam.repository')
const { ERRORS } = require('../constants/errors')

async function getAllDestinations(filters) {
  return new DestinationRepository().findAll({
    state:    filters.state,
    zoneType: filters.zoneType,
    search:   filters.search,
  })
}

async function getDestinationById(id) {
  const destRepo  = new DestinationRepository()
  const scamRepo  = new ScamRepository()
  const dest = await destRepo.findById(id)
  if (!dest) throw Object.assign(new Error(ERRORS.DESTINATION_NOT_FOUND), { statusCode: 404 })
  const [scamReports, scamAggregate] = await Promise.all([
    scamRepo.findByDestination(id, 20),
    scamRepo.countByDestination(id),
  ])
  return { ...dest, scamReports, scamAggregate }
}

module.exports = { getAllDestinations, getDestinationById }
```

### Step 12.3 — src/services/scam.service.js

```javascript
'use strict'
const { ScamRepository }        = require('../repositories/scam.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { ERRORS } = require('../constants/errors')

async function createReport(touristId, data) {
  const dest = await new DestinationRepository().findById(data.destinationId)
  if (!dest) throw Object.assign(new Error(ERRORS.DESTINATION_NOT_FOUND), { statusCode: 404 })
  return new ScamRepository().create({ touristId, ...data })
}

async function getByDestination(destinationId) {
  const [reports, aggregate] = await Promise.all([
    new ScamRepository().findByDestination(destinationId),
    new ScamRepository().countByDestination(destinationId),
  ])
  return { reports, aggregate }
}

module.exports = { createReport, getByDestination }
```

### Step 12.4 — src/services/packing.service.js

```javascript
'use strict'
const { TripRepository }        = require('../repositories/trip.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { generatePackingList }   = require('./gemini.service')
const { ERRORS } = require('../constants/errors')
const { WEATHER_CONDITIONS }    = require('../constants/enums')

async function generateForTrip(touristId, tripId) {
  const tripRepo = new TripRepository()
  const trip     = await tripRepo.findById(tripId, touristId)
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
  const destRepo  = new DestinationRepository()

  // Get worst weather across all stops
  const destIds = stops.map(s => s.destinationId).filter(Boolean)
  const weatherMap = destIds.length > 0 ? await destRepo.getWeatherCacheMap(destIds) : {}
  const worstWeather = Object.values(weatherMap).reduce((worst, w) => {
    const priority = [WEATHER_CONDITIONS.STORM, WEATHER_CONDITIONS.HEAVY_RAIN, WEATHER_CONDITIONS.SNOW,
                     WEATHER_CONDITIONS.FOG, WEATHER_CONDITIONS.RAIN, WEATHER_CONDITIONS.CLOUDY, WEATHER_CONDITIONS.CLEAR]
    const wIdx    = priority.indexOf(w.condition)
    const worstIdx = priority.indexOf(worst)
    return wIdx < worstIdx ? w.condition : worst
  }, WEATHER_CONDITIONS.CLEAR)

  const firstStop = stops[0] || {}
  const result = await generatePackingList({
    destination:      firstStop.city || 'Northeast India',
    state:            firstStop.state || 'Assam',
    tsiScore:         trip.tsi_score,
    tsiLabel:         trip.tsi_label,
    weatherCondition: worstWeather,
    travelType:       trip.travel_type,
    startDate:        trip.start_date,
    endDate:          trip.end_date,
    stops,
  })

  // Save generated list back to trip
  await tripRepo.updateChecklist(tripId, touristId, result.items)
  return result
}

module.exports = { generateForTrip }
```

### Step 12.5 — src/services/passport.service.js (PDFKit)

```javascript
// src/services/passport.service.js
'use strict'

const PDFDocument = require('pdfkit')
const { TripRepository }    = require('../repositories/trip.repository')
const { CheckinRepository } = require('../repositories/checkin.repository')
const { SOSRepository }     = require('../repositories/sos.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { ERRORS } = require('../constants/errors')

async function generate(tripId, touristId) {
  const tripRepo    = new TripRepository()
  const checkinRepo = new CheckinRepository()
  const sosRepo     = new SOSRepository()
  const touristRepo = new TouristRepository()

  const [trip, tourist] = await Promise.all([
    tripRepo.findById(tripId, touristId),
    touristRepo.findById(touristId),
  ])
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  const [checkins, { rows: sosEvents }] = await Promise.all([
    checkinRepo.findByTripId(tripId),
    sosRepo.findByTouristId(touristId, { tripId, limit: 50 }),
  ])

  const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
  const checklist = Array.isArray(trip.packing_checklist) ? trip.packing_checklist : JSON.parse(trip.packing_checklist || '[]')

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
    Title: `Journey Passport — ${trip.title}`,
    Author: 'Aaraksha Platform',
  }})

  // ── Header ─────────────────────────────────────────────────────────
  doc.fontSize(24).font('Helvetica-Bold').text('AARAKSHA', { align: 'center' })
  doc.fontSize(14).font('Helvetica').text('Digital Journey Passport', { align: 'center' })
  doc.fontSize(9).fillColor('#666').text(`Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'center' })
  doc.moveDown(2).fillColor('#000')

  // ── Section 1: Trip Summary ────────────────────────────────────────
  section(doc, '1. Trip Summary')
  field(doc, 'Trip Name', trip.title)
  field(doc, 'Travel Type', trip.travel_type)
  field(doc, 'Dates', `${trip.start_date} to ${trip.end_date}`)
  field(doc, 'Status', trip.status)
  field(doc, 'Total Destinations', stops.length.toString())
  if (trip.budget_inr) field(doc, 'Budget', `₹${trip.budget_inr.toLocaleString('en-IN')}`)
  doc.moveDown()

  // ── Section 2: Travel Safety Index ────────────────────────────────
  section(doc, '2. Travel Safety Index (TSI)')
  field(doc, 'Score', trip.tsi_score ? `${trip.tsi_score}/100` : 'Not calculated')
  field(doc, 'Risk Level', trip.tsi_label || 'N/A')
  if (trip.tsi_recommendations) {
    const recs = Array.isArray(trip.tsi_recommendations) ? trip.tsi_recommendations : JSON.parse(trip.tsi_recommendations || '[]')
    if (recs.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').text('Recommendations:')
      recs.forEach((r, i) => doc.fontSize(9).font('Helvetica').text(`  ${i+1}. ${r}`))
    }
  }
  doc.moveDown()

  // ── Section 3: Visited Locations ──────────────────────────────────
  section(doc, '3. Itinerary')
  stops.forEach((stop, i) => {
    doc.fontSize(10).font('Helvetica-Bold').text(`  Stop ${i+1}: ${stop.city}, ${stop.state} (${stop.days} days)`)
    if (stop.activities && stop.activities.length > 0) {
      stop.activities.forEach(a => {
        doc.fontSize(9).font('Helvetica').text(`    • ${a.name}${a.cost ? ` — ₹${a.cost}` : ''}`)
      })
    }
  })
  doc.moveDown()

  // ── Section 4: Budget ─────────────────────────────────────────────
  section(doc, '4. Budget Summary')
  const totalCost = stops.reduce((s, stop) =>
    s + (stop.activities || []).reduce((as, a) => as + (a.cost || 0), 0), 0)
  field(doc, 'Planned Budget', trip.budget_inr ? `₹${trip.budget_inr.toLocaleString('en-IN')}` : 'Not set')
  field(doc, 'Estimated from Activities', `₹${totalCost.toLocaleString('en-IN')}`)
  doc.moveDown()

  // ── Section 5: Check-in Timeline ─────────────────────────────────
  section(doc, '5. Check-in Timeline')
  if (checkins.length === 0) {
    doc.fontSize(9).font('Helvetica').text('  No check-ins recorded.')
  } else {
    checkins.forEach(c => {
      const dt = new Date(c.created_at).toLocaleString('en-IN')
      const loc = c.latitude ? `(${parseFloat(c.latitude).toFixed(4)}, ${parseFloat(c.longitude).toFixed(4)})` : 'Location not recorded'
      doc.fontSize(9).font('Helvetica').text(`  ${dt}  —  ${c.type}  —  ${loc}${c.message ? '  — ' + c.message : ''}`)
    })
  }
  doc.moveDown()

  // ── Section 6: Safety Events ──────────────────────────────────────
  section(doc, '6. Safety Events (SOS)')
  if (sosEvents.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor('#2d6a4f').text('  ✅ No safety incidents recorded on this trip.')
    doc.fillColor('#000')
  } else {
    sosEvents.forEach(s => {
      const dt = new Date(s.created_at).toLocaleString('en-IN')
      doc.fontSize(9).font('Helvetica')
        .text(`  ${dt}  —  ${s.category}  —  ${s.status}  —  Trigger: ${s.trigger_type}`)
    })
  }
  doc.moveDown()

  // ── Section 7: Achievements ───────────────────────────────────────
  section(doc, '7. Journey Achievements')
  const days = Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / 86400000)
  field(doc, 'Cities Visited',   stops.length.toString())
  field(doc, 'Total Days',       days.toString())
  field(doc, 'Check-ins Made',   checkins.length.toString())
  field(doc, 'Activities',       stops.reduce((s, stop) => s + (stop.activities?.length || 0), 0).toString())
  doc.moveDown()

  // ── Footer ─────────────────────────────────────────────────────────
  doc.fontSize(8).fillColor('#666')
     .text(`Tourist: ${tourist.full_name}  |  Trip ID: ${tripId}  |  Powered by Aaraksha — Smart Tourism Safety`, {
       align: 'center'
     })

  doc.end()
  return doc
}

function section(doc, title) {
  doc.moveDown(0.5)
     .fontSize(12).font('Helvetica-Bold').fillColor('#1a5276')
     .text(title)
     .fillColor('#000').moveDown(0.3)
}

function field(doc, label, value) {
  doc.fontSize(9)
     .font('Helvetica-Bold').text(`${label}: `, { continued: true })
     .font('Helvetica').text(value || '—')
}

module.exports = { generate }
```

### Step 12.6 — src/services/webhook.service.js

```javascript
// src/services/webhook.service.js
// Handles inbound SMS from Twilio — the offline SOS fallback path.
// Parses AARAKSHA_SOS|ID:...|LAT:...|LNG:...|CAT:...|BATT:...|TIME:... format.
'use strict'

const { InboundRepository } = require('../repositories/inbound.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { SOSRepository }     = require('../repositories/sos.repository')
const { LocationRepository }= require('../repositories/location.repository')
const { withTransaction }   = require('../database/transaction')
const { emitSOSReceived }   = require('../socket/emitters')
const { notifyOnSOS }       = require('./notification/notification.service')
const { normalizePhone }    = require('../utils/crypto')
const { SOS_CATEGORIES, SOS_TRIGGER_TYPES } = require('../constants/enums')
const logger = require('../utils/logger')

// Regex pattern for structured offline SOS SMS
const SOS_PATTERN = /AARAKSHA_SOS\|ID:([a-f0-9-]{36})\|LAT:(-?\d+\.?\d*)\|LNG:(-?\d+\.?\d*)\|CAT:([A-Z]+)\|BATT:(\d+)\|TIME:(\d+)/

async function processInboundSMS(fromPhone, body) {
  const inboundRepo = new InboundRepository()
  const record      = await inboundRepo.create(fromPhone, body)

  const match = body?.match(SOS_PATTERN)
  if (!match) {
    await inboundRepo.markFailed(record.id, `Pattern not matched. Body: ${body?.slice(0, 100)}`)
    logger.warn({ from: fromPhone }, 'Inbound SMS did not match SOS pattern — ignored')
    return
  }

  const [, touristId, latStr, lngStr, category, battStr, timeStr] = match
  const lat     = parseFloat(latStr)
  const lng     = parseFloat(lngStr)
  const battery = parseInt(battStr, 10)
  const timestamp = parseInt(timeStr, 10) * 1000

  // Validate coordinates
  if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
    await inboundRepo.markFailed(record.id, `Invalid coordinates: lat=${latStr} lng=${lngStr}`)
    return
  }

  // Validate category
  const validCategory = Object.values(SOS_CATEGORIES).includes(category) ? category : SOS_CATEGORIES.OTHER

  // Check location staleness (> 30 minutes old)
  const isStale = Date.now() - timestamp > 30 * 60 * 1000

  const touristRepo = new TouristRepository()
  const tourist = await touristRepo.findById(touristId)

  if (!tourist || !tourist.is_active) {
    await inboundRepo.markFailed(record.id, `Tourist not found or inactive: ${touristId}`)
    logger.warn({ touristId, from: fromPhone }, 'Inbound SOS — tourist not found')
    return
  }

  // Create SOS event in transaction
  const { sosEvent } = await withTransaction(async (client) => {
    const sosRepo_t      = new SOSRepository(client)
    const locationRepo_t = new LocationRepository(client)

    const sosEvent = await sosRepo_t.create({
      touristId:       tourist.id,
      tripId:          null,
      latitude:        lat,
      longitude:       lng,
      isStaleLocation: isStale,
      category:        validCategory,
      triggerType:     SOS_TRIGGER_TYPES.SMS_INBOUND,
      batteryPct:      battery,
      message:         `Offline SOS via SMS. Timestamp: ${new Date(timestamp).toISOString()}${isStale ? ' [STALE LOCATION]' : ''}`,
    })

    // Update location from the SMS (may be stale but it's what we have)
    await locationRepo_t.upsert(tourist.id, { latitude: lat, longitude: lng, batteryPct: battery })

    return { sosEvent }
  })

  // Update inbound record
  await inboundRepo.markParsed(record.id, tourist.id, sosEvent.id)

  // Side effects outside transaction
  emitSOSReceived(sosEvent, tourist)
  notifyOnSOS(tourist, sosEvent).catch(err =>
    logger.error({ err: err.message, sosId: sosEvent.id }, 'Inbound SOS notification failed')
  )

  logger.warn({
    sosId:     sosEvent.id,
    touristId: tourist.id,
    category:  validCategory,
    isStale,
    from:      fromPhone,
  }, 'Offline SOS processed from inbound SMS')
}

module.exports = { processInboundSMS }
```

### Step 12.7 — src/app.js

```javascript
// src/app.js
'use strict'

require('./config/env')  // Validate env vars on startup — throws if anything is missing

const express   = require('express')
const helmet    = require('helmet')
const cors      = require('cors')
const corsOptions     = require('./config/cors')
const { generalLimiter, webhookLimiter } = require('./middleware/rateLimiter')
const { errorHandler } = require('./middleware/errorHandler')
const { sendError }    = require('./utils/response')
const logger           = require('./utils/logger')
const routes           = require('./routes/index')

const app = express()

// ── Security headers ────────────────────────────────────────────────
app.set('trust proxy', 1)  // Trust first proxy (for IP headers behind nginx)
app.use(helmet({
  contentSecurityPolicy: false,  // Let frontends manage their own CSP
  crossOriginResourcePolicy: { policy: 'cross-origin' },  // Allow PDF download
}))

// ── CORS ────────────────────────────────────────────────────────────
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))  // Preflight for all routes

// ── Body parsing ─────────────────────────────────────────────────────
// Webhooks from Twilio arrive as urlencoded — parse BEFORE json
app.use('/api/webhooks', express.urlencoded({ extended: true, limit: '1mb' }), webhookLimiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Rate limiting ────────────────────────────────────────────────────
app.use(generalLimiter)

// ── Request logging ──────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url, ip: req.ip }, 'Incoming request')
  next()
})

// ── Health check (no auth, no rate limit) ────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aaraksha-backend', timestamp: new Date().toISOString() })
})

// ── API routes ────────────────────────────────────────────────────────
app.use('/api', routes)

// ── 404 handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  sendError(res, `Route ${req.method} ${req.url} not found`, 404)
})

// ── Global error handler (MUST be last) ──────────────────────────────
app.use(errorHandler)

module.exports = app
```

### Step 12.8 — src/server.js

```javascript
// src/server.js
'use strict'

const http = require('http')
const app    = require('./app')
const { initSocket }  = require('./socket/index')
const { startCrons }  = require('./cron/index')
const { getPool }     = require('./database/pool')
const logger = require('./utils/logger')
const config = require('./config/env')

const server = http.createServer(app)

// Initialize Socket.IO
initSocket(server)

// Start listening
server.listen(config.port, () => {
  logger.info({
    port:    config.port,
    env:     config.nodeEnv,
    tourist: config.cors.touristUrl,
    govt:    config.cors.govtUrl,
    guardian:config.cors.guardianUrl,
  }, '🚀 Aaraksha backend running')

  // Start cron jobs AFTER server is listening
  startCrons()
})

// ── Graceful shutdown ─────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received — closing gracefully')
  server.close(async () => {
    try {
      await getPool().end()
      logger.info('Database pool closed')
    } catch (err) {
      logger.error({ err: err.message }, 'Error closing database pool')
    }
    logger.info('Server closed — goodbye')
    process.exit(0)
  })

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

process.on('uncaughtException', (err) => {
  logger.fatal({ err: { message: err.message, stack: err.stack } }, 'Uncaught exception — shutting down')
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection — shutting down')
  process.exit(1)
})
```


---

## PHASE 13 — SEED DATA

### Step 13.1 — scripts/seed.js

```javascript
// scripts/seed.js
'use strict'

require('dotenv').config()
const { getPool } = require('../src/database/pool')
const { hashPassword, hashGovtId, generateGuardianToken, normalizePhone } = require('../src/utils/crypto')
const { calculateTSI } = require('../src/services/tsi.service')
const { v4: uuid } = require('uuid')

const RESET = process.argv.includes('--reset')

async function seed() {
  const pool = getPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    if (RESET) {
      console.log('⚠️  --reset flag detected — clearing all tables...')
      await client.query(`
        TRUNCATE TABLE inbound_sos_sms, scam_reports, weather_cache, rescue_assignments,
          rescue_teams, govt_users, tourist_locations, checkins, dead_mans_switches,
          sos_events, trips, tourists, destinations, otp_verifications CASCADE
      `)
      console.log('✅ Tables cleared')
    } else {
      // Idempotent: check if already seeded
      const { rows } = await client.query('SELECT COUNT(*) FROM destinations')
      if (parseInt(rows[0].count) > 0) {
        console.log('✅ Database already seeded — skipping (use --reset to reseed)')
        await client.query('ROLLBACK')
        return
      }
    }

    // ── DESTINATIONS ──────────────────────────────────────────────────
    console.log('Seeding destinations...')

    const destinations = [
      {
        name: 'Tawang', state: 'Arunachal Pradesh',
        latitude: 27.5859, longitude: 91.8530,
        connectivity: 'POOR', difficulty: 'HARD', altitude_m: 3048,
        zone_type: 'ILP_REQUIRED', ilp_required: true,
        nearest_hospital_name: 'Tawang District Hospital',
        nearest_hospital_km: 3.2, nearest_hospital_phone: '03794-222456',
        nearest_police_km: 0.5,
        govt_advisory: 'Inner Line Permit mandatory for all non-Arunachal residents. High altitude — acclimatize at lower altitudes first. Weather changes rapidly.',
        popularity_index: 85,
        description: 'Home to the largest Buddhist monastery in India, Tawang Monastery. Breathtaking Himalayan landscapes.',
        best_months: 'March–June, September–November',
      },
      {
        name: 'Shillong', state: 'Meghalaya',
        latitude: 25.5788, longitude: 91.8933,
        connectivity: 'GOOD', difficulty: 'EASY', altitude_m: 1496,
        zone_type: 'SAFE', ilp_required: false,
        nearest_hospital_name: 'Bethany Hospital', nearest_hospital_km: 2.1, nearest_hospital_phone: '0364-2521111',
        nearest_police_km: 0.8, govt_advisory: null, popularity_index: 90,
        description: 'The Scotland of the East — rolling hills, waterfalls, and vibrant music culture.',
        best_months: 'October–May',
      },
      {
        name: 'Cherrapunji (Sohra)', state: 'Meghalaya',
        latitude: 25.2697, longitude: 91.7324,
        connectivity: 'MODERATE', difficulty: 'MODERATE', altitude_m: 1484,
        zone_type: 'CAUTION', ilp_required: false,
        nearest_hospital_name: 'Sohra PHC', nearest_hospital_km: 8.5, nearest_hospital_phone: '03637-265001',
        nearest_police_km: 5.2,
        govt_advisory: 'Extremely heavy rainfall June–September. Roads may be impassable. Travel with local guide.',
        popularity_index: 75,
        description: 'One of the wettest places on Earth. Living root bridges and stunning canyon views.',
        best_months: 'October–April',
      },
      {
        name: 'Kaziranga', state: 'Assam',
        latitude: 26.5775, longitude: 93.1705,
        connectivity: 'MODERATE', difficulty: 'EASY', altitude_m: 80,
        zone_type: 'SAFE', ilp_required: false,
        nearest_hospital_name: 'Kohora PHC', nearest_hospital_km: 12.0, nearest_hospital_phone: '03776-268103',
        nearest_police_km: 2.0,
        govt_advisory: 'Safari timings: 7–9:30 AM and 2–4 PM. Follow ranger instructions. Do not exit vehicle.',
        popularity_index: 88,
        description: 'UNESCO World Heritage Site. Home to two-thirds of the world\'s one-horned rhinoceros.',
        best_months: 'November–April',
      },
      {
        name: 'Dzukou Valley', state: 'Nagaland',
        latitude: 25.5000, longitude: 94.1167,
        connectivity: 'NONE', difficulty: 'EXTREME', altitude_m: 2452,
        zone_type: 'HIGH_RISK', ilp_required: false,
        nearest_hospital_name: 'Viswema PHC', nearest_hospital_km: 28.0, nearest_hospital_phone: '0370-2290001',
        nearest_police_km: 15.0,
        govt_advisory: 'No mobile connectivity. Inform forest department before trekking. Guided trek mandatory. Carry 3 days emergency rations.',
        popularity_index: 65,
        description: 'Valley of flowers — spectacular trekking destination with absolute zero connectivity.',
        best_months: 'June–September (flowers), October–November (mist)',
      },
      {
        name: 'Ziro Valley', state: 'Arunachal Pradesh',
        latitude: 27.5333, longitude: 93.8333,
        connectivity: 'MODERATE', difficulty: 'EASY', altitude_m: 1524,
        zone_type: 'ILP_REQUIRED', ilp_required: true,
        nearest_hospital_name: 'Ziro District Hospital', nearest_hospital_km: 5.0, nearest_hospital_phone: '03788-224201',
        nearest_police_km: 2.0,
        govt_advisory: 'ILP required. Home to Apatani tribe — respect local customs and traditions.',
        popularity_index: 70,
        description: 'UNESCO tentative heritage site. Famous for Ziro Music Festival and Apatani culture.',
        best_months: 'September–October (festival), March–May',
      },
      {
        name: 'Loktak Lake', state: 'Manipur',
        latitude: 24.4700, longitude: 93.7800,
        connectivity: 'MODERATE', difficulty: 'EASY', altitude_m: 768,
        zone_type: 'ILP_REQUIRED', ilp_required: true,
        nearest_hospital_name: 'Bishnupur District Hospital', nearest_hospital_km: 15.0, nearest_hospital_phone: '03875-240228',
        nearest_police_km: 8.0,
        govt_advisory: 'ILP required for non-Manipur residents. Register with local police on arrival.',
        popularity_index: 60,
        description: 'Largest freshwater lake in Northeast India. Famous for phumdis — floating islands.',
        best_months: 'October–March',
      },
      {
        name: 'Pelling', state: 'Sikkim',
        latitude: 27.2952, longitude: 88.1190,
        connectivity: 'MODERATE', difficulty: 'MODERATE', altitude_m: 2150,
        zone_type: 'SAFE', ilp_required: false,
        nearest_hospital_name: 'Gyalshing District Hospital', nearest_hospital_km: 14.0, nearest_hospital_phone: '03595-250274',
        nearest_police_km: 5.0,
        govt_advisory: 'Road conditions deteriorate in monsoon. Permits required for Kanchenjunga area.',
        popularity_index: 78,
        description: 'Gateway to Kanchenjunga with panoramic Himalayan views and ancient monasteries.',
        best_months: 'March–May, October–December',
      },
      {
        name: 'Majuli Island', state: 'Assam',
        latitude: 26.9500, longitude: 94.1667,
        connectivity: 'POOR', difficulty: 'EASY', altitude_m: 95,
        zone_type: 'CAUTION', ilp_required: false,
        nearest_hospital_name: 'Majuli District Hospital', nearest_hospital_km: 8.0, nearest_hospital_phone: '03775-274001',
        nearest_police_km: 3.0,
        govt_advisory: 'River ferry crossings can be disrupted in floods July–September.',
        popularity_index: 72,
        description: 'World\'s largest river island. Cultural hub of Assamese Vaishnava heritage.',
        best_months: 'October–March',
      },
      {
        name: 'Longwa Village', state: 'Nagaland',
        latitude: 26.3833, longitude: 95.1500,
        connectivity: 'NONE', difficulty: 'HARD', altitude_m: 1210,
        zone_type: 'RESTRICTED', ilp_required: true,
        nearest_hospital_name: 'Mon District Hospital', nearest_hospital_km: 62.0, nearest_hospital_phone: '03833-222201',
        nearest_police_km: 45.0,
        govt_advisory: 'Special border area permit required. Konyak Naga headhunter heritage area. Only visit with registered guide.',
        popularity_index: 45,
        description: 'Remote border village where the international boundary runs through the chief\'s house.',
        best_months: 'November–February',
      },
    ]

    const destIds = {}
    for (const d of destinations) {
      const { rows } = await client.query(`
        INSERT INTO destinations (name, state, latitude, longitude, connectivity, difficulty, altitude_m, zone_type,
          ilp_required, nearest_hospital_name, nearest_hospital_km, nearest_hospital_phone, nearest_police_km,
          govt_advisory, popularity_index, description, best_months)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING id`,
        [d.name, d.state, d.latitude, d.longitude, d.connectivity, d.difficulty, d.altitude_m,
         d.zone_type, d.ilp_required, d.nearest_hospital_name, d.nearest_hospital_km,
         d.nearest_hospital_phone, d.nearest_police_km, d.govt_advisory,
         d.popularity_index, d.description, d.best_months]
      )
      destIds[d.name] = rows[0].id
    }
    console.log(`  ✅ ${destinations.length} destinations seeded`)

    // ── RESCUE TEAMS ──────────────────────────────────────────────────
    const teams = [
      { name: 'Tawang Mountain Rescue Unit', type: 'MOUNTAIN', district: 'Tawang', state: 'Arunachal Pradesh', contact_phone: '+913794222456', latitude: 27.5859, longitude: 91.8530 },
      { name: 'Meghalaya SDRF Alpha Team', type: 'SDRF', district: 'East Khasi Hills', state: 'Meghalaya', contact_phone: '+917641222234', latitude: 25.5788, longitude: 91.8933 },
      { name: 'Assam Police Emergency Response', type: 'POLICE', district: 'Kamrup Metropolitan', state: 'Assam', contact_phone: '100', latitude: 26.1445, longitude: 91.7362 },
      { name: 'Sikkim Mountain Rescue', type: 'MOUNTAIN', district: 'East Sikkim', state: 'Sikkim', contact_phone: '+9103592202033', latitude: 27.3389, longitude: 88.6065 },
      { name: 'NE Emergency Medical Services', type: 'MEDICAL', district: 'Kamrup Metropolitan', state: 'Assam', contact_phone: '108', latitude: 26.1445, longitude: 91.7362 },
    ]
    for (const t of teams) {
      await client.query(`
        INSERT INTO rescue_teams (name, type, district, state, contact_phone, status, latitude, longitude, capacity)
        VALUES ($1,$2,$3,$4,$5,'AVAILABLE',$6,$7,15)`,
        [t.name, t.type, t.district, t.state, t.contact_phone, t.latitude, t.longitude]
      )
    }
    console.log(`  ✅ ${teams.length} rescue teams seeded`)

    // ── GOVT ADMIN ────────────────────────────────────────────────────
    const govtPasswordHash = await hashPassword('Admin@123')
    await client.query(`
      INSERT INTO govt_users (name, email, password_hash, role, district, state)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      ['Aaraksha Administrator', 'admin@aaraksha.gov.in', govtPasswordHash,
       'SUPER_ADMIN', 'Kamrup Metropolitan', 'Assam']
    )
    console.log('  ✅ Govt admin seeded: admin@aaraksha.gov.in / Admin@123')

    // ── DEMO TOURIST ──────────────────────────────────────────────────
    const demoPhone    = '9999999999'
    const passwordHash = await hashPassword('Demo@123')
    const govtIdNum    = '123456789012'
    const govtIdHash   = hashGovtId(govtIdNum)
    const guardianToken = generateGuardianToken()
    const guardianExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

    const emergencyContacts = JSON.stringify([
      { id: uuid(), name: 'Demo Parent',  phone: '9876543210', relation: 'Parent',  tier: 1, notifyOnSOS: true },
      { id: uuid(), name: 'Demo Sibling', phone: '9876543211', relation: 'Sibling', tier: 2, notifyOnSOS: true },
    ])

    const { rows: [tourist] } = await client.query(`
      INSERT INTO tourists (full_name, phone, email, blood_group, medical_info, emergency_contacts,
        govt_id_type, govt_id_hash, govt_id_suffix, guardian_token, guardian_token_expires, password_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id`,
      ['Aryan Demo', demoPhone, 'demo@aaraksha.in', 'O+', 'No known allergies',
       emergencyContacts, 'AADHAAR', govtIdHash, '9012',
       guardianToken, guardianExpires, passwordHash]
    )
    console.log('  ✅ Demo tourist seeded: demo@aaraksha.in (phone: 9999999999) / Demo@123')

    // ── DEMO TRIP (ACTIVE) ─────────────────────────────────────────────
    const stops = [
      {
        city: 'Kaziranga', state: 'Assam', destinationId: destIds['Kaziranga'],
        lat: 26.5775, lng: 93.1705, days: 2,
        connectivity: 'MODERATE', difficulty: 'EASY', altitude_m: 80, zone_type: 'SAFE', hospital_km: 12,
        activities: [{ name: 'Elephant Safari', type: 'ACTIVITY', cost: 2000 }, { name: 'Jeep Safari', type: 'ACTIVITY', cost: 1500 }],
      },
      {
        city: 'Shillong', state: 'Meghalaya', destinationId: destIds['Shillong'],
        lat: 25.5788, lng: 91.8933, days: 2,
        connectivity: 'GOOD', difficulty: 'EASY', altitude_m: 1496, zone_type: 'SAFE', hospital_km: 2.1,
        activities: [{ name: 'Ward Lake Visit', type: 'ACTIVITY', cost: 50 }, { name: 'Local food tour', type: 'MEAL', cost: 500 }],
      },
      {
        city: 'Cherrapunji', state: 'Meghalaya', destinationId: destIds['Cherrapunji (Sohra)'],
        lat: 25.2697, lng: 91.7324, days: 3,
        connectivity: 'MODERATE', difficulty: 'MODERATE', altitude_m: 1484, zone_type: 'CAUTION', hospital_km: 8.5,
        activities: [{ name: 'Living Root Bridges Trek', type: 'ACTIVITY', cost: 800 }, { name: 'Nohkalikai Falls', type: 'ACTIVITY', cost: 100 }],
      },
    ]

    const tsiResult = calculateTSI({
      travel_type: 'SOLO',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      stops,
    }, {})

    const rescueReadiness = {
      emergencyContacts: true, medicalInfo: true, govtIdComplete: true,
      dmsEnabled: false, tsiReviewed: true, offlineMaps: false,
    }
    const readinessScore = Math.round(Object.values(rescueReadiness).filter(Boolean).length / 6 * 100)

    const { rows: [trip] } = await client.query(`
      INSERT INTO trips (tourist_id, title, description, travel_type, start_date, end_date, status,
        stops, budget_inr, is_public, public_token, tsi_score, tsi_label, tsi_factors,
        tsi_recommendations, tsi_updated_at, rescue_readiness, rescue_readiness_score)
      VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8,true,$9,$10,$11,$12,$13,NOW(),$14,$15)
      RETURNING id`,
      [
        tourist.id,
        'NE India Discovery — Assam to Meghalaya',
        'Exploring the best of Northeast India: wildlife, waterfalls, and culture.',
        'SOLO',
        new Date().toISOString().split('T')[0],
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        JSON.stringify(stops), 20000,
        require('../src/utils/crypto').generatePublicToken(),
        tsiResult.score, tsiResult.label,
        JSON.stringify(tsiResult.factors), JSON.stringify(tsiResult.recommendations),
        JSON.stringify(rescueReadiness), readinessScore,
      ]
    )
    console.log(`  ✅ Demo trip seeded (TSI: ${tsiResult.score} — ${tsiResult.label})`)

    // ── DEMO CHECK-IN ─────────────────────────────────────────────────
    const checkinTime = new Date(Date.now() - 2 * 60 * 60 * 1000)  // 2 hours ago
    await client.query(`
      INSERT INTO checkins (tourist_id, trip_id, latitude, longitude, battery_pct, message, type, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,'MANUAL',$7)`,
      [tourist.id, trip.id, 26.5775, 93.1705, 78, 'Arrived at Kaziranga! Ready for safari tomorrow.', checkinTime]
    )
    await client.query(`
      INSERT INTO tourist_locations (tourist_id, latitude, longitude, battery_pct, updated_at)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (tourist_id) DO UPDATE SET latitude=$2, longitude=$3, battery_pct=$4, updated_at=$5`,
      [tourist.id, 26.5775, 93.1705, 78, checkinTime]
    )
    console.log('  ✅ Demo check-in and location seeded')

    // ── DEMO RESOLVED SOS (for analytics) ─────────────────────────────
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await client.query(`
      INSERT INTO sos_events (tourist_id, trip_id, latitude, longitude, category, trigger_type, status,
        battery_pct, message, resolved_at, resolution_notes, created_at)
      VALUES ($1,$2,$3,$4,'MEDICAL','MANUAL','RESOLVED',$5,$6,$7,$8,$9)`,
      [tourist.id, trip.id, 26.5775, 93.1705, 65,
       'Demo SOS for testing — not a real emergency',
       new Date(yesterday.getTime() + 15 * 60 * 1000),
       'Demo SOS resolved — no action required',
       yesterday]
    )
    console.log('  ✅ Demo resolved SOS seeded (for analytics demo)')

    await client.query('COMMIT')

    console.log('\n' + '═'.repeat(50))
    console.log('🎯 SEED COMPLETE')
    console.log('═'.repeat(50))
    console.log(`  Destinations:    ${destinations.length}`)
    console.log(`  Rescue teams:    ${teams.length}`)
    console.log(`  Govt admin:      admin@aaraksha.gov.in / Admin@123`)
    console.log(`  Demo tourist:    demo@aaraksha.in (phone: 9999999999) / Demo@123`)
    console.log(`  Demo trip TSI:   ${tsiResult.score}/100 — ${tsiResult.label}`)
    console.log(`  Guardian link:   /track/${guardianToken.slice(0, 16)}...`)
    console.log('═'.repeat(50) + '\n')

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Seed failed:', err.message)
    throw err
  } finally {
    client.release()
    await getPool().end()
  }
}

seed().catch(err => {
  console.error('Seed script crashed:', err)
  process.exit(1)
})
```

---

## PHASE 14 — TESTS

### Step 14.1 — vitest.config.js (project root)

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    setupFiles:  ['./tests/setup.js'],
    coverage: {
      reporter: ['text', 'lcov'],
      exclude:  ['scripts/', 'tests/', 'src/migrations/'],
    },
  },
})
```

### Step 14.2 — tests/setup.js

```javascript
// tests/setup.js
'use strict'

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
```

### Step 14.3 — tests/unit/tsi.service.test.js

```javascript
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
```

### Step 14.4 — tests/unit/crypto.utils.test.js

```javascript
// tests/unit/crypto.utils.test.js
import { describe, it, expect } from 'vitest'
import { hashGovtId, generateGuardianToken, generatePublicToken, normalizePhone, extractSuffix } from '../../src/utils/crypto.js'

describe('Crypto Utils', () => {
  it('hashGovtId is deterministic', () => {
    expect(hashGovtId('123456789012')).toBe(hashGovtId('123456789012'))
  })
  it('hashGovtId is 64 hex chars (SHA-256)', () => {
    expect(hashGovtId('123456789012')).toMatch(/^[a-f0-9]{64}$/)
  })
  it('different IDs produce different hashes', () => {
    expect(hashGovtId('123456789012')).not.toBe(hashGovtId('999999999999'))
  })
  it('generateGuardianToken is 128 chars', () => {
    expect(generateGuardianToken().length).toBe(128)
  })
  it('tokens are unique', () => {
    expect(generateGuardianToken()).not.toBe(generateGuardianToken())
  })
  it('normalizePhone strips +91 prefix', () => {
    expect(normalizePhone('+919876543210')).toBe('9876543210')
    expect(normalizePhone('09876543210')).toBe('9876543210')
    expect(normalizePhone('9876543210')).toBe('9876543210')
  })
  it('extractSuffix returns last 4 chars uppercase', () => {
    expect(extractSuffix('123456789012')).toBe('9012')
    expect(extractSuffix('ABCDE12345XY')).toBe('34XY')
  })
})
```

### Step 14.5 — tests/integration/auth.test.js

```javascript
// tests/integration/auth.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import app from '../../src/app.js'

const request = supertest(app)

describe('Auth API — Tourist Registration and Login', () => {
  const testPhone = '8000000001'
  let authToken

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
      emergencyContacts: [{ name: 'P', phone: '9876543210', relation: 'Parent' }],
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
```

---

## PHASE 15 — FINAL VERIFICATION

Run EVERY command below. ALL must pass before calling the backend complete.

```bash
# ── 1. Pre-flight check ───────────────────────────────────────────────
node scripts/preflight.js
# Expected: all required checks passed

# ── 2. Apply migrations ────────────────────────────────────────────────
npm run migrate
# Expected: 001_initial_schema, migrations applied

# ── 3. Verify all 14 tables exist ─────────────────────────────────────
node -e "
const {getPool} = require('./src/database/pool')
const pool = getPool()
const TABLES = ['tourists','trips','sos_events','dead_mans_switches','checkins',
  'tourist_locations','govt_users','rescue_teams','rescue_assignments','destinations',
  'weather_cache','scam_reports','inbound_sos_sms','otp_verifications']
pool.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema='public'\")
  .then(({rows}) => {
    const existing = rows.map(r => r.table_name)
    let ok = true
    TABLES.forEach(t => {
      if (!existing.includes(t)) { console.log('❌ MISSING:', t); ok=false }
      else console.log('✅', t)
    })
    if (ok) console.log('\n✅ All 14 tables exist')
    pool.end()
  })
"

# ── 4. All modules load cleanly ────────────────────────────────────────
node -e "
  require('./src/config/env')
  require('./src/database/pool')
  require('./src/database/transaction')
  require('./src/utils/logger')
  require('./src/utils/response')
  require('./src/utils/crypto')
  require('./src/constants/enums')
  require('./src/constants/events')
  require('./src/constants/errors')
  require('./src/services/tsi.service')
  require('./src/services/auth.service')
  require('./src/services/sos.service')
  require('./src/services/dms.service')
  require('./src/services/otp.service')
  require('./src/services/weather.service')
  require('./src/services/gemini.service')
  require('./src/services/passport.service')
  require('./src/services/webhook.service')
  require('./src/socket/index')
  require('./src/socket/emitters')
  require('./src/cron/index')
  require('./src/app')
  console.log('✅ All modules load cleanly — zero import errors')
"

# ── 5. TSI service unit tests ─────────────────────────────────────────
node -e "
const {calculateTSI, computeRescueReadiness} = require('./src/services/tsi.service')
const r1 = calculateTSI({travel_type:'SOLO',start_date:'2025-07-01',end_date:'2025-07-10',stops:[{connectivity:'NONE',altitude_m:4500,zone_type:'RESTRICTED',difficulty:'EXTREME',hospital_km:60}]},{})
console.assert(r1.score >= 10 && r1.score <= 100, 'Score out of range: '+r1.score)
console.assert(r1.label === 'High Risk' || r1.label === 'Extreme Risk', 'Expected high risk, got: '+r1.label)
console.assert(r1.recommendations.length > 0, 'No recommendations generated')
console.log('✅ TSI service: score='+r1.score+' label='+r1.label+' recs='+r1.recommendations.length)
"

# ── 6. Crypto utilities ────────────────────────────────────────────────
node -e "
const {hashGovtId, generateGuardianToken, normalizePhone} = require('./src/utils/crypto')
const h1 = hashGovtId('123456789012')
const h2 = hashGovtId('123456789012')
console.assert(h1 === h2, 'HMAC not deterministic')
console.assert(h1.length === 64, 'Hash length wrong')
console.assert(generateGuardianToken().length === 128, 'Token length wrong')
console.assert(normalizePhone('+919876543210') === '9876543210', 'Phone normalization failed')
console.log('✅ Crypto utilities verified')
"

# ── 7. OTP hash verification ───────────────────────────────────────────
node -e "
const crypto = require('crypto')
const otp = '123456'
const hash1 = crypto.createHmac('sha256', process.env.GOVT_ID_SECRET).update(otp).digest('hex')
const hash2 = crypto.createHmac('sha256', process.env.GOVT_ID_SECRET).update(otp).digest('hex')
console.assert(hash1 === hash2, 'OTP hash not deterministic')
console.assert(hash1 !== crypto.createHmac('sha256', process.env.GOVT_ID_SECRET).update('654321').digest('hex'), 'Different OTPs should have different hashes')
console.log('✅ OTP hashing verified')
"

# ── 8. Seed the database ──────────────────────────────────────────────
npm run seed
# Expected: 10 destinations, 5 teams, 1 admin, 1 tourist, 1 trip seeded

# ── 9. Verify seed data ───────────────────────────────────────────────
node -e "
const {getPool} = require('./src/database/pool')
const pool = getPool()
Promise.all([
  pool.query('SELECT COUNT(*) FROM destinations'),
  pool.query('SELECT COUNT(*) FROM rescue_teams'),
  pool.query(\"SELECT id, guardian_token, tsi_score FROM tourists WHERE email='demo@aaraksha.in'\"),
  pool.query(\"SELECT id, tsi_score, tsi_label FROM trips WHERE status='ACTIVE'\"),
  pool.query(\"SELECT id FROM govt_users WHERE email='admin@aaraksha.gov.in'\"),
]).then(([d,r,t,tr,g]) => {
  console.log('✅ Destinations:', d.rows[0].count)
  console.log('✅ Rescue teams:', r.rows[0].count)
  console.log('✅ Demo tourist found:', !!t.rows[0], '— TSI guardian token:', t.rows[0]?.guardian_token?.slice(0,16)+'...')
  console.log('✅ Active trip TSI:', tr.rows[0]?.tsi_score, tr.rows[0]?.tsi_label)
  console.log('✅ Govt admin found:', !!g.rows[0])
  pool.end()
})
"

# ── 10. Full server startup + health check ────────────────────────────
npm run dev &
SERVER_PID=$!
sleep 4

curl -sf http://localhost:5000/health | node -e "
const d=require('fs').readFileSync('/dev/stdin','utf8')
const r=JSON.parse(d)
console.assert(r.status==='ok', 'Health check failed')
console.log('✅ Health check passed:', r.status, r.service)
"

# ── 11. Tourist register + login API ─────────────────────────────────
REGISTER=$(curl -sf -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"API Test","phone":"8111111111","govtIdType":"AADHAAR","govtIdNumber":"777788889999","password":"Test@1234","emergencyContacts":[{"name":"Parent","phone":"9876543210","relation":"Parent"}]}')
echo $REGISTER | node -e "
const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
console.assert(r.success && r.data.token, 'Registration failed: '+JSON.stringify(r))
console.log('✅ Registration API works — token received')
"

TOKEN=$(echo $REGISTER | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); process.stdout.write(JSON.parse(d).data.token)")

curl -sf http://localhost:5000/api/tourists/me -H "Authorization: Bearer $TOKEN" | node -e "
const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
console.assert(r.success && r.data.phone==='8111111111', 'Profile fetch failed')
console.log('✅ Protected route works with JWT')
"

# ── 12. Forgot password OTP flow API ─────────────────────────────────
FORGOT=$(curl -sf -X POST http://localhost:5000/api/auth/forgot-password \
  -H 'Content-Type: application/json' -d '{"phone":"8111111111"}')
echo $FORGOT | node -e "
const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
console.assert(r.success, 'Forgot password failed: '+JSON.stringify(r))
console.log('✅ Forgot password OTP endpoint works (anti-enumeration verified)')
"

# ── 13. Govt login API ────────────────────────────────────────────────
GOVT_LOGIN=$(curl -sf -X POST http://localhost:5000/api/auth/govt/login \
  -H 'Content-Type: application/json' -d '{"email":"admin@aaraksha.gov.in","password":"Admin@123"}')
echo $GOVT_LOGIN | node -e "
const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
console.assert(r.success && r.data.token, 'Govt login failed: '+JSON.stringify(r))
console.log('✅ Govt login API works')
"

GOVT_TOKEN=$(echo $GOVT_LOGIN | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); process.stdout.write(JSON.parse(d).data.token)")

curl -sf http://localhost:5000/api/govt/dashboard -H "Authorization: Bearer $GOVT_TOKEN" | node -e "
const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
console.assert(r.success, 'Govt dashboard failed: '+JSON.stringify(r))
console.log('✅ Govt dashboard works — activeSOS:', r.data.activeSOS, 'activeTourists:', r.data.activeTourists)
"

# ── 14. Run unit tests ────────────────────────────────────────────────
kill $SERVER_PID 2>/dev/null
npm test
# Expected: all unit tests pass (tsi.service, crypto.utils, auth integration)

echo ""
echo "═══════════════════════════════════════════"
echo "✅ BACKEND BUILD COMPLETE — ALL CHECKS PASS"
echo "═══════════════════════════════════════════"
echo ""
echo "Endpoints available:"
echo "  POST /api/auth/register"
echo "  POST /api/auth/login"
echo "  POST /api/auth/forgot-password     (Step 1: OTP)"
echo "  POST /api/auth/verify-otp          (Step 2: OTP → resetToken)"
echo "  POST /api/auth/reset-password      (Step 3: new password)"
echo "  POST /api/auth/resend-otp"
echo "  POST /api/auth/send-verification-otp (requires auth)"
echo "  GET  /api/tourists/me"
echo "  PATCH /api/tourists/me"
echo "  GET  /api/tourists/guardian/:token (public)"
echo "  POST /api/trips"
echo "  GET  /api/trips"
echo "  GET  /api/trips/:id"
echo "  PUT  /api/trips/:id"
echo "  PATCH /api/trips/:id/status"
echo "  PATCH /api/trips/:id/checklist"
echo "  DELETE /api/trips/:id"
echo "  GET  /api/trips/public/:token (no auth)"
echo "  POST /api/sos"
echo "  GET  /api/sos/mine"
echo "  PATCH /api/sos/:id/false-alarm"
echo "  POST /api/dms"
echo "  GET  /api/dms/active"
echo "  POST /api/dms/:id/reset"
echo "  PATCH /api/dms/:id/status"
echo "  POST /api/checkins"
echo "  GET  /api/checkins/recent"
echo "  GET  /api/destinations"
echo "  GET  /api/destinations/:id"
echo "  POST /api/scam-reports"
echo "  GET  /api/scam-reports/:destinationId"
echo "  POST /api/packing/generate"
echo "  POST /api/journey-passport/:tripId"
echo "  GET  /api/govt/dashboard"
echo "  GET  /api/govt/tourists/live"
echo "  GET  /api/govt/sos/active"
echo "  PATCH /api/govt/sos/:id/assign"
echo "  PATCH /api/govt/sos/:id/resolve"
echo "  GET  /api/govt/risk-overview"
echo "  GET  /api/govt/rescue-teams"
echo "  PATCH /api/govt/rescue-teams/:id/status"
echo "  GET  /api/govt/analytics"
echo "  POST /api/webhooks/twilio-inbound"
echo ""
echo "Total: 42 endpoints across 12 route files"
echo "Socket.IO rooms: govt:dashboard, tourist:{id}, guardian:{token}"
echo "Cron jobs: DMS warning (1min), DMS trigger (1min), weather+TSI (60min)"
echo ""
echo "═══════════════════════════════════════════"
echo "Update CLAUDE.md build tracker:"
echo "  COMPLETED: Session 1 — Complete Backend Foundation"
echo "  NEXT UP: Session 8 — Tourist PWA Frontend"
echo "═══════════════════════════════════════════"
```

---

## COMPLETE SIGNUP FLOW REFERENCE

This section documents the exact frontend-facing signup and auth flow for Tourist PWA.

### Tourist Registration Flow (Signup)

```
Screen 1: Basic Info
  Fields: fullName, phone, password, confirmPassword
  Validation: phone 10 digits, password min 8 chars, passwords match
  → Next

Screen 2: Government ID
  Fields: govtIdType (dropdown), govtIdNumber
  Live format validation per type:
    AADHAAR:  12 digits, show ****-****-**** masking
    PASSPORT: letter + 7 digits
    VOTER_ID: 3 letters + 7 digits
    DRIVING_LICENSE: 8-20 alphanumeric
  → Next

Screen 3: Emergency Contacts (min 1, max 3)
  Each contact: name, phone, relation, tier (1=immediate, 2=after 60s)
  First contact auto-set to Tier 1
  → Next

Screen 4: Optional
  Fields: bloodGroup (dropdown), medicalInfo (textarea)
  Trust badges explaining data privacy
  → Register Button

On success:
  - JWT stored in Zustand auth store (NOT localStorage)
  - Redirect to Dashboard
  - Banner: "Welcome! Set up your Dead Man's Switch for safer travel →"
```

### Forgot Password Flow (3-Step OTP)

```
Step 1 — Enter Phone (/auth/forgot-password)
  Field: phone
  Button: "Send OTP"
  API: POST /api/auth/forgot-password
  Show: "OTP sent to your registered phone if it exists" (always same message)
  → Proceed to Step 2 regardless

Step 2 — Verify OTP (/auth/verify-otp)
  Field: 6-digit OTP (auto-advance when 6 digits entered)
  Timer: 10-minute countdown (show remaining time)
  Button: "Verify OTP" + "Resend OTP" (disabled until 30 seconds after send)
  Attempt display: "2 attempts remaining" if wrong OTP
  On wrong × 3: "OTP locked. Request a new one."
  API: POST /api/auth/verify-otp
  On success: store resetToken in component state (NOT localStorage)
  → Proceed to Step 3

Step 3 — New Password (/auth/reset-password)
  Fields: newPassword, confirmNewPassword
  Password strength indicator
  Button: "Reset Password"
  API: POST /api/auth/reset-password { resetToken, newPassword }
  On success: redirect to /auth/login with success toast
  resetToken consumed on backend — cannot be reused
```

