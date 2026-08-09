# 🛡️ Aaraksha — Smart Tourism, Safe Journey

**A tourist-safety platform for Northeast India, built for Smart India Hackathon 2025.**

> *Aaraksha* (आराक्षा) — "protection." Not a translation exercise: it's the one-word summary of
> what every screen in this system is trying to do.

[![Status](https://img.shields.io/badge/status-demo--ready-brightgreen)]()
[![Portals](https://img.shields.io/badge/portals-3-blue)]()
[![API](https://img.shields.io/badge/API%20endpoints-66-orange)]()
[![Tables](https://img.shields.io/badge/DB%20tables-19-orange)]()
[![Offline SOS](https://img.shields.io/badge/offline%20SOS-2G%20capable-red)]()
[![Track](https://img.shields.io/badge/SIH%202025-Travel%20%26%20Tourism-purple)]()

---

## The pitch, in one paragraph

Northeast India pulls a growing number of tourists into terrain most safety apps were never
built for: 3000m mountain passes, zero-connectivity valleys, single-lane approach roads, and
districts where the nearest hospital is a two-hour drive. Existing tourism apps stop at
itinerary planning. Existing safety apps assume a phone signal. Aaraksha is built on the
opposite assumption — **that the moment someone needs help is exactly the moment their phone
stops being reliable** — and designs every safety mechanism backward from there: SOS that works
over SMS with zero data, a Dead Man's Switch that fires *for* you if you go silent, and a
government command center watching the same live picture the tourist sees, tied together by one
real-time data model instead of three disconnected apps.

<p align="center">
  <img src="./docs/screenshots/tourist-landing.png" alt="Aaraksha tourist app landing page" width="100%">
</p>

---

## Table of contents

- [Building the presentation](#building-the-presentation)
- [Why this wins](#why-this-wins)
- [Three portals, one system](#three-portals-one-system)
- [Feature walkthrough](#feature-walkthrough)
- [Screenshots](#screenshots)
- [Architecture at a glance](#architecture-at-a-glance)
- [By the numbers](#by-the-numbers)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [API surface](#api-surface)
- [Testing](#testing)
- [Production readiness](#production-readiness)
- [Documentation map](#documentation-map)
- [Roadmap](#roadmap)

---

## Building the presentation

This README is written so a slide deck can be built straight off it — every section below maps
to one slide's worth of content, in the order a pitch actually flows. Screenshots are real,
captured from the running app (`docs/screenshots/`), not mockups — drop them straight into
slides.

| # | Slide | Pull from | Notes |
|---|---|---|---|
| 1 | **Title** | The H1 + tagline at the top of this file | "Safety that keeps working after the signal drops" is the whole pitch in one line — use it as the deck's title or opening line |
| 2 | **The problem** | [The pitch, in one paragraph](#the-pitch-in-one-paragraph) | Lead with terrain, not tech: 3048m passes, zero-signal valleys, two-hour hospital drives |
| 3 | **Our bet / thesis** | The pitch paragraph above | One line: *"the moment someone needs help is exactly the moment their phone stops being reliable."* Everything else on the following slides proves this line |
| 4 | **Three portals** | [Three portals, one system](#three-portals-one-system) table + `tourist-landing.png`, `govt-dashboard.png`, `guardian-portal.png` | One slide, three screenshots side by side — this alone shows more scope than most competing teams |
| 5 | **Live demo / walkthrough script** | [Demo accounts](#demo-accounts) | Don't demo a blank app — log into **Rahul Verma** (`9876500002` / `Demo@123`) to show a *live SOS with a rescue team already en route*, then open his Guardian link to show the same emergency from a family member's view. That one flow sells the whole platform in 90 seconds |
| 6 | **Feature highlights** | [Feature walkthrough](#feature-walkthrough) — pick 2–3 lines per pillar, don't read the whole list | Planning → Safety → Government Ops → Community → Offline-first. Safety is the pillar to spend the most slide time on |
| 7 | **Numbers** | [By the numbers](#by-the-numbers) | Drop the whole table on one slide as a stat grid — 66 endpoints, 19 tables, 45 rotating news items land better as bold numbers than as prose |
| 8 | **Why we win** | [Why this wins](#why-this-wins) comparison table | This table is already written as a "typical hackathon app vs. Aaraksha" comparison — use it verbatim as a two-column slide |
| 9 | **Under the hood** *(for technical judges)* | [Architecture at a glance](#architecture-at-a-glance) diagram + [Production readiness](#production-readiness) | Keep this slide for a technical Q&A round — the adversarial-testing bullet points (SQLi, race conditions, forced rollbacks) are the strongest "we didn't just make a demo" evidence in the whole repo |
| 10 | **What's next** | [Roadmap](#roadmap) | The Volunteer SOS network item is deliberately scoped as "pitched, not built" — say that explicitly, it reads as intentional scoping rather than an unfinished feature |

---

## Why this wins

| What most hackathon safety apps ship | What Aaraksha ships |
|---|---|
| A static "call police" button | A rule-based Travel Safety Index recalculated **hourly from live weather**, scored per destination |
| Safety features that assume signal | **Offline SOS over raw SMS** — no data connection required, a Twilio webhook does the rest |
| One app, one audience | **Three cooperating portals** — tourist, government, and a no-login family tracking link — sharing one data model in real time |
| A mocked/seeded demo that falls apart under a second click | A backend that was **adversarially attacked after launch** — rate-limit bypass attempts, SQLi payloads, concurrent double-resolve races, forced transaction rollbacks — and fixed, not just tested |
| Safety as an isolated feature | Safety **woven into planning** — every trip gets a TSI score before it's even booked, every destination card carries a live risk badge |
| A single "it's a demo" happy path | **Four live demo accounts**, each mid-scenario: an active SOS with a rescue team en route, a running Dead Man's Switch, a completed trip ready for PDF export, a fresh account to show onboarding |

---

## Three portals, one system

```
                     ┌──────────────────┐
                     │   PostgreSQL      │  19 tables — raw pg, no ORM
                     │   parameterized   │  see DB_GUIDE.md
                     │   SQL only        │
                     └────────▲──────────┘
                              │
                     ┌────────┴──────────┐
                     │  Express API       │  Route → Middleware → Controller
                     │  (backend/)        │  → Service → Repository
                     │  JWT + RBAC        │  66 endpoints · 13 route groups
                     └───┬─────────┬─────┘
              Socket.IO  │         │  REST (JSON)
              real-time  │         │
        ┌─────────────────┘         └─────────────────┐
        ▼                                              ▼
┌────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ 🧭 Tourist PWA  │   │ 🖥️ Govt Command    │   │ 👪 Guardian Portal │
│  :5173          │   │    Center — :5174  │   │    :5175           │
│  amber · mobile │   │  emerald · desktop │   │  token-in-URL,     │
│  offline-first  │   │  live ops map      │   │  zero login        │
└────────────────┘   └───────────────────┘   └───────────────────┘
```

| Portal | Who | What they see |
|---|---|---|
| **Tourist PWA** | The traveler | Plan trips with a real Travel Safety Index, one-tap and gesture-triggered SOS, a Dead Man's Switch, curated destination news, community reviews, and a printable Digital Journey Passport |
| **Govt Command Center** | District officers, dispatchers, checkpoint officers | A live map of every active tourist, SOS triage with one-tap rescue assignment, district-level risk overview, QR checkpoint scanning, and incident analytics with PDF export |
| **Guardian Portal** | Family and friends | A single shared link — no account, no app install — showing live location, SOS state, battery, and medical info, auto-refreshing every 30 seconds |

<table>
<tr>
<td width="33%"><img src="./docs/screenshots/tourist-dashboard.png" alt="Tourist PWA dashboard"></td>
<td width="33%"><img src="./docs/screenshots/govt-risk-overview.png" alt="Govt Command Center risk overview"></td>
<td width="33%"><img src="./docs/screenshots/guardian-portal.png" alt="Guardian Portal live SOS view"></td>
</tr>
<tr>
<td align="center"><sub>Tourist PWA — dashboard</sub></td>
<td align="center"><sub>Govt Command Center — risk overview</sub></td>
<td align="center"><sub>Guardian Portal — live SOS state</sub></td>
</tr>
</table>

---

## Feature walkthrough

### 🧭 Planning
- **Multi-stop itineraries** built from a real destination catalog (10 Northeast India destinations, each with live weather, altitude, connectivity rating, ILP requirements, and nearest-hospital data)
- **AI-generated packing lists** via Google Gemini, with a static offline fallback so the feature never hard-fails
- **Budget tracking** per trip, category breakdowns
- **Group trips** — invite codes, join-by-code, shared itinerary, member roster
- **Digital Journey Passport** — a PDFKit-generated trip summary (itinerary, safety events, check-in history) a tourist can download or share

### 🚨 Safety
- **One-tap SOS** — hold-to-confirm button, 7 incident categories, GPS-first with a last-known-location fallback
- **Panic gesture SOS** — a phone-shake gesture fires the same SOS flow, for when reaching the screen isn't an option
- **Dead Man's Switch** — set a check-in interval before entering low-connectivity terrain; miss it, and the system auto-fires an SOS with your last known location, no action required from you
- **Travel Safety Index (TSI)** — a 0–100 score per destination, rule-based from route difficulty, altitude, connectivity, season, and live OpenWeatherMap data, recalculated hourly by a cron job and pushed live over Socket.IO
- **Offline SOS** — the mechanism this whole platform is built around: a tourist with zero data coverage sends a structured SMS (`AARAKSHA_SOS|ID:...|LAT:...|LNG:...|CAT:...|BATT:...|TIME:...`), a Twilio inbound webhook parses it, and a full SOS event is created exactly as if it came through the app
- **Emergency contact OTP verification** — contacts confirm consent before being registered, closing a real privacy gap
- **Rescue team ETA** — once a team is dispatched, the tourist sees live status and estimated arrival, not silence
- **Weather-triggered risk alerts** — a sudden weather-driven TSI drop pushes a real-time alert to anyone with that destination on their itinerary
- **Web push notifications** — critical alerts reach tourists even when the app isn't open

### 🖥️ Government Operations
- **Live ops map** (Leaflet + Socket.IO) — every active tourist, every open SOS, updating in real time, no refresh
- **SOS triage & rescue assignment** — one-tap dispatch to the nearest available team, status tracked through `EN_ROUTE → RESOLVED`
- **District risk overview** — per-destination live tourist counts, weather, TSI distribution, and a direct "Post News / Alert" action that fans out to every tourist with that destination on an active itinerary
- **Checkpoint QR scanning** — camera-first scan of a tourist's rotating QR code resolves their full safety profile at a physical checkpoint (ILP posts, park entrances) in one tap, manual entry as a fallback, not the default
- **Analytics & reporting** — incident trends, category breakdowns, average response time, exportable as a real PDF with one click
- **Role-scoped access** — super admin, district admin, and checkpoint officer roles, each seeing only what their role needs

### 🌐 Community & Live Content
- **Rich destination reviews** — ratings plus structured detail (actual cost, time spent, crowd level, felt-safe flag, transport/food/accessibility ratings, liked/disliked notes, photos) — not a star rating in a vacuum
- **Scam / safety reports** — community-sourced, filterable per destination
- **Curated, rotating destination news** — a ~45-item hand-written bank across all 10 destinations, rotated in on a time-slot schedule so the feed visibly changes over a multi-day demo without needing a live news API key
- **Risk overview in the tourist app too** — the same live "how many people are here right now, and how risky is it" view the government dashboard has, surfaced directly to travelers deciding where to go next

### 👪 Guardian Portal
- **Zero-friction access** — a cryptographically random token in the URL, no login, works the instant it's opened
- **Four status states**, each visually distinct: safe, check-in-due warning, SOS active (with map, category, and trigger time), and no-signal
- Live location on a Leaflet map, battery level, medical info (blood group, conditions), auto-refresh every 30s

### 📴 Offline-first
- **IndexedDB (Dexie.js)** queues SOS events and location pings when the tourist app itself is offline, syncing the moment connectivity returns
- **Cached safety guides** — nearest hospital, police, and rescue team contact stay available even with no signal
- Every safety mechanism above degrades gracefully rather than failing outright when a network or third-party API isn't available

---

## Screenshots

All captured live from the running app — real seeded data, not mockups. Full-resolution files
are in [`docs/screenshots/`](./docs/screenshots/), free to drop straight into slides.

**Tourist PWA**

<table>
<tr>
<td width="50%"><img src="./docs/screenshots/tourist-landing.png" alt="Tourist landing page"><p align="center"><sub>Landing page — terrain-themed hero</sub></p></td>
<td width="50%"><img src="./docs/screenshots/tourist-trip-detail.png" alt="Trip detail with TSI and news"><p align="center"><sub>Trip detail — live TSI + destination news</sub></p></td>
</tr>
<tr>
<td width="50%"><img src="./docs/screenshots/tourist-community.png" alt="Community reviews"><p align="center"><sub>Community — rich destination reviews</sub></p></td>
<td width="50%"><img src="./docs/screenshots/tourist-dashboard.png" alt="Tourist dashboard"><p align="center"><sub>Dashboard — SOS, DMS, active trips</sub></p></td>
</tr>
</table>

**Govt Command Center**

<table>
<tr>
<td width="50%"><img src="./docs/screenshots/govt-login.png" alt="Govt Command Center login"><p align="center"><sub>Restricted-access authentication</sub></p></td>
<td width="50%"><img src="./docs/screenshots/govt-dashboard.png" alt="Govt dashboard"><p align="center"><sub>Dashboard — live stats at a glance</sub></p></td>
</tr>
<tr>
<td width="50%"><img src="./docs/screenshots/govt-live-map.png" alt="Live ops map"><p align="center"><sub>Live Map — every active tourist, real time</sub></p></td>
<td width="50%"><img src="./docs/screenshots/govt-sos-management.png" alt="SOS management"><p align="center"><sub>SOS Management — triage + rescue dispatch</sub></p></td>
</tr>
<tr>
<td width="50%"><img src="./docs/screenshots/govt-risk-overview.png" alt="Risk overview"><p align="center"><sub>Risk Overview — per-destination live risk</sub></p></td>
<td width="50%"><img src="./docs/screenshots/govt-analytics.png" alt="Analytics dashboard"><p align="center"><sub>Analytics — incident trends + PDF export</sub></p></td>
</tr>
</table>

**Guardian Portal** — mobile view, since this is the link a family member opens on their phone

<p align="center">
  <img src="./docs/screenshots/guardian-portal.png" alt="Guardian Portal live SOS tracking, mobile view" width="320">
</p>

---

## Architecture at a glance

**Backend stack:** Node.js ≥20 · Express · PostgreSQL (raw `pg`, zero ORM) · JWT + bcrypt ·
Socket.IO · node-cron (DMS checks every minute, weather+TSI hourly, news rotation every 20 min) ·
Twilio (outbound SMS + inbound webhook) · Google Gemini · PDFKit · multer (photo uploads) · Zod
validation · pino structured logging.

**Frontend stack** (all three apps, independently deployable Vite projects sharing one design
system — see [`UI_GUIDE.md`](./UI_GUIDE.md)): Vite 8 · React 19 · TypeScript 6 · Tailwind CSS
3.4 · shadcn/ui (Radix primitives) · Zustand · TanStack Query v5 · Dexie.js (tourist offline
sync) · react-leaflet (govt live map) · react-hook-form + Zod · Socket.IO client · jsQR (checkpoint
camera scanning).

Every layer is intentionally narrow: controllers hold no SQL or business logic, all queries live
in repositories, and every multi-table write that must be atomic goes through a single
`withTransaction()` helper. The full mechanism, traced from the actual source, is diagrammed in
the [production readiness report](./PRODUCTION_READINESS_REPORT.html).

---

## By the numbers

| | |
|---|---|
| **Portals** | 3 (Tourist PWA, Govt Command Center, Guardian Portal) |
| **API endpoints** | 66, across 13 route groups |
| **Database tables** | 19 |
| **Destinations seeded** | 10, across Assam, Meghalaya, Nagaland, Arunachal Pradesh, Sikkim, Manipur — each with real altitude, connectivity, ILP, and hospital data |
| **Curated news items** | ~45, hand-written per destination, auto-rotating |
| **Tourist app screens** | 13+ (landing, auth, dashboard, trip planning + detail with 6 tabs, check-in, SOS, community, advisory, profile) |
| **Govt app screens** | 7 (login, dashboard, SOS management, live map, risk overview, analytics, checkpoint scan) |
| **Cron jobs** | 3 (Dead Man's Switch monitoring, weather + TSI refresh, destination news rotation) |
| **Real-time events** | 11 distinct Socket.IO event types |
| **SOS incident categories** | 7 (medical, lost, trapped, disaster, missing, crime, other) |

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
├── backend/
│   ├── src/
│   │   ├── app.js                   Express app: middleware chain, routes, error handler
│   │   ├── server.js                HTTP server, Socket.IO init, graceful shutdown
│   │   ├── config/                  env validation, CORS, Gemini/Twilio/push clients
│   │   ├── constants/                enums, error messages, socket event names
│   │   ├── routes/                  13 route modules → controllers
│   │   ├── controllers/             thin HTTP handlers
│   │   ├── services/                business logic, transaction boundaries
│   │   ├── repositories/            all SQL, parameterized, one per table cluster
│   │   ├── middleware/              auth (JWT), validate (Zod), rate limiting, errors
│   │   ├── validators/              Zod schemas per domain
│   │   ├── socket/                  Socket.IO init + typed emitters
│   │   ├── cron/                    DMS, weather+TSI, destination-news rotation jobs
│   │   ├── data/                    curated destination news bank
│   │   ├── database/                connection pool, transaction helper
│   │   └── migrations/              node-pg-migrate schema — 19 tables across 6 migrations
│   ├── scripts/
│   │   ├── preflight.js             env/DB connectivity check before setup
│   │   ├── seed.js                  idempotent demo data (--reset flag available)
│   │   ├── seedDemoContent.js       trips/reviews/scam reports across every demo account
│   │   └── seedAnalyticsHistory.js  30-day realistic incident history for the analytics dashboard
│   ├── tests/                       vitest unit + integration suite
│   ├── postman/                     Postman collection + environment
│   ├── .env.example                 every required env var, documented
│   └── package.json
│
└── frontend/
    ├── tourist/                     Tourist PWA — :5173
    │   └── src/pages/               landing, auth, dashboard, trips (create/detail/list),
    │                                 safety (SOS/check-in/checkpoint pass), community,
    │                                 advisory, profile
    ├── govt/                        Government Command Center — :5174
    │   └── src/pages/               login, dashboard, SOS management, live map,
    │                                 risk overview, analytics, checkpoint scan
    └── guardian/                    Guardian Portal — :5175
        └── src/pages/               tracking page (token in URL, no auth)
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
real random values even for local development. Twilio, Gemini, OpenWeatherMap, and Web Push
(VAPID) keys are **optional** — every integration degrades gracefully when unset.

### 3. Set up the database
```bash
npm run preflight     # verifies DATABASE_URL is reachable before anything else runs
npm run migrate       # applies the 19-table schema
npm run seed          # idempotent demo data — safe to re-run
```
Or all three in one shot: `npm run setup`.

Two optional scripts add richer demo content on top of the base seed:
```bash
node scripts/seedDemoContent.js       # more trips, reviews, and scam reports per account
node scripts/seedAnalyticsHistory.js  # 30 days of realistic resolved-incident history
```

### 4. Run the backend
```bash
npm run dev            # nodemon, auto-restart
```
Starts on `PORT` (default `5000`), logs `GET /health → {"status":"ok"}` once ready.
Socket.IO and all three cron jobs start automatically.

### 5. Run the frontends
Each app is a separate Vite project on a fixed port. In three more terminals:
```bash
cd frontend/tourist  && cp .env.example .env && npm install && npm run dev   # → :5173
cd frontend/govt      && cp .env.example .env && npm install && npm run dev   # → :5174
cd frontend/guardian  && cp .env.example .env && npm install && npm run dev   # → :5175
```
The `.env.example` defaults work out of the box against a local backend. To test from another
device on the same network, point each `VITE_API_URL` / `VITE_SOCKET_URL` at your machine's LAN
IP instead of `localhost` (all three dev servers already bind to `0.0.0.0`).

---

## Demo accounts

Seeded by `npm run seed` — each tourist account is mid-scenario, not a blank slate:

| Account | Login | Scenario |
|---|---|---|
| Aryan Demo | `9999999999` / `Demo@123` | Active trip, 1 check-in, 1 resolved SOS |
| Priya Sharma | `9876500001` / `Demo@123` | Completed trip, passport-ready (check-ins, activities, packing list) |
| Rahul Verma | `9876500002` / `Demo@123` | **Active trip with a live unresolved SOS + rescue team en route** |
| Sneha Das | `9876500003` / `Demo@123` | Active trip with a running Dead Man's Switch |

| Govt role | Login |
|---|---|
| Super Admin | `admin@aaraksha.gov.in` / `Admin@123` |
| District Admin | `district.officer@aaraksha.gov.in` / `District@123` |
| Checkpoint Officer | `checkpoint.officer@aaraksha.gov.in` / `Checkpoint@123` |

The Guardian Portal needs no login — copy any tourist's guardian token (visible on their Profile
page) into `/track/:token` on the guardian app.

---

## API surface

66 REST endpoints across 13 route groups, all under `/api`:

| Prefix | Covers |
|---|---|
| `/auth` | Tourist + govt registration/login, forgot-password OTP flow, phone verification |
| `/tourists` | Profile, emergency-contact OTP verification, checkpoint QR code, public guardian view |
| `/trips` | Itinerary CRUD, stops, group trips (join/invite/members/leave), per-trip news, TSI |
| `/sos` | Create SOS, history, active rescue info, mark false alarm |
| `/dms` | Dead Man's Switch create/reset/status |
| `/checkins` | Manual check-ins |
| `/destinations` | Catalog, weather cache, risk overview, per-destination news, reviews |
| `/scam-reports` | Community-reported safety incidents |
| `/packing` | AI-generated packing checklists |
| `/journey-passport` | PDF trip summary generation |
| `/govt` | Dashboard, live tourists, risk overview, SOS assignment/resolution, rescue teams, checkpoint scan, analytics + PDF export, destination news posting |
| `/webhooks` | Twilio inbound SMS (offline SOS) |
| `/push` | Web push subscribe/unsubscribe, VAPID public key |

Full request/response contracts, status codes, and the response envelope shape are in
[`API_GUIDE.md`](./API_GUIDE.md).

---

## Testing

**Unit + integration (vitest)**
```bash
cd backend
npm test
```
Covers pure logic (TSI scoring, crypto utilities) and integration flows against
`DATABASE_TEST_URL`.

**API contract tests (Postman/Newman)**
```bash
cd backend
npx newman run postman/aaraksha-collection.json -e postman/aaraksha-environment.json
```
Covers the core auth/trip/SOS/DMS/govt surface. The community reviews, news rotation, group
trips, and push-notification endpoints were added after this collection and have instead been
verified through live, real-network end-to-end testing across all three running portals
(Playwright-driven — real logins, real form submissions, real network requests inspected, real
DB rows confirmed) rather than through Postman assertions yet.

---

## Production readiness

Passing the test suite proves the API matches its contract. It doesn't prove the API survives
someone actively trying to break it. The backend went through a second, adversarial pass — real
payloads fired at a live server, not code review:

- **Rate limiting** — burst traffic against `/login`; found the limiter was defined but never
  wired to a route, then found a second bug (a shared limiter instance draining budget across
  unrelated routes). Both fixed.
- **SQL injection** — `' OR 1=1 --`, `DROP TABLE`, `UNION SELECT` against login/search/profile
  fields. Held — parameterized queries throughout.
- **Concurrency** — two parallel resolve requests on the same SOS both returned 200 before the
  fix, silently clobbering each other's resolution notes. Fixed with an atomic DB-level guard.
- **Transaction rollback** — deliberately forced a mid-transaction foreign-key violation;
  confirmed the preceding insert did not survive the rollback.
- **External service failure** — Twilio, Gemini, and OpenWeatherMap all unconfigured; confirmed
  every integration degrades gracefully rather than failing the request.
- **Malformed input** — a SQLi-shaped string in a phone field crashed with an unhandled 500
  before the fix; now a clean 400.

Five real defects were found and fixed this way. The full findings, plus 13 hand-drawn diagrams
tracing the actual request pipeline, transaction boundaries, and SOS/DMS/TSI lifecycles from the
real source code, are in
**[`PRODUCTION_READINESS_REPORT.html`](./PRODUCTION_READINESS_REPORT.html)**.

---

## Documentation map

| Document | Read it when |
|---|---|
| [`Architecture.md`](./Architecture.md) | You're making a stack, naming, or directory-structure decision |
| [`API_GUIDE.md`](./API_GUIDE.md) | You're calling or adding an endpoint |
| [`DB_GUIDE.md`](./DB_GUIDE.md) | You're writing a query or touching the schema |
| [`UI_GUIDE.md`](./UI_GUIDE.md) | You're building one of the three frontends |
| [`PRODUCTION_READINESS_REPORT.html`](./PRODUCTION_READINESS_REPORT.html) | You want architecture diagrams + adversarial-testing evidence |

---

## Roadmap

Everything above is built and working end-to-end. What's next:

- [ ] **Volunteer SOS network** — a dual-channel alert that pings nearby verified local
      volunteers alongside official rescue teams, with a points/reputation system to encourage
      participation. Scoped, feasible, deliberately not built yet — pitched as the natural next
      expansion of the safety network beyond government response.
- [ ] Automated frontend test suite (current automated coverage is backend-only; frontends are
      verified through live end-to-end browser testing, not a checked-in test suite)
- [ ] PWA service worker for full offline app-shell support (today's offline story is IndexedDB
      data sync + SMS fallback, not an installable offline-first shell)
- [ ] Real Twilio/Gemini/OpenWeatherMap/VAPID credentials wired in for the live demo environment

---

*Built for Smart India Hackathon 2025 — Travel & Tourism track.*
