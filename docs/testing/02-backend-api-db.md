# 02 — Backend / API / Database (Phase 2)

## Test Objective

Execute the existing automated backend test suites for real (not just re-verify they exist), fix
whatever they surface, and directly exercise the codebase-specific edge cases identified in
[`QA-MASTER-PLAN.md`](./QA-MASTER-PLAN.md) §1 that have no automated coverage yet — the Journey
Integrity Hash's tamper-evidence claim, the Predictive Risk Model's train/serve alignment, DPDP
deletion refusal paths, anomaly-detection boundary/dedup behavior, the E-FIR investigation ladder,
and the rescuer-release path for the volunteer/false-alarm combination specifically.

## Scope

Backend only (`backend/`). No frontend code touched. All destructive/mutating testing ran against
`aaraksha_test`, never `aaraksha`.

## Environment

- **Test target:** a dedicated backend instance, `PORT=5099`, `DATABASE_URL` pointed at
  `aaraksha_test`, started separately from and never interfering with whatever instance may be
  running against the demo database on the default port.
- `aaraksha_test` migrated to 15/15 (Phase 1's flagged gap) and reset to a clean seed baseline
  before and after this phase's destructive tests.
- Backend vitest suite ran in-process against `DATABASE_TEST_URL` per its own existing config —
  unrelated to the port-5099 instance.

## Tests Executed

1. Migrated `aaraksha_test` from 10/15 to 15/15 migrations (confirmed target database by name
   before running).
2. Reset and reseeded `aaraksha_test` to a clean, known baseline (`node scripts/seed.js --reset`).
3. Ran `npm test` (backend vitest, 28 tests) against `aaraksha_test`.
4. Ran the full Postman/Newman collection (124 requests, 269 assertions, 21 functional folders)
   against the isolated port-5099 instance — three full runs total, tracking the fix below.
5. Directly reproduced the first Newman failure via a standalone `curl` against `/api/auth/register`
   with the collection's exact fixture payload.
6. Computed genuinely Verhoeff-valid replacement Aadhaar numbers (wrote and verified an inverse
   Verhoeff check-digit generator against `src/utils/verhoeff.js`'s own `isValidVerhoeff`), then
   replaced all 7 broken fixture Aadhaar numbers and 1 hardcoded stale assertion across the
   collection.
7. Re-ran the full collection twice more after the fix, reaching 269/269 passing.
8. Journey Integrity Hash: fetched a real tourist's hash twice with no change (determinism), then
   directly `UPDATE`d a historical `checkins` row in `aaraksha_test` and refetched (tamper-evidence).
9. Predictive Risk Model: programmatically compared `riskModel.weights.json`'s frozen
   `featureNames` against `features.js`'s live `FEATURE_NAMES` export.
10. DPDP data rights: attempted `POST /tourists/me/deletion-request` for a tourist with an open
    SOS, and separately for a tourist with an open E-FIR (no active SOS), confirming both refusal
    reasons are correct and specific.
11. Anomaly detection: seeded a tourist's `tourist_locations.updated_at` to exactly 6h ago (the
    documented inactivity threshold), called `detectAnomalies()` directly, confirmed the boundary
    flags; called it a second time to confirm dedup; resolved the anomaly and called detection
    again to observe reopen behavior.
12. E-FIR investigation ladder: attempted a direct `FILED → RESOLVED` status transition via the
    real API, skipping `ASSIGNED` and `UNDER_INVESTIGATION`.
13. Rescue release path: used the seeded live Karan Mehta ↔ Priya Deka (volunteer) scenario,
    checked `volunteers.status` before and after a false-alarm close (not resolve — the other half
    of the release-path matrix from the earlier team+resolve fix this session).
14. Final regression pass: reset `aaraksha_test` clean, re-ran vitest (28/28) and the full Newman
    collection (269/269) one more time after all fixes, confirmed `aaraksha` (demo DB) tourist
    records untouched throughout.

## Results

### Backend vitest — PASS

28/28 tests passing (10 integration, 7+11 unit), before and after all fixes. No regressions.

### Postman/Newman — found the real root cause of a 68% failure rate, fixed it, now 269/269

First run against the freshly-migrated `aaraksha_test`: **183 of 269 assertions failed (68%)**.
Root-cause tracing (not just re-reporting the symptom) found the actual first failure was
`POST /api/auth/register` returning `400` instead of `201` on the very first request in the
sequence — every one of the other 182 failures was a downstream consequence (an unset
`TOURIST_TOKEN`/`TOURIST_ID` environment variable cascading into 401s and `Cannot read properties
of undefined` errors throughout the rest of the collection), not 182 independent bugs.

**Root cause:** the collection's test-fixture Aadhaar numbers were written before the Verhoeff
checksum validator (`src/utils/verhoeff.js`) was added to registration. All 7 fixture Aadhaar
numbers used across the collection (`Register — Valid`, `Duplicate Phone`, `Duplicate Govt ID`,
`No Contacts`, and 4 volunteer-registration fixtures) happened to be arbitrary 12-digit strings
that fail the real checksum — confirmed programmatically, not by inspection: **0 of the 8
"should succeed" fixture numbers in the collection passed `isValidVerhoeff()`.**

**Fix:** wrote a Verhoeff check-digit generator (the algorithm's own inverse table), computed a
genuinely valid replacement for each of the 7 fixture numbers (minimal diff — same first 11 digits,
corrected checksum digit only), and updated one hardcoded test-script assertion that separately
expected the old, now-changed last-4-digit suffix. This is not application-code behavior change —
`postman/aaraksha-collection.json` is test fixture data; the Verhoeff validator itself is working
exactly as designed and was not touched.

**This is not a cosmetic fix.** Before it, the entire "19 - Volunteer Registration & Auth", "20 -
Govt Volunteer Management", and "21 - Unified Rescuer Assignment" folders — the newest, most
differentiating part of the product — were unverifiable by this suite, because volunteer
registration uses the same broken fixture pattern as tourist registration. **A judge or reviewer
running this exact collection before this fix would have seen 68% of the API contract suite
failing** and had no way to tell, from the failure list alone, that it was one stale test fixture
rather than 183 real defects.

| Run | Assertions failed |
|---|---|
| 1st (before fix) | 183 / 269 |
| 2nd (after fixture fix, before assertion fix) | 1 / 269 |
| 3rd (both fixes applied) | 0 / 269 |
| 4th (final regression pass, clean DB) | 0 / 269 |

### Journey Integrity Hash chain — verified, both properties hold

- **Determinism:** two fetches of `GET /journey-passport/:tripId/hash` with no intervening event
  returned byte-identical `finalHash` values.
- **Tamper-evidence, actually proven:** directly `UPDATE`d one historical `checkins` row's
  latitude in `aaraksha_test` (not through the API — a raw SQL mutation, the scenario a bad actor
  with database access would represent), then refetched the hash through the normal API path.
  `finalHash` changed (`c6cc03f6…` → `8154bec9…`); `genesisHash` correctly did not change (it's
  derived from trip-level facts, not check-in data); `eventCount` correctly stayed at 2 (an
  existing event was edited, not added). This is the one test in this phase that actually proves
  "tamper-evident" rather than exercising the happy path — reverted afterward.

### Predictive Risk Model — no train/serve skew

`riskModel.weights.json`'s frozen `featureNames` (17 entries) deep-equals the live
`FEATURE_NAMES` export from `src/ml/features.js` right now. The checked-in model is still valid
against the current feature encoding.

### DPDP data rights — both refusal paths confirmed correct

- Tourist with an open SOS → `{"status":"DENIED","reason":"Deletion deferred — 1 active SOS
  event still open..."}`.
- Tourist with an open E-FIR (no active SOS) → correctly cites the E-FIR specifically, not a
  generic refusal, confirming the two checks are independent and both wired.
- **Minor bug found and fixed:** the E-FIR refusal reason read "1 open E-FIR case still open"
  (redundant). One-line fix in `dataRights.service.js` — now "1 E-FIR case still open".

### Anomaly detection — boundary and dedup both correct; one behavior worth flagging

- A location exactly 6h stale (the documented `INACTIVITY_THRESHOLD_HOURS`) **was** flagged —
  confirms the `>=` inclusive boundary works as coded.
- Two consecutive detection runs against the same still-stale tourist created exactly one `OPEN`
  anomaly, not two — dedup via `flagIfNotAlreadyOpen`'s existing-open check works correctly.
- **Behavior found, not a clear bug — flagged for a product decision:** resolving an INACTIVITY
  anomaly while the tourist's location is *still* stale causes the very next detection pass (the
  live cron ticks every minute) to immediately reopen it as a new anomaly. Reproduced directly: a
  resolve followed immediately by a manual `detectAnomalies()` call created a fresh `OPEN` row for
  the same tourist/type within the same second. This may be intentional (the underlying unsafe
  condition genuinely hasn't changed) or may cause real operator fatigue in a live demo if a judge
  watches a govt officer resolve an anomaly and sees it reappear a minute later with no visible
  explanation. Not fixed in this phase — this is a product/UX decision, not a broken
  implementation, and changing it either way should be a deliberate call, not something silently
  altered mid-QA-pass.

### E-FIR investigation ladder — no transition enforcement exists (real gap, P2)

`incident.service.js#updateStatus` validates only that the submitted status is a member of the
`INCIDENT_STATUSES` enum — there is no ordering/adjacency check at all. **Reproduced directly:** a
real `PATCH /govt/incidents/:id/status` call moved a case from `FILED` straight to `RESOLVED`,
skipping `ASSIGNED` and `UNDER_INVESTIGATION` entirely, and the API accepted it with `200 OK`. The
resulting record is internally inconsistent — `status: "RESOLVED"` with `assigned_officer_id: null`
and `assigned_at: null`, i.e. a "resolved" case that was never formally assigned to anyone.

This is presented as a finding, not silently fixed: `README.md` and the govt UI both describe this
as a structured investigation ladder, which is a real product claim this contradicts — but it's
also plausible real investigation workflows need flexibility (an officer overriding a
mis-categorized case, for instance). Whether to add strict adjacency enforcement is a product
decision, not an implementation bug fix, and is called out explicitly for a decision before Phase
9 (security) or Phase 13 (final) close it out one way or the other.

### Rescue release path — volunteer + false-alarm confirmed (completes the matrix)

This session's earlier fix confirmed release-on-close for the team+resolve combination. This phase
confirms the other corner: the seeded live Karan Mehta (tourist) / Priya Deka (volunteer, `EN_ROUTE`)
scenario — `volunteers.status` was `DEPLOYED` before, a real `PATCH /sos/:id/false-alarm` call
succeeded, and `volunteers.status` was `AVAILABLE` immediately after. All four combinations
(team/volunteer × resolve/false-alarm) are now verified; the earlier session only had team+resolve
and team+false-alarm confirmed.

## Bugs Found

| # | Bug | Severity | Where |
|---|---|---|---|
| B1 | Postman collection's Aadhaar test fixtures (all 8 "should succeed" cases) fail the real Verhoeff checksum, causing 183/269 assertion failures across nearly the whole collection | **P1** | `backend/postman/aaraksha-collection.json` |
| B2 | DPDP deletion-refusal message has redundant wording ("open E-FIR case still open") | P3 | `backend/src/services/dataRights.service.js` |
| B3 | E-FIR status endpoint enforces no transition ordering — any `FILED→RESOLVED` (or any other) jump is accepted | P2 | `backend/src/services/incident.service.js` |

**Not a bug, flagged for a decision:** resolving an INACTIVITY anomaly while the underlying stale
condition persists causes immediate reopening on the next detection pass. See above.

## Root Causes

- B1: test fixtures written before the Verhoeff checksum feature existed, never updated when it
  was added.
- B2: string concatenation left over from before the two-reason (SOS + E-FIR) message was combined
  into one sentence.
- B3: `updateStatus` was implemented to validate enum membership only; ladder/ordering was never
  added as a service-layer rule.

## Fixes Applied

- B1: 7 Aadhaar numbers + 1 hardcoded suffix assertion corrected in
  `postman/aaraksha-collection.json`, using genuinely Verhoeff-valid values (verified
  programmatically against the real validator, not guessed).
- B2: one-line wording fix in `dataRights.service.js`.
- B3: **not fixed** — flagged as a product decision, per above.

## Regression Tests

- Backend vitest: 28/28 passing before and after all changes.
- Postman/Newman: 269/269 passing after fixes, confirmed on two separate full runs including a
  final pass against a freshly reset test database.
- `aaraksha` (demo DB) tourist records spot-checked before and after this entire phase — all three
  checked demo accounts (Aryan Demo, Rahul Verma, Karan Mehta) present and unmodified. No command
  in this phase ever targeted `DATABASE_URL`/`aaraksha` — every mutating command's target database
  was confirmed by name first.

## Remaining Issues

- **B3 (E-FIR transition enforcement)** — needs a product decision (strict ladder vs. flexible
  officer override) before it's fixed one way or the other.
- **Anomaly reopen-on-resolve behavior** — needs the same kind of decision; not a defect as coded,
  but worth a deliberate call given demo-day visibility.
- Backend integration test coverage is still limited to auth (per Phase 1's finding) — this phase
  added real *manual/scripted* verification for SOS/rescue release, DMS-adjacent anomaly detection,
  hash chain, risk model, and data rights, but none of that is yet captured as a repeatable
  automated test. Recommend Phase 11 (Automated/E2E regression) turn the scripted checks in this
  report into permanent vitest/Newman coverage rather than one-off verification.

## Evidence

- Newman run logs (3 full runs) captured and inspected line-by-line; final summary tables quoted
  above verbatim (269/269, 0 failures).
- Hash chain: exact `finalHash` values before/after tamper quoted above from real API responses.
- Risk model: `featureNames` arrays compared via `JSON.stringify` equality in a live Node script
  against the actual checked-in weights file and the actual current `features.js`.
- Data rights: real API response bodies quoted above for both refusal cases.
- Anomaly detection: real `safety_anomalies` table rows queried via `psql` before/after each step,
  `detected_at`/`status` timestamps confirming the reopen sequence.
- E-FIR: real API request/response pair quoted above, including the resulting inconsistent record.
- Rescue release: real `volunteers.status` values queried via `psql` immediately before and after
  the real `false-alarm` API call.

## Conclusion

**PHASE STATUS: PASS WITH ISSUES**

The single most consequential finding this phase is B1 — not because the application had a defect,
but because the test suite meant to catch defects was silently unable to verify roughly two-thirds
of its own assertions, including the entirety of the unified-rescuer-network folders. That's now
fixed and re-verified twice. Everything scripted-tested beyond the existing suites — the hash
chain's tamper-evidence, the risk model's train/serve alignment, both DPDP refusal paths, anomaly
detection's boundary and dedup behavior, and the volunteer+false-alarm release path — held up
under direct, adversarial-style verification (a real DB tamper, a real boundary-exact fixture, a
real illegal state transition attempt) rather than being taken on faith from the documentation.

Two real findings (B3, the anomaly-reopen behavior) are documented but deliberately not fixed —
both are product-flexibility questions, not implementation bugs, and changing either without
direction risks breaking an intentional design choice.

---

**TESTS EXECUTED:** 14 (see Tests Executed above) — full backend vitest run ×2, full Postman/Newman
run ×4, hash-chain determinism + tamper-evidence, risk-model skew check, 2 DPDP refusal paths,
anomaly boundary + dedup + reopen behavior, E-FIR illegal transition, rescue release (volunteer ×
false-alarm).

**BUGS FOUND:** 3 (B1 P1, B2 P3, B3 P2) + 1 flagged behavior (not classified as a bug).

**BUGS FIXED:** B1, B2. B3 and the anomaly-reopen behavior intentionally left for a product
decision.

**REGRESSION RESULTS:** Backend vitest 28/28 after fixes. Postman/Newman 269/269 after fixes, on a
freshly reset test DB. Demo database (`aaraksha`) confirmed untouched throughout.

**DOCUMENTATION:** This file.

**COMMIT:** See repository log for the commit accompanying this phase.

**REMAINING ISSUES:** B3 and the anomaly-reopen behavior await a product decision. Backend test
coverage beyond auth is still thin in *automated* form (Phase 11's job to convert this phase's
manual verification into permanent tests).

**NEXT PHASE:** Phase 3 — Tourist PWA. Awaiting explicit go-ahead per phase discipline.
