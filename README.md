# Aaraksha — Smart Tourism, Safe Journey

**Tourist safety platform for Northeast India, built for Smart India Hackathon 2025.**

Aaraksha addresses a specific problem: Northeast India draws a growing number of domestic and
international tourists into terrain where connectivity is unreliable, medical response is far
away, and neither travelers nor authorities have a shared, real-time picture of who is where and
how much risk they're carrying. The platform is three cooperating surfaces — a tourist-facing
planning and safety app, a government operations dashboard, and a no-login family tracking
link — backed by one Express/PostgreSQL API.

> **Status:** the backend (all 15 build phases) is complete, tested, and hardened against
> adversarial input — see [Current State](#current-state) below. The three frontends are
> specified but not yet implemented.

---

## Table of contents

- [Current state](#current-state)
- [How it works](#how-it-works)
- [Architecture at a glance](#architecture-at-a-glance)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [NPM scripts](#npm-scripts)
- [API surface](#api-surface)
- [Testing](#testing)
- [Production readiness](#production-readiness)
- [Documentation map](#documentation-map)
- [Roadmap](#roadmap)

---

## Current state

| Layer | Status | Evidence |
|---|---|---|
| Backend API (45 endpoints, 14 tables) | ✅ Complete | `backend/src/` — 15 build phases, see commit history |
| Automated tests | ✅ Passing | `vitest` unit + integration suite in `backend/tests/` |
| API contract tests | ✅ 209/209 passing | Postman collection in `backend/postman/`, run via Newman |
| Adversarial / robustness testing | ✅ Done, 5 bugs fixed | [`PRODUCTION_READINESS_REPORT.html`](./PRODUCTION_READINESS_REPORT.html) |
| Tourist PWA (`frontend/tourist`) | ⬜ Not started | Spec: [`UI_GUIDE.md`](./UI_GUIDE.md) |
| Government Command Center (`frontend/govt`) | ⬜ Not started | Spec: [`UI_GUIDE.md`](./UI_GUIDE.md) |
| Guardian Portal (`frontend/guardian`) | ⬜ Not started | Spec: [`UI_GUIDE.md`](./UI_GUIDE.md) |

The backend was not just built to spec — it was adversarially tested afterward: rate-limit
bypass attempts, SQL injection payloads, concurrent double-resolve races on live SOS events, a
deliberately-forced transaction rollback, and simulated external-service outages (Twilio,
Gemini, OpenWeatherMap all unconfigured). Five real defects surfaced this way and were fixed;
the findings are documented in full in the production readiness report linked above, not just
summarized.

---

## How it works

Three pillars, one data model:

- **Planning** — itineraries with multi-stop routes, AI-generated packing lists (Gemini, with a
  static offline fallback when the API is unavailable), budget tracking.
- **Safety** — one-tap SOS, a Dead Man's Switch that auto-fires an SOS if a tourist misses a
  check-in, scheduled check-ins, and a rule-based Travel Safety Index (TSI) that scores a trip
  0–100 from route difficulty, connectivity, altitude, season, and live weather.
- **Government** — a real-time operations map (Socket.IO), rescue team assignment, district risk
  overview, and post-incident analytics.

A fourth mechanism ties planning and safety together for people who don't have the app: **Offline
SOS**. A tourist without data coverage can send a structured SMS
(`AARAKSHA_SOS|ID:...|LAT:...|LNG:...|CAT:...|BATT:...|TIME:...`) to a Twilio number; an inbound
webhook parses it and creates a full SOS event exactly as if it came through the API.

---

## Architecture at a glance

```
                     ┌─────────────────┐
                     │   PostgreSQL     │  14 tables — see DB_GUIDE.md
                     │   (raw pg pool)  │
                     └────────▲─────────┘
                              │ parameterized SQL only
                     ┌────────┴─────────┐
                     │  Express API      │  Route → Middleware → Controller
                     │  (backend/)       │  → Service → Repository
                     │  JWT + RBAC       │
                     └───┬─────────┬────┘
              Socket.IO  │         │  REST (JSON)
              real-time  │         │
        ┌─────────────────┘         └─────────────────┐
        ▼                                              ▼
┌───────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Tourist PWA    │   │ Govt Command      │   │ Guardian Portal   │
│ (planned)      │   │ Center (planned)  │   │ (planned)         │
│ offline-first  │   │ dark ops theme    │   │ token in URL,     │
│ IndexedDB sync │   │ Leaflet live map  │   │ no login required │
└───────────────┘   └──────────────────┘   └──────────────────┘
```

**Backend stack:** Node.js ≥20 · Express · PostgreSQL (raw `pg`, no ORM) · JWT + bcrypt ·
Socket.IO · node-cron · Twilio (outbound SMS + inbound webhook) · Google Gemini · PDFKit ·
Zod validation · pino structured logging.

**Planned frontend stack** (locked in [`Architecture.md`](./Architecture.md), not yet built):
Vite ≥5 · React ≥18 · TypeScript ≥5 · Tailwind 3.x · shadcn/ui · Zustand · TanStack Query v5 ·
Dexie.js (IndexedDB, tourist offline sync) · react-leaflet (govt live map).

Every layer is intentionally narrow: controllers hold no SQL or business logic, all queries live
in repositories, and every multi-table write that must be atomic goes through a single
`withTransaction()` helper (six call sites — SOS creation, DMS reset, DMS auto-trigger, rescue
assignment, SOS resolution, inbound-SMS processing). The full mechanism, traced from the actual
source, is diagrammed in the [production readiness report](./PRODUCTION_READINESS_REPORT.html).

---

## Repository layout

```
Aaraksha/
├── README.md                        this file
├── Architecture.md                  locked tech stack, naming, directory conventions
├── API_GUIDE.md                     HTTP verbs, error codes, response envelope
├── DB_GUIDE.md                      table definitions, relationships, query rules
├── UI_GUIDE.md                      design tokens, components, offline strategy
├── PRODUCTION_READINESS_REPORT.html architecture dossier + adversarial-testing findings
│
└── backend/
    ├── src/
    │   ├── app.js                   Express app: middleware chain, routes, error handler
    │   ├── server.js                HTTP server, Socket.IO init, graceful shutdown
    │   ├── config/                  env validation, CORS, Gemini/Twilio clients
    │   ├── constants/                enums, error messages, socket event names
    │   ├── routes/                  11 route modules → controllers
    │   ├── controllers/             thin HTTP handlers
    │   ├── services/                business logic, transaction boundaries
    │   ├── repositories/            all SQL, parameterized, one per table cluster
    │   ├── middleware/               auth (JWT), validate (Zod), rate limiting, errors
    │   ├── validators/               Zod schemas per domain
    │   ├── socket/                  Socket.IO init + typed emitters
    │   ├── cron/                    DMS warning/trigger (1 min), weather+TSI (hourly)
    │   ├── database/                connection pool, transaction helper
    │   └── migrations/               node-pg-migrate schema (14 tables)
    ├── scripts/
    │   ├── preflight.js              env/DB connectivity check before setup
    │   └── seed.js                   idempotent demo data (--reset flag available)
    ├── tests/                       vitest unit + integration suite
    ├── postman/                     Postman collection + environment (93 requests)
    ├── .env.example                  every required env var, documented
    └── package.json
```

---

## Getting started

### Prerequisites

- Node.js ≥ 20
- PostgreSQL ≥ 15 (needs `pgcrypto` for `gen_random_uuid()` — the migration enables it)
- npm

### 1. Clone and install

```bash
git clone https://github.com/aryanf192811-eng/Aaraksha.git
cd Aaraksha/backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` at minimum. `JWT_SECRET`, `GOVT_ID_SECRET`, and `GUARDIAN_SECRET` need
real random values (not the placeholders) even for local development, since they're used to sign
tokens and hash government IDs. Twilio, Gemini, and OpenWeatherMap keys are **optional** — every
integration degrades gracefully when unset (see [Production readiness](#production-readiness)).

### 3. Set up the database

```bash
npm run preflight     # verifies DATABASE_URL is reachable before anything else runs
npm run migrate       # applies the 14-table schema
npm run seed          # idempotent demo data — safe to re-run
```

Or all three in one shot: `npm run setup`.

### 4. Run it

```bash
npm run dev            # nodemon, auto-restart
# or
npm start               # plain node
```

The server starts on `PORT` (default `5000`) and logs `GET /health → {"status":"ok"}` once ready.
Socket.IO and the cron jobs (DMS warning/trigger, hourly weather+TSI) start automatically.

---

## Environment variables

Every variable the backend reads is documented with a placeholder in
[`backend/.env.example`](./backend/.env.example). Categories:

| Category | Required? | Notes |
|---|---|---|
| `DATABASE_URL`, `DATABASE_TEST_URL` | **Required** | PostgreSQL connection strings |
| `PORT`, `NODE_ENV` | **Required** | `NODE_ENV=production` in real deployments — gates stack traces out of error responses |
| `TOURIST_FRONTEND_URL`, `GOVT_FRONTEND_URL`, `GUARDIAN_FRONTEND_URL` | **Required** | CORS allowlist |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | **Required** | Sign tourist/govt tokens |
| `GOVT_ID_SECRET`, `GUARDIAN_SECRET`, `BCRYPT_ROUNDS` | **Required** | Government-ID hashing, guardian token generation |
| `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_MAX`, `WEBHOOK_RATE_LIMIT_MAX` | **Required** | Tunable; auth routes use a tighter budget than general traffic |
| `TWILIO_*` | Optional | SMS no-ops (`sent: false`) when unset — SOS and DMS flows are unaffected |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional | Packing-list generation falls back to a static checklist when unset |
| `OWM_API_KEY`, `OWM_BASE_URL`, `OWM_CACHE_TTL_MINUTES` | Optional | TSI calculation proceeds without the weather factor when unset |
| `LOG_LEVEL` | Optional | pino log level (`debug` in dev) |

Never commit a real `.env` — it's excluded by [`.gitignore`](./.gitignore).

---

## NPM scripts

Run from `backend/`:

| Script | What it does |
|---|---|
| `npm start` | Start the server (`node src/server.js`) |
| `npm run dev` | Start with nodemon (auto-restart on file change) |
| `npm run preflight` | Verify env vars and DB connectivity before setup |
| `npm run migrate` | Apply pending migrations |
| `npm run migrate:down` | Roll back the last migration |
| `npm run migrate:create <name>` | Scaffold a new migration |
| `npm run seed` | Seed demo data (idempotent) |
| `npm run seed:reset` | Wipe all tables, then reseed |
| `npm run setup` | `preflight` → `migrate` → `seed` in sequence |
| `npm test` | Run the vitest suite once |
| `npm run test:watch` | Run vitest in watch mode |
| `npm run test:coverage` | Run vitest with coverage report |

---

## API surface

45 REST endpoints across 11 route groups, all under `/api`:

| Prefix | Covers |
|---|---|
| `/auth` | Tourist + govt registration/login, forgot-password OTP flow, phone verification |
| `/tourists` | Profile, emergency contacts, public guardian view |
| `/trips` | Itinerary CRUD, stops, TSI score |
| `/sos` | Create SOS, history, mark false alarm |
| `/dms` | Dead Man's Switch create/reset/status |
| `/checkins` | Manual check-ins |
| `/destinations` | Destination catalog, weather cache |
| `/scam-reports` | Community-reported scam incidents |
| `/packing` | AI-generated packing checklists |
| `/journey-passport` | PDF trip summary generation |
| `/govt` | Dashboard, live tourists, risk overview, SOS assignment/resolution, rescue teams, analytics |
| `/webhooks` | Twilio inbound SMS (offline SOS) |

Full request/response contracts, status codes, and the response envelope shape are in
[`API_GUIDE.md`](./API_GUIDE.md). A ready-to-run Postman collection covering all of the above
(93 requests, 209 assertions) is in `backend/postman/`.

---

## Testing

Two independent test layers, both currently green:

**Unit + integration (vitest)**
```bash
cd backend
npm test
```
Covers pure logic (TSI scoring, crypto utilities) and integration flows (auth) against
`DATABASE_TEST_URL`.

**API contract tests (Postman/Newman)**
```bash
cd backend
npx newman run postman/aaraksha-collection.json -e postman/aaraksha-environment.json
```
93 requests across 18 folders, 209 assertions, last verified 209/209 passing after the
robustness-testing fixes (see below). Requires a running server (`npm run dev` in another
terminal) and a freshly seeded database — the collection creates and mutates real data.

---

## Production readiness

Passing the test suite proves the API matches its contract. It doesn't prove the API survives
someone actively trying to break it. After the contract tests passed, the backend went through a
second, adversarial pass — real payloads fired at a live server, not code review:

- **Rate limiting** — burst traffic against `/login`; found the limiter was defined but never
  wired to a route, then found a second bug (a shared limiter instance draining budget across
  unrelated routes) after fixing the first. Both fixed.
- **SQL injection** — `' OR 1=1 --`, `DROP TABLE`, `UNION SELECT` against login/search/profile
  fields. Held — parameterized queries throughout.
- **Concurrency** — two parallel `PATCH /govt/sos/:id/resolve` requests on the same SOS both
  returned 200 before the fix, silently clobbering each other's resolution notes. Fixed with an
  atomic DB-level guard; re-verified live (one 200, one clean 400).
- **Transaction rollback** — deliberately forced a mid-transaction foreign-key violation;
  confirmed the preceding insert did not survive the rollback.
- **External service failure** — Twilio, Gemini, and OpenWeatherMap all unconfigured in this
  environment; confirmed every integration degrades gracefully (SMS no-ops, packing list falls
  back to a static checklist, TSI proceeds without the weather factor) rather than failing the
  request.
- **Large payloads** — Express's 10MB body limit correctly rejects oversized requests.
- **Malformed input** — a SQLi-shaped string in a phone field crashed with an unhandled 500
  before the fix (Zod checked length, not format); now a clean 400.

Five real defects were found and fixed this way. The full findings, plus 13 hand-drawn diagrams
tracing the actual request pipeline, transaction boundaries, SOS/DMS/TSI lifecycles, and
Socket.IO event flow from the real source code, are in
**[`PRODUCTION_READINESS_REPORT.html`](./PRODUCTION_READINESS_REPORT.html)** — open it directly
in a browser.

---

## Documentation map

| Document | Read it when |
|---|---|
| [`Architecture.md`](./Architecture.md) | You're making a stack, naming, or directory-structure decision |
| [`API_GUIDE.md`](./API_GUIDE.md) | You're calling or adding an endpoint |
| [`DB_GUIDE.md`](./DB_GUIDE.md) | You're writing a query or touching the schema |
| [`UI_GUIDE.md`](./UI_GUIDE.md) | You're building one of the three frontends |
| [`PRODUCTION_READINESS_REPORT.html`](./PRODUCTION_READINESS_REPORT.html) | You want to understand how the backend actually behaves — architecture diagrams + adversarial-testing evidence |

---

## Roadmap

The backend is done. Remaining:

- [ ] Tourist PWA — 12 screens, offline-first with IndexedDB sync
- [ ] Government Command Center — dark ops dashboard, Leaflet live map
- [ ] Guardian Portal + Digital Journey Passport PDF (9 sections)
- [ ] Service worker + final seed-data pass for demo

---

*Built for Smart India Hackathon 2025 — Travel & Tourism track.*
