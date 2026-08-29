# 01 — System Audit (Phase 1)

## Test Objective

Build a verified, evidence-backed map of what actually exists in the Aaraksha codebase — routes,
controllers, services, repositories, middleware, socket handlers, cron jobs, migrations, frontend
routes/pages, and existing test infrastructure — and identify where the documentation (`README.md`,
`Architecture.md`, `API_GUIDE.md`, `DB_GUIDE.md`, `UI_GUIDE.md`) and the actual code disagree. No
code was modified in this phase, per the plan's Phase 1 rule.

## Scope

Full repository: `backend/` (routes, controllers, services, repositories, middleware, socket, cron,
migrations, ml, tests, postman), all four `frontend/*` apps (pages, routes, tests), and the six
source-of-truth docs plus `PRODUCTION_READINESS_REPORT.html`.

## Environment

- Local dev machine, Windows.
- Backend: Node.js, local PostgreSQL (`aaraksha` demo DB, `aaraksha_test` test DB).
- No servers were started or code executed in this phase beyond read-only `psql` inspection of
  both databases' schemas.

## Tests Executed

This phase is inspection, not execution — "tests executed" here means verification actions, not
functional test runs:

1. Read `README.md`, `Architecture.md`, `API_GUIDE.md`, `DB_GUIDE.md`, `UI_GUIDE.md` in full.
2. Read `PRODUCTION_READINESS_REPORT.html`'s section structure; confirmed
   `SIH_COMPETITIVE_ANALYSIS.html` (referenced by README) does not exist on disk.
3. Enumerated `backend/src/{routes,controllers,services,repositories,middleware,socket,cron,ml,
   validators}` and confirmed every route file is actually mounted in `routes/index.js` (no
   orphaned/unregistered route modules).
4. Compared migration files on disk (`backend/src/migrations/*.js`, 15 files) against
   `pgmigrations` rows actually applied in **both** `aaraksha` and `aaraksha_test`.
5. Counted backend test files and their actual `it()`/`test()` block counts
   (`backend/tests/**`).
6. Counted each frontend portal's test files and actual `it()`/`test()` block counts
   (`frontend/{tourist,govt,guardian,volunteer}/src/**/*.test.ts`).
7. Counted the real Postman collection's request/folder totals via a script parsing
   `postman/aaraksha-collection.json`, compared against README's stated numbers.
8. Enumerated every frontend route (`<Route path=...>`) actually registered in each portal's
   `main.tsx`, cross-checked against the page-component inventory.
9. Counted `SOCKET_EVENTS` entries in `backend/src/constants/events.js`, cross-checked against
   README's claimed count.
