# Aaraksha — Production Readiness Report

> **Format note:** this used to be a hand-built, 2,400-line HTML dossier. It drifted badly (last
> full pass described a 14-table schema, 3 portals, 45 endpoints, commit `ea01a5e` — this project
> is now 30 tables, 4 portals, 136 endpoints, many commits later) because a static HTML diagram
> deck is expensive to touch every time something ships. This `.md` replaces it for exactly that
> reason: it's meant to be updated in the same PR as the feature that changes these numbers, not
> redesigned from scratch each time. See **Maintenance**, bottom of this file.
>
> This is a checklist-style engineering artifact — go/no-go signal, not the pitch. For the full
> narrative (features, architecture rationale, screenshots) see [`README.md`](./README.md).

**Snapshot as of 2026-09-01** — verified directly against the live dev DB and the route files, not
estimated:

| | |
|---|---|
| Portals | 4 (Tourist PWA, Govt Command Center, Guardian Portal, Rescuer App) |
| API endpoints | 136, across 17 route groups |
| Database tables | 30 (+ `pgmigrations` tracking table) |
| Migrations | 26, applied incrementally |
| Auth model | JWT (HS256, algorithm-pinned) + RBAC (tourist / govt roles) + token-based guardian links |
| Offline SOS path | Twilio inbound SMS → structured parser → canonical SOS pipeline |

---

## Adversarial testing & security

Two real adversarial passes, live payloads against a running server, not just code review — full
detail in [`docs/testing/README.md`](./docs/testing/README.md) (12-phase QA covering every portal)
and [`docs/testing/09-security-audit.md`](./docs/testing/09-security-audit.md).

**Pass 1 — 5 defects found and fixed:**

| Area | What was found |
|---|---|
| Rate limiting | Limiter was defined but never wired to a route; a second bug had a shared limiter instance draining budget across unrelated routes |
| Concurrency | Two parallel resolve requests on the same SOS both returned `200`, silently clobbering each other's resolution notes — fixed with an atomic DB-level guard |
| Transaction rollback | Forced a mid-transaction FK violation; confirmed the preceding insert did not survive |
| External service failure | Twilio/Gemini/OpenWeatherMap all unconfigured — confirmed every integration degrades gracefully |
| Malformed input | A SQLi-shaped string in a phone field crashed with an unhandled 500 — now a clean 400 |

SQL injection (`' OR 1=1 --`, `DROP TABLE`, `UNION SELECT`) held throughout — parameterized queries
only, no string-built SQL anywhere in the codebase.

**Pass 2 (authentication-focused) — 3 more:**

| Area | What was found |
|---|---|
| Privilege escalation | `POST /auth/govt/register` let anyone create a `SUPER_ADMIN` account unauthenticated — now gated behind `authenticateGovt` + `requireGovtRole(SUPER_ADMIN)` |
| JWT algorithm confusion | Every `jwt.verify()` call now pins `algorithms: ['HS256']` explicitly |
| OTP rate limiter | Had a hardcoded 15-min/3-request budget independent of the configurable window — now reads the same config as everything else, plus a dev-only `debugOtp` fallback when Twilio can't deliver |

**8 real defects found and fixed across both passes.**

---

## Test coverage

