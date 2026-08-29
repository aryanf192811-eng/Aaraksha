# Aaraksha — Final System-Wide QA Master Plan

> Enhanced from the user-provided base plan (2026-08-29) with codebase-specific edge cases,
> concrete assertions, and infrastructure prerequisites discovered during Phase 1's system audit.
> The base plan's structure, severity model, phase discipline, and documentation format are
> preserved verbatim — everything below is additive.

**Workflow:** DISCOVER → TEST → REPRODUCE → FIX → RETEST → REGRESSION TEST → DOCUMENT → COMMIT.
**Rule:** execute ONE phase at a time. Stop and report after each. Never mark a phase PASS with an
open P0.

---

## 0. Non-negotiable environment rule

**Two databases, never confused:**

| DB | URL var | Purpose | Rule |
|---|---|---|---|
| `aaraksha` | `DATABASE_URL` | The SIH demo/presentation database | **Never reset. Never bulk-mutate. Never point a test script at it.** |
| `aaraksha_test` | `DATABASE_TEST_URL` | Disposable integration/E2E testing | Reset freely. Migrate freely. Seed freely. |

Phase 1 found `aaraksha_test` **5 migrations behind** `aaraksha` (missing `011_safety_anomalies`
through `015_data_rights` — see [01-system-audit.md](./01-system-audit.md)). **Phase 2 opens by
migrating `aaraksha_test` up to date. It does not touch `aaraksha`.** Every phase from here on
must state, in its report, which database each test ran against.

Before any command that touches a database, confirm the resolved connection string's database
name is `aaraksha_test`, not `aaraksha`. `psql "$DATABASE_TEST_URL" -c 'SELECT current_database();'`
is the one-line check; run it before, not after.

---

## 1. Codebase-specific edge cases to add on top of the base plan

These are not generic QA boilerplate — each one is grounded in a real pattern, a real prior bug,
or a real gap this session's own audit and prior fixes surfaced in *this* codebase.

### 1.1 Rescue lifecycle (highest-value P0 surface)

- **Team AND volunteer release paths, independently.** `sos.service.js#markFalseAlarm` was
  previously found (this repo, earlier session) to skip releasing the assigned team/volunteer back
  to `AVAILABLE`, unlike `govt.service.js#resolveSOS`. That specific bug is fixed — but re-verify
  it holds for **both** closing paths (`resolve` *and* `false-alarm`) and **both** rescuer kinds
  (`rescue_teams.status` *and* `volunteers.status`), not just the one combination that was fixed.
  Assert: after either closing path, `SELECT status FROM rescue_teams WHERE id=$1` /
  `SELECT status FROM volunteers WHERE id=$1` returns `AVAILABLE`, and no row in
  `rescue_assignments` / `volunteer_dispatches` still points at them as active.
- **Concurrent assignment race.** Two govt operators assign different rescuers to the same SOS
  within milliseconds of each other. Expect exactly one assignment to win; the loser gets a clean
  409/400, not a silent double-assignment or an unhandled 500. Check `rescue_assignments` for
  exactly one row per `sos_event_id` with `status != 'CANCELLED'`.
- **Zero-distance geometry.** A rescuer's base/live position exactly equal (or within ~10m of) the
  SOS coordinates — the exact condition that produced the "map renders blank" bug fixed this
  session in `RescueTrackingCard.tsx` (`fitBounds` with no `maxZoom` clamp). Re-verify the same
  class of bug doesn't exist in the **govt** live map, the **guardian** portal's map, or the
  **volunteer** app's `ActiveJobPage` map — four separate MapLibre/Leaflet instances, four
  independent chances to reintroduce it.
- **Weighted dispatch scoring sanity.** The govt "Recommended" pick is scored on distance +
  category fit + reputation, not distance alone. Construct a case where the nearest rescuer has a
  category mismatch or low reputation and a farther one doesn't — assert the farther one is
  actually recommended, not just present in the list. A scoring bug that silently degrades to
  "closest wins" would be invisible in a demo where the closest rescuer also happens to be the
  right one.