10. Verified `DATABASE_TEST_URL` is a real, distinct, already-configured concept (both locally and
    in `.github/workflows/test.yml`'s CI job) — resolving the plan's own stated prerequisite that a
    demo/test DB split exist before destructive testing begins.

## Results

### Backend layer inventory (all present, all wired)

| Layer | Count | Notes |
|---|---|---|
| Route modules | 15 | All 15 mounted in `routes/index.js` under `/api`. No orphans found. |
| Controllers | 17 | Includes `dataRights.controller.js`, `review.controller.js` not separately routed (mounted under `destination`/`tourist` routes — expected, not a gap). |
| Services | 27 (+3 under `notification/`) | Includes `anomaly.service.js`, `efirReport.service.js`, `passport.service.js` (hash chain), `riskModel.service.js` — all README-claimed services confirmed present on disk. |
| Repositories | 22 | One per table cluster, matching `DB_GUIDE.md`'s stated pattern. |
| Middleware | 4 | `auth.js`, `errorHandler.js`, `rateLimiter.js`, `validate.js`. |
| Socket | 2 files | `index.js` (rooms/init), `emitters.js` (typed emit functions) — matches `Architecture.md`'s documented pattern. |
| Cron jobs | 4 | `dms.job.js`, `anomaly.job.js`, `weather.job.js`, `news.job.js` — matches README's "4 cron jobs" claim exactly. |
| ML | 2 files | `logisticRegression.js` (from-scratch model), `features.js` (shared train/serve encoding) — confirms README's "no ML framework" claim structurally (no `tensorflow`/`sklearn`-style import in either file). |
| Validators | 13 | Zod schemas per domain. |

### Frontend route/page inventory

| Portal | Registered routes | Page components found | Match |
|---|---|---|---|
| Tourist | 15 | 17 (incl. 2 auth sub-form components, not standalone pages) | ✅ matches README's "15 screens" |
| Govt | 9 (7 under `CommandCenterRoute` + login + checkpoint) | 9 | ✅ exact match |
| Guardian | 2 (`/track/:token`, catch-all) | 2 | ✅ matches "1 real screen" |
| Volunteer | 4 (auth, home, active-job, catch-all) | 4 | ✅ matches README's "3 screens" (+ NotFoundPage) |

No dead/unreachable page components found; no route pointing at a missing component.

### Migration status — the one real infrastructure gap

| Database | Migrations applied | Status |
|---|---|---|
| `aaraksha` (demo/presentation DB) | 15 / 15 | **Fully current.** All features including anomaly detection, E-FIR, checkpoint-scan trip linking, incident photo evidence, and data rights are live in the demo environment. |
| `aaraksha_test` (test DB) | 10 / 15 | **5 migrations behind** — missing `011_safety_anomalies`, `012_incident_reports`, `013_checkpoint_scan_trip_link`, `014_incident_photo_evidence`, `015_data_rights`. |

**Consequence:** any backend integration test, Postman/Newman run, or automated E2E test that
touches anomaly detection, E-FIR, checkpoint-to-trip linking, incident photo fields, or data-rights
endpoints will currently fail against `aaraksha_test` — not because the features are broken, but
because the test database's schema doesn't have the tables/columns yet. The demo database is
unaffected and does not need this fix.

**This is Phase 2's first action** (`DATABASE_URL=<test url> npm run migrate`, run against
`aaraksha_test` only — confirmed via `SELECT current_database()` before running, per this plan's
Section 0 rule).

`aaraksha_test` also currently contains 7 pre-existing `tourists` rows — not empty. Phase 2 should
decide deliberately whether to reset it (`npm run seed:reset` equivalent against the test URL) for
a clean baseline, rather than testing against unknown leftover state.

### Existing automated test coverage

| Suite | Files | Actual test-case count | What it covers |
|---|---|---|---|
| Backend vitest | 4 (`tests/integration/auth.test.js`, `tests/unit/crypto.utils.test.js`, `tests/unit/tsi.service.test.js`, `tests/setup.js`) | 28 (10 + 7 + 11) | Auth flows, crypto utilities, TSI scoring logic only. |
| Frontend vitest — Tourist | 3 files | 26 (3 + 4 + 19) | DMS API shape, OSRM route math, generic `utils.ts` (formatters, `cn()`). |
| Frontend vitest — Govt/Guardian/Volunteer | 2 files each | 23 each (4 + 19) | Same OSRM math + same generic utils, duplicated per portal. |
| **Frontend total** | 9 files | **95** | **Confirms README's "95 tests total" claim exactly (26 + 23 + 23 + 23 = 95).** |
| Postman/Newman | 1 collection | 121 requests / 26 folders (script-counted) | Auth, trips, SOS, DMS, govt ops, unified-rescuer flow, security guards, validation edge cases. |

**Real gap, not a documentation error:** the 95 confirmed frontend tests are near-entirely
duplicated utility/math tests (the same OSRM formula and the same `utils.ts` helpers, each tested
identically four times, once per portal) rather than four times the *distinct* coverage the raw
number suggests. **Zero component-level, page-level, or user-flow tests exist in any frontend** —
no test exercises `SOSButton`, a form submission, a Dead Man's Switch flow, a rescue-tracking map,
or any of the safety-critical UI this session's manual fixes have repeatedly found bugs in. This is
the single largest test-coverage gap in the system and should weigh heavily on Phases 3–6 and 11.