| Layer | Coverage |
|---|---|
| Backend unit + integration (vitest) | 56 tests passing — pure logic (TSI scoring, itinerary scoring, crypto) + integration flows against `DATABASE_TEST_URL` |
| Frontend (vitest, all 4 apps) | ~95 tests total across tourist/govt/guardian/volunteer |
| API contract (Postman/Newman) | 300 assertions across 133 requests in 24 folders — auth, trips, SOS, DMS, govt ops, security guards, validation, edge cases, the unified rescuer flow, the AI Travel Assistant, and the simulated NTN path |
| CI | `.github/workflows/test.yml` runs the backend suite against a real ephemeral Postgres and matrixes the frontend suite across all four apps on every push/PR |
| Scoring-quality benchmark | `tests/eval/travelPlanner.benchmark.js` — 6 fixed real-world queries against the live scorer + dev DB, 6/6 passing |
| Newer endpoints (community reviews, news rotation, group trips, push, incident reports, risk-density, anomaly detection, E-FIR queue, checkpoint hash-chain, AI Travel Assistant) | Verified through live, real-network Playwright end-to-end testing rather than Postman assertions — see [Testing](./README.md#-testing) in the README for what that actually checks |

---

## Database — 30 tables, by area

Full column-level detail lives in [`DB_GUIDE.md`](./DB_GUIDE.md); this is the map, not the schema.

| Area | Tables |
|---|---|
| Identity & auth | `tourists`, `govt_users`, `otp_verifications`, `data_deletion_requests` |
| Trips & travel planning | `trips`, `trip_members`, `destinations`, `typical_routes`, `destination_news`, `destination_reviews`, `weather_cache` |
| Safety core | `checkins`, `dead_mans_switches`, `sos_events`, `sos_cluster_flags`, `safety_anomalies`, `tourist_locations` |
| Rescue network | `rescue_teams`, `rescue_assignments`, `volunteers`, `volunteer_dispatches` |
| Incidents & community | `incident_reports`, `scam_reports`, `checkpoint_scans` |
| Trust & messaging | `tourist_trust_events`, `tourist_trust_appeals`, `messages` |
| Offline / NTN / push | `inbound_sos_sms`, `ntn_messages`, `push_subscriptions` |

---

## API surface — 17 route groups

Full contracts in [`API_GUIDE.md`](./API_GUIDE.md).

`/auth` `/tourists` `/trips` `/sos` `/dms` `/ntn` `/travel-planner` `/checkins` `/destinations`
`/scam-reports` `/incidents` `/packing` `/journey-passport` `/govt` `/volunteers` `/webhooks` `/push`

---

## Compliance

| Framework | Status |
|---|---|
| DPDP Act 2023 | Right to notice, access (real data export), correction, erasure (anonymize-in-place, not raw `DELETE`, refused automatically while an open SOS/E-FIR exists), grievance redressal — all live, not slide bullets. Govt-ID hash is replaced (not left behind) on deletion |
| GIGW 3.0 / WCAG 2.1 AA | Accessibility pass on the Govt Command Center — `aria-label`s, keyboard focus visibility, 4.5:1 contrast tokens, modal keyboard handling, alt text, form labeling |
| Aadhaar validation | Real Verhoeff checksum algorithm (UIDAI's own 12th-digit arithmetic), not format-only regex |

---

## Known limitations — honest gaps, not blockers

Carried forward from the original audit; **not independently re-verified this pass** — flagged
honestly rather than silently dropped when the report format changed:

- **Rate limiting is per-IP, in-memory** (`express-rate-limit`'s default store). Restarting the
  process clears all counters, and it won't coordinate across multiple server instances behind a
  load balancer. A Redis-backed store is the natural next step if this scales beyond a single node.
- **No application-level caps on array-shaped fields** (trip stops, packing items, activities).
- **Frontend escaping of stored user text** (notes, scam reports, review tips) should be
  spot-checked across all four portals — the backend correctly treats this as opaque data, but
  that only matters if nothing ever renders it as raw HTML.
- **Confirm `NODE_ENV=production`** is set via real deploy-time environment configuration, not
  inherited from the committed `.env` default, so stack traces stay out of error responses.

Roadmap items (features, not readiness gaps) live in [`README.md`'s Roadmap](./README.md#️-roadmap).

---

## Maintenance

Update this file in the same PR/commit as whatever changed its numbers — endpoint count, table
count, migration count, a new adversarial finding, a newly-closed known limitation. It's a
markdown table diff, not a redesign; that's the entire reason this stopped being HTML. Same
expectation applies to `backend/postman/aaraksha-collection.json` — a new route gets a Postman
folder alongside it, not sometime later (see `CLAUDE.md`'s Definition of Done, row 6).