- **OSRM fallback, not OSRM failure.** Kill outbound access to the public OSRM demo server (or
  point `OSRM_BASE_URL` at an unreachable host) mid-assignment. Assert every consuming surface —
  Tourist, Guardian, Govt, Volunteer maps — falls back to a straight line and says so, rather than
  showing a stale route, a blank map, or throwing in the console.

### 1.2 Dead Man's Switch

- **The exact bug class already fixed once**: `warning_sent_at` was briefly dual-purpose (a cron-
  skip sentinel *and* "warning actually sent") for demo-mode (second-granularity) switches. Confirm
  `findNeedingWarning()`'s `interval_seconds IS NULL` guard still correctly excludes demo-mode
  switches, and add the inverse case: a **minute-granularity** switch approaching its warning
  threshold *should* still fire — the fix must not have overcorrected into never warning anyone.
- **Reset races on a short (demo-mode) interval.** Reset a DMS with <10s remaining, at the same
  moment the cron would have fired it. Assert exactly one outcome — either the reset wins (status
  stays `ACTIVE`, no SOS) or the trigger wins (SOS created, reset returns a clear "already
  triggered" error) — never both, never neither.
- **Backend restart mid-window.** Kill and restart the backend process with an active DMS one
  minute from `next_trigger_at`. `next_trigger_at` is a DB column, not in-memory state, so the cron
  should pick it up correctly on the next tick after restart — assert it does, and assert it does
  **not** fire twice (once "for the missed tick" and once normally).
- **One trigger, one SOS — always.** Explicitly assert `SELECT count(*) FROM sos_events WHERE
  trigger_type='DMS' AND tourist_id=$1 AND created_at > $dms_triggered_at - interval '1 minute'`
  is exactly 1, not just "an SOS exists." A duplicate-SOS bug on DMS trigger would be easy to miss
  if the test only checks for existence.

### 1.3 Journey Integrity Hash chain

This is the single most differentiating, most fragile feature in the system — it merges three
independently-timestamped tables (`checkins`, `sos_events`, `checkpoint_scans`) into one true
chronological order before folding the hash, per `passport.service.js`'s own documented risk.

- **Merge-order correctness under clock skew.** Insert a checkpoint scan and a check-in with
  timestamps only milliseconds apart (or, if the three source queries fetch pre-sorted in
  different directions as documented, deliberately construct an interleaving that would produce
  the wrong hash if the merge trusted per-table order instead of re-sorting by timestamp). Assert
  the final hash matches an independently-computed reference chain built by re-implementing the
  fold in the test itself, not just "some hash exists."
- **Determinism across repeated fetches with no new events** — the exact table already documented
  in README (`GET /journey-passport/:tripId/hash` called twice with nothing in between must return
  byte-identical hashes). Automate this rather than trusting it as a one-time manual observation.
- **Mutation happens exactly once per real event** — fetch the hash, perform one checkpoint scan,
  fetch again (changed), fetch a third time with no new event (unchanged, identical to the second
  fetch). Three assertions, not two.
- **Genesis-block stability.** The genesis hash is derived from the trip's own facts (destinations,
  dates, travel type, budget, TSI-at-booking). Editing the trip *after* booking (if that's even
  possible via the API) must not silently change the genesis hash retroactively — or if it's
  designed to, that's a real design question worth surfacing, not assuming either way.
- **Tamper-evidence, actually tested, not just claimed.** Directly `UPDATE` one historical
  `checkins` row's timestamp or location in the test database (this is exactly the kind of
  destructive mutation the TEST DB exists for), then recompute the hash via the same code path.
  Assert the recomputed hash differs from the last-known-good hash. This is the one test that
  actually proves "tamper-evident" rather than just exercising the happy path.

### 1.4 Predictive Risk Model — train/serve skew

- **`riskModel.weights.json` was trained against a specific `FEATURE_NAMES` ordering from
  `features.js`.** If `features.js` has changed since the checked-in weights file was last
  generated (new connectivity/difficulty/zone level added, feature added/removed/reordered), the
  weight-to-feature mapping silently misaligns — every prediction becomes wrong in a way that
  looks plausible (still a number 0–100%) rather than erroring. Assert: `featureNames` recorded
  inside `riskModel.weights.json` deep-equals `FEATURE_NAMES` exported live from `features.js`
  right now. This is a single, cheap, high-value assertion that a manual QA pass would never think
  to run.