On the backend side, **SOS, DMS, trips, govt operations, rescue assignment, E-FIR, anomaly
detection, checkpoint scanning, the Journey Integrity Hash chain, and data rights — the majority of
the product's actual safety-critical surface — have no dedicated backend test file at all.** The
README is honest about this for several of these (states they were "verified through live,
real-network end-to-end testing... rather than through Postman assertions yet"), but that means
Phase 2 is not confirming existing coverage — it's writing first coverage for most of the system.

Postman collection: 121 requests / 26 folders counted directly from the collection JSON, vs.
README's stated "124 requests, 269 assertions across 22 folders." Request/folder counts are close
but not exact (documentation likely written before a small number of requests were added/removed;
not investigated further as low-severity). Assertion count (269) was not independently re-verified
in this phase — flagged for Phase 2, which will actually run the collection.

Socket events: 29 counted in `constants/events.js` vs. README's stated "28 distinct Socket.IO event
types" — off by one, not investigated further (cosmetic).

### Documentation-vs-reality discrepancies

| # | Discrepancy | File(s) | Severity | Notes |
|---|---|---|---|---|
| D1 | `aaraksha_test` is 5 migrations behind `aaraksha` | DB state | **P1** | Blocks reliable Phase 2 testing until fixed; does not affect the demo DB. |
| D2 | `SIH_COMPETITIVE_ANALYSIS.html` referenced 3 times in `README.md` (documentation map, roadmap, presentation slide guide) but does not exist in the repo | `README.md` | P2 | A judge following the README's own navigation would hit a dead reference. |
| D3 | `UI_GUIDE.md`'s "Portal Overview" table lists only Tourist/Govt/Guardian — the Rescuer/Volunteer portal is completely absent from this doc despite being fully built, routed, and documented in `README.md` and `Architecture.md` | `UI_GUIDE.md` | P2 | Doc appears to predate the Rescuer app; not a functional bug. |
| D4 | Postman collection is 121 requests / 26 folders on disk vs. README's stated 124 requests / 22 folders | `README.md`, `postman/aaraksha-collection.json` | P3 | Minor drift, likely stale count in prose. |
| D5 | `constants/events.js` declares 29 socket event constants vs. README's stated 28 | `README.md` | P3 | Off-by-one, cosmetic. |
| D6 | `DB_GUIDE.md`'s table reference section documents an older, smaller schema (13 tables: no `volunteers`, `checkpoint_scans`, `destination_news`, `destination_reviews`, `incident_reports`, `safety_anomalies`, `otp_verifications`, `push_subscriptions`, `trip_members`) than what's actually migrated (22 domain tables in the demo DB) | `DB_GUIDE.md` | P2 | The doc's own golden rules (parameterized SQL, named columns, transactions) remain accurate and in force — only the table reference section is stale. Does not block Phase 2, but Phase 2 should treat the live schema, not this doc, as authoritative for exact column names. |

No evidence was found of UI-only/fake buttons, backend-only/disconnected features, or mocked-but-
presented-as-dynamic features during this inspection pass — but Phase 1 is a structural read, not a
runtime click-through; that determination properly belongs to Phases 3–6 (per-portal frontend QA),
which will exercise every screen live.

## Bugs Found

None in this phase — Phase 1 is audit-only by design (no code was executed or exercised end-to-end
here beyond reading and static comparison). The migration gap (D1) is an infrastructure/environment
finding, not a code bug — `aaraksha_test` simply needs `npm run migrate` run against it.

## Root Causes

- D1: `aaraksha_test` was created and initially migrated at some point before migrations 011–015
  were written, and was never re-migrated since (unlike CI, which creates and migrates a fresh
  `aaraksha_test` on every run — so this gap has never surfaced there, only in this local dev
  environment).
- D2, D3, D6: documentation written at different points in the project's history, not updated in
  lockstep with later feature additions (Rescuer app, unified rescuer network, E-FIR, anomaly
  detection, data rights).
- D4, D5: minor prose drift, not tied to any specific code change.

## Fixes Applied

None — Phase 1 does not modify code or environment, per plan.

## Regression Tests

Not applicable to this phase.

## Remaining Issues

Carried forward to later phases, tracked against the discrepancy table above:

- **D1 (P1)** → Phase 2 opening action: migrate `aaraksha_test`, then decide on a reset-and-reseed
  baseline before running any destructive tests against it.
- **D2, D3, D6 (P2)** → recommend fixing in Phase 13 (final documentation pass) or whenever the
  relevant phase's owner has capacity; not blocking to any functional test.
- **D4, D5 (P3)** → cosmetic, fix opportunistically, not scheduled.
- **Test-coverage gap** (frontend component/flow tests, backend feature-area tests) is not itself a
  "bug" but is the primary justification for Phases 2–6 and 11 writing substantial new coverage
  rather than treating the existing suites as sufficient.

## Evidence

- Migration comparison: `pgmigrations` table rows queried directly via `psql` against both
  `aaraksha` (15 rows) and `aaraksha_test` (10 rows) on 2026-08-29.
- Test counts: `grep -cE "^\s*(it|test)\("` run against every `*.test.ts`/`*.test.js` file found;
  raw counts recorded in the table above (backend: 10+7+11=28; frontend: 26+23+23+23=95).
- Postman count: parsed `postman/aaraksha-collection.json` programmatically (recursive folder/item
  walk), not eyeballed.
- Route inventory: `grep -n "path="` against each portal's `main.tsx`, cross-referenced against
  `Glob` results for each portal's `src/pages/**/*.tsx`.
- `SIH_COMPETITIVE_ANALYSIS.html` absence confirmed via direct `ls`/`find` — not found anywhere in
  the repository.

## Conclusion

**PHASE STATUS: PASS WITH ISSUES**

The codebase is substantially more complete, better-tested (at the API-contract and adversarial-
security level via the existing Postman suite and the two documented security passes), and better-
documented than a first read of the base QA prompt's "current system" list would suggest — nearly
every named feature (Journey Integrity Hash, Predictive Risk Model, unified rescuer network, E-FIR,
anomaly detection, checkpoint QR, DPDP data rights) is real, wired, and present in both the demo and
test databases' migration history (once Phase 2 catches the test DB up).

The one genuine blocker for reliable Phase 2+ testing is D1 — a stale test database schema — which
is a one-command fix, does not touch the protected demo database, and is scheduled as the first
action of Phase 2. The most consequential finding for the phases ahead is not a discrepancy at all:
it's the size and shape of the real test-coverage gap (near-total absence of frontend
component/flow tests and backend feature-area tests for the system's actual safety-critical
surface), which should directly shape how much new test-writing effort Phases 2–6 and 11 invest
relative to how much they spend re-verifying already-covered ground.

---

**TESTS EXECUTED:** 10 verification actions (see Tests Executed above) — documentation read,
backend/frontend structural inventory, migration comparison across both databases, test-suite and
Postman collection counting, frontend route/page cross-check, socket event count.

**BUGS FOUND:** 0 code bugs. 1 infrastructure gap (D1, P1). 5 documentation discrepancies (D2–D6,
P2/P3).

**BUGS FIXED:** None (audit-only phase, by design).

**REGRESSION RESULTS:** N/A.

**DOCUMENTATION:** This file + [`QA-MASTER-PLAN.md`](./QA-MASTER-PLAN.md) + [`README.md`](./README.md).

**COMMIT:** See repository log for the commit accompanying this phase (`docs: complete Phase 1
system audit + QA master plan`).

**REMAINING ISSUES:** D1 blocks reliable Phase 2 execution until migrated (planned as Phase 2's
first action). D2/D3/D6 scheduled for Phase 13. D4/D5 opportunistic.

**NEXT PHASE:** Phase 2 — Backend/API/DB. Awaiting explicit go-ahead per the plan's phase
discipline (do not continue automatically).
