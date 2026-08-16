# Architecture Guide — Aaraksha

> Read this at the start of every session involving stack choices, security, naming, or directory structure.

---

## MINIMUM SUPPORTED VERSIONS

| Runtime / Library | Minimum | Notes |
|-------------------|---------|-------|
| Node.js | >=20 | Use LTS releases only |
| React | >=18 | Concurrent features required |
| Tailwind CSS | 3.x | Do not upgrade to v4 without team approval |
| TypeScript | >=5.0 | Strict mode enabled |
| Vite | >=5.0 | Frontend bundler for all portals |
| PostgreSQL | >=15 | jsonb, gen_random_uuid() must be available |

> Never pin exact patch versions in CLAUDE.md. Let `package.json` lock them.

---

## TECH STACK — LOCKED

### Backend (`backend/`)

```
Node.js >=20     ·  Express.js       ·  PostgreSQL (raw pg pool)
JWT              ·  bcryptjs (24h)   ·  Socket.IO
node-cron        ·  Twilio (outbound + INBOUND webhook)
Gemini API       ·  PDFKit           ·  Multer
dotenv           ·  pino             ·  pino-pretty
```

### Frontend (`frontend/tourist` | `frontend/govt` | `frontend/guardian`)

```
Vite >=5        ·  React >=18       ·  TypeScript >=5.0
Tailwind 3.x    ·  shadcn/ui        ·  React Router v6
Zustand         ·  TanStack Query v5·  React Hook Form
axios           ·  Dexie.js         ·  react-leaflet
Recharts        ·  vite-plugin-pwa
```

---

## PACKAGE POLICY

### ❌ Forbidden — never use, never suggest

| Package | Reason |
|---------|--------|
| Redux / Redux Toolkit | Zustand is the standard |
| MobX | Zustand is the standard |
| Prisma / Sequelize / TypeORM | Raw pg pool only |
| PostGIS | Standard PostgreSQL only |
| Chakra UI / MUI / Ant Design / Bootstrap | shadcn/ui + Tailwind only |
| Capacitor | PWA-only, no native bridge |
| localStorage / sessionStorage | Dexie.js (IndexedDB) only |
| class-based React components | Functional + hooks only |
| blockchain libs | Out of scope |

### ⚠️ Avoid — allowed only with explicit team/mentor approval

| Package | Why it needs approval |
|---------|----------------------|
| Redis | Adds infra complexity; pg is sufficient at demo scale |
| BullMQ / RabbitMQ / Kafka | Overkill for hackathon; node-cron covers DMS |
| Docker Swarm / Kubernetes | Demo runs on a single machine |
| WebSockets (raw) | Socket.IO already abstracts this |
| Any new UI library | Stack is already decided |

> If a genuinely useful package falls into "Avoid", stop and ask before proceeding.

---

## DIRECTORY STRUCTURE

```
aaraksha/
├── CLAUDE.md
├── Architecture.md
├── API_GUIDE.md
├── DB_GUIDE.md
├── UI_GUIDE.md
├── backend/
│   ├── src/
│   │   ├── app.js                     ← Express app + router mounting
│   │   ├── server.js                  ← HTTP server + Socket.IO init
│   │   ├── database/
│   │   │   └── pool.js                ← pg Pool (export: pool)
│   │   ├── routes/                    ← auth · tourist · trip · sos · dms
│   │   │                                checkin · govt · webhook · scam
│   │   ├── controllers/               ← one file per route group
│   │   ├── middleware/
│   │   │   ├── auth.js                ← authenticateTourist(), authenticateGovt()
│   │   │   └── errorHandler.js        ← global Express error handler
│   │   ├── services/
│   │   │   ├── tsi.service.js         ← calculateTSI(trip, stops) → score object
│   │   │   ├── notification.service.js← Twilio wrapper (always try/catch)
│   │   │   ├── weather.service.js     ← OWM fetcher → upsert weather_cache
│   │   │   └── gemini.service.js      ← generatePackingList(...)
│   │   ├── socket/
│   │   │   └── index.js               ← Socket.IO rooms + all event emitters
│   │   ├── cron/
│   │   │   └── index.js               ← DMS cron (1min) + weather cron (60min)
│   │   └── utils/
│   │       ├── response.js            ← sendSuccess · sendError · sendPaginated
│   │       └── logger.js              ← pino structured logger
│   ├── sql/
│   │   └── schema.sql             ← full 13-table schema (read before any DB work)
│   ├── scripts/
│   │   └── seed.js                ← 30 destinations, 15 hospitals, demo tourist
│   ├── postman/               ← exported Postman collections per domain
│   └── package.json
│
├── frontend/
│   ├── tourist/               ← Mobile-first PWA, amber theme
│   │   └── src/
│   │       ├── pages/             ← 12 screens
│   │       ├── components/
│   │       │   └── ui/            ← shadcn/ui (never modify internals)
│   │       ├── hooks/             ← useAuth · useTSI · useSOS · useDMS · useOfflineSync
│   │       ├── store/             ← auth.store · trip.store · safety.store
│   │       ├── api/               ← client.ts + domain API files
│   │       ├── types/             ← shared TypeScript interfaces
│   │       └── lib/
│   │           ├── db.ts          ← Dexie.js schema
│   │           └── utils.ts       ← cn() + formatters
│   ├── govt/                  ← Dark ops dashboard, slate-900 theme
│   │   └── src/
│   │       ├── pages/             ← Dashboard · RiskOverview · LiveMap · SOSManagement · Analytics
│   │       ├── components/
│   │       ├── types/
│   │       └── api/
│   ├── guardian/              ← Public token-based, status-focused
│   │   └── src/
│   │       └── pages/             ← TrackingPage (status + map + timeline + ETA)
│   └── volunteer/             ← Govt-verified local responders, teal theme
│       └── src/
│           └── pages/             ← AuthPage · HomePage (status toggle + live alerts + points)
```