- **Explainability consistency.** For a known destination, assert the top-4 `topFactors` returned
  by `predictForDestination()` are actually the 4 largest-magnitude `weight × x[i]` terms — not
  just "4 factors exist," recompute and compare.
- **`GET /govt/risk-model/info` matches what's actually loaded**, not a stale cached copy, after a
  fresh `npm run train:risk-model` run against the test DB.

### 1.5 Unified rescuer network (migration `010_unify_rescuers`)

- **Volunteer impersonation / cross-tenant access.** Can Volunteer A fetch or act on Volunteer B's
  active assignment by guessing/enumerating an assignment ID? `volunteer.repository.js` /
  `rescue.repository.js` ownership checks need explicit adversarial coverage here, not just RBAC-
  by-role — this is ownership-by-row, a different and easier-to-miss class of bug than role
  checking.
- **Unverified volunteer dispatch-eligibility.** A volunteer who registered but was never verified
  by a district officer must not appear in the govt dispatch panel's candidate list, and a direct
  API call attempting to assign an unverified volunteer must be rejected server-side (not merely
  hidden client-side — the classic "the button just isn't shown" false sense of security).
- **Walk-in-provisioned account, one-time password.** Govt-provisioned volunteer accounts get a
  generated OTP "shown once." Assert it's genuinely not retrievable a second time via any API
  response (not returned again on a subsequent `GET` of that volunteer's record).

### 1.6 E-FIR + on-device photo evidence

- **The photo genuinely never leaves the device before filing** — README's own specific claim.
  Verify via the browser Network tab / `browser_network_requests`: attach a photo, let COCO-SSD
  tag it, and confirm **zero** network requests contain the image bytes until the "File Report"
  submit actually fires. This is directly testable and directly falsifiable, unlike most privacy
  claims.
- **Category suggestion is always overridable, never forced** — select a photo that triggers a
  `VEHICLE_ACCIDENT` suggestion, then manually pick a different category, submit, and confirm the
  filed report's category is the manually-chosen one, not silently reverted to the suggestion.
- **CCTNS/BNS section reference correctness** — spot-check that the advisory section reference
  shown actually corresponds to the selected category (a hardcoded/mismatched mapping here would
  be embarrassing in front of judges who know the domain).
- **Investigation ladder can't skip or go backward illegally** — `FILED → ASSIGNED →
  UNDER_INVESTIGATION → RESOLVED/CLOSED`. Attempt a direct API status-update call that jumps
  `FILED → RESOLVED` or moves `RESOLVED → FILED`; assert the transition is rejected if the service
  layer is meant to enforce ordering (confirm the actual intended rule first — don't assume
  strict linear-only without checking `efirReport.service.js`).

### 1.7 Anomaly detection (rule-based, cron-driven)

- **6-hour-quiet and 60km-drift thresholds need synthetic fixture data**, not real-time waiting —
  insert a `tourist_locations` row (or its equivalent stale-timestamp condition) that's exactly on,
  just under, and just over each threshold, run the cron job function directly (not wait for the
  real minute-cadence schedule), and assert the boundary behaves as documented (`>` vs `>=`
  matters here — off-by-one at a threshold is a real, common bug class).
- **One anomaly, one flag** — the same "no duplicates" discipline as DMS. Running the anomaly cron
  twice in a row against the same still-quiet tourist must not create a second open
  `safety_anomalies` row.
- **Resolved anomaly doesn't reappear** — after a govt operator resolves an anomaly, the very next
  cron tick (tourist still objectively quiet/drifted) must not silently reopen it without a fresh
  qualifying change, unless that's the deliberately intended behavior — again, confirm the intended
  rule in `anomaly.service.js` before asserting either way.

### 1.8 Data rights (DPDP) — the refusal paths are the real test

The happy path (export works, deletion works) is the easy 80%. The DPDP compliance claim actually
rests on the refusal logic:

- Attempt **Delete My Account** while an open (`ACTIVE`) SOS exists → must be refused, with the
  stated reason, not a silent no-op or a 500.
- Attempt it while an open (`FILED`/`ASSIGNED`/`UNDER_INVESTIGATION`) E-FIR exists → same.
- After a *legitimate* deletion (no open SOS/E-FIR), assert: `full_name`, `phone`,
  `blood_group`/medical notes, `govt_id_hash`, and `govt_id_suffix` are all actually scrubbed in
  the DB row (not just hidden in the UI), `is_active = false`, and — critically — that any
  **resolved** SOS/closed E-FIR history tied to that tourist_id still exists and is still
  queryable for legitimate audit purposes (the "anonymize, don't delete" design point).
- **Export completeness** — the downloaded export actually contains every category the privacy
  notice claims it does (trips, check-ins, SOS events, E-FIRs, checkpoint scans) for a tourist with
  data in all of those tables, not just the categories that happen to be non-empty for a thin demo
  account.

### 1.9 Offline-first (Dexie) and the two genuinely different "offline" stories

Be precise about which offline mechanism is under test — this codebase has two unrelated ones and
conflating them produces meaningless test results:

- **App-offline, device-online-capable-later** (Dexie/IndexedDB queue): airplane-mode the browser
  mid-session, attempt an SOS/check-in, confirm it queues locally and the UI says so honestly (not
  a fake "sent" confirmation), restore connectivity, confirm it syncs without duplication.
- **Device genuinely has no data signal** (SMS/Twilio path): this is a structurally different
  mechanism (`sms:` URI + a Twilio inbound webhook), not just "Dexie but for SOS." Test the webhook
  path directly against the test DB with a crafted inbound payload — don't assume the Dexie test
  above exercises this path too, it doesn't.
- **Both queued simultaneously** — an SOS queues in Dexie while offline, and separately a DMS
  fires and sends its own offline path. On reconnect, assert no duplicate SOS event results from
  the two mechanisms racing to sync.

### 1.10 Documentation-vs-reality discrepancies already found in Phase 1

(Full detail in [01-system-audit.md](./01-system-audit.md) — listed here so later phases don't
re-discover and re-report the same known gaps as new findings.)

- `UI_GUIDE.md`'s "Portal Overview" table lists only 3 portals — the Rescuer/Volunteer app is
  entirely absent from that doc despite being fully built and documented everywhere else.
- `SIH_COMPETITIVE_ANALYSIS.html` is referenced by `README.md` (documentation map, roadmap, and
  the presentation-building slide guide) but does not exist in the repository.
- Postman collection is 121 requests / 26 folders on disk; README states 124 requests / 269
  assertions / 22 folders. Assertion count wasn't independently re-verified — worth a real count
  in Phase 2, not just the request/folder drift noted here.
- `aaraksha_test` was 5 migrations behind `aaraksha` before this plan was written (now the first
  action of Phase 2).

---

## 2. Phase-by-phase execution order (unchanged from the base plan, restated for reference)

PHASE 1 — System audit *(this document's companion, [01-system-audit.md](./01-system-audit.md) — COMPLETE)*
PHASE 2 — Backend/API/DB *(opens by migrating `aaraksha_test`)*
PHASE 3 — Tourist PWA
PHASE 4 — Government Command Center
PHASE 5 — Guardian Portal
PHASE 6 — Rescuer App
PHASE 7 — Cross-portal integration (the flagship SOS→govt→rescuer→guardian acceptance test)
PHASE 8 — Offline/resilience
PHASE 9 — Security
PHASE 10 — Real-time consistency
PHASE 11 — Automated/E2E regression
PHASE 12 — UI/UX polish
PHASE 13 — Final acceptance + documentation, demo-environment re-verification

Each phase: Inspect → Test → Reproduce → Fix → Retest → Regression test → Document under
`docs/testing/` → Commit → Report → **STOP**. Never continue into the next phase automatically.

Severity model, report structure, and commit-message conventions are exactly as specified in the
base plan (P0–P3, the eleven-section report template, `test:`/`fix:`/`docs:` commit prefixes, no
`Co-Authored-By: Claude`, my configured git identity only).