---

## NAMING CONVENTIONS

Consistency is mandatory across the entire codebase.

| Context | Convention | Example |
|---------|------------|---------|
| JS/TS variables | `camelCase` | `touristId`, `tsiScore` |
| JS/TS functions | `camelCase` | `calculateTSI()`, `sendSMS()` |
| React components | `PascalCase` | `SOSButton`, `TSIBadge`, `DMSCard` |
| React hooks | `camelCase` prefixed `use` | `useSOS`, `useOfflineSync` |
| Zustand stores | `camelCase` + `.store.ts` | `auth.store.ts`, `trip.store.ts` |
| API domain files | `camelCase` + `.api.ts` | `sos.api.ts`, `trip.api.ts` |
| Folders | `kebab-case` | `rescue-teams/`, `dead-mans-switch/` |
| Database tables | `snake_case` | `sos_events`, `dead_mans_switches` |
| Database columns | `snake_case` | `tourist_id`, `tsi_score`, `next_trigger_at` |
| Environment variables | `SCREAMING_SNAKE_CASE` | `JWT_SECRET`, `OWM_API_KEY` |
| CSS classes | Tailwind utilities only | No custom class names unless in `@layer` |

---

## STATE MANAGEMENT

Each type of state has exactly one home. Do not mix them.

| State Type | Tool | Scope |
|------------|------|-------|
| Global app state (auth, active trip) | **Zustand** | Cross-component |
| Server data (fetching, caching, mutations) | **TanStack Query v5** | API responses |
| Form state | **React Hook Form** | Within a form component |
| Local UI state (modal open, tab index) | **useState** | Within one component |
| Offline data | **Dexie.js** | IndexedDB persistence |

**Rule:** If you find yourself putting server data into a Zustand store, stop. That belongs in TanStack Query.

---

## SECURITY

Every backend must include all of the following:

```js
// app.js — required middleware (in this order)
import helmet from 'helmet'             // Security headers
import rateLimit from 'express-rate-limit' // Rate limiting
import cors from 'cors'                 // CORS whitelist from FRONTEND_URL env

// Rate limit config
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
})

// Auth rules
// - JWT tokens expire in 24h
// - bcrypt rounds: 12
// - JWT secret must be >=32 chars (validated at startup)
// - Govt users and tourist users have separate JWT payloads

// File upload rules (Multer)
// - Max file size: 5MB
// - Allowed types: image/jpeg, image/png, image/webp
// - Store in /uploads/, never serve directly without auth check

// Input validation
// - Validate all request body fields in the controller before hitting the DB
// - Use a validation helper or inline checks — not in the route file
```

**Parameterized SQL is mandatory.** No exceptions.

---

## LOGGING RULES

All logging via pino. Zero `console.log` anywhere.

```js
logger.info({ touristId, tripId }, 'SOS triggered')
logger.error({ err, sosId }, 'SMS dispatch failed')
logger.warn({ dmsId }, 'DMS warning sent')
```

### NEVER log the following fields (mask or omit)

| Field | Why |
|-------|-----|
| passwords / password hashes | Credential exposure |
| JWT tokens | Auth bypass risk |
| phone numbers | PII |
| Govt ID numbers | Sensitive PII |
| OTP codes | Auth bypass risk |
| API keys (Twilio, Gemini, OWM) | Credential exposure |
| Full GPS coordinates at DEBUG level | Privacy |

```js
// WRONG
logger.info({ body: req.body }, 'Login attempt') // may contain password

// CORRECT
logger.info({ email: req.body.email }, 'Login attempt')
```

---

## TSI CALCULATION RULES

The TSI engine lives **only** in `tsi.service.js`. No AI involved.

```js
// calculateTSI(trip, stops) returns:
{
  score: 0-100,
  label: 'Low Risk' | 'Moderate Risk' | 'High Risk' | 'Extreme Risk',
  factors: {
    weather:     number, // from weather_cache (cron-fetched, not inline)
    connectivity: number,
    terrain:     number,
    medical:     number, // hospital_km from destinations
    travelType:  number,
    season:      number,
  },
  recommendations: string[]
}
// Scoring rule: worst stop drives the score (never average)
// Label thresholds: >=80 Low · 60-79 Moderate · 40-59 High · <40 Extreme
```

---

## SOCKET.IO ROOMS & EVENTS

```js
// Rooms
'govt-dashboard'          // Joined by authenticated govt users only (JWT verified on connect)
`tourist-${touristId}`   // Joined by tourist on login
`guardian-${guardianToken}` // Joined by guardian page on load (no auth)

// Events emitted (always through io instance, never direct socket)
io.to('govt-dashboard').emit('SOS_RECEIVED',    { sos, tourist, destination })
io.to('govt-dashboard').emit('SOS_RESOLVED',    { sosId, resolvedBy, timestamp })
io.to('govt-dashboard').emit('RESCUE_ASSIGNED', { sosId, team })
io.to('govt-dashboard').emit('DMS_TRIGGERED',   { touristId, dmsId, location })
io.to(`tourist-${touristId}`).emit('TSI_UPDATED',    { tsiScore, tsiLabel })
io.to(`guardian-${guardianToken}`).emit('CHECKIN_UPDATE', { location, battery, eta })
```
