# 04 — Government Command Center (Phase 4)

## Test Objective

Exercise every screen of the govt frontend (`frontend/govt/`) as a real officer would — Dashboard,
SOS Management, E-FIR Queue, Volunteers, Live Map, Risk Overview, Analytics, Checkpoint Scan —
proactively hunting the same bug class Phase 3 found repeatedly in the tourist PWA (`useMutation`
calls missing `onError`, so a failed action fails silently with no user feedback), and reconciling
the E-FIR investigation ladder enforcement added in Phase 2 against the govt frontend's own
pre-existing transition logic now that there's a real second implementation to test it against.

## Scope

`frontend/govt/` (all 8 screens) plus the two backend files the ladder reconciliation touched
(`backend/src/services/incident.service.js`). No tourist, guardian, or volunteer frontend code
changed. Backend regression re-run in full because of the second edit to `incident.service.js`.

## Environment

- Live manual walkthrough: govt frontend on `localhost:5174` against the demo backend
  (`localhost:5000` / `aaraksha`) — read-heavy navigation plus a small number of deliberate,
  reversible mutations (see Demo Database Incident below for the one mutation that was **not**
  reversible-by-design and required cleanup).
- Backend regression: isolated instance, `PORT=5099`, `DATABASE_URL` pointed at `aaraksha_test`,
  migrated (15/15, already current) and reset to a clean seed baseline before testing.

## Tests Executed

1. Grepped every `useMutation(` call across all 6 mutating govt frontend files before any manual
   testing, cross-checking each for a matching `onError` — found 2 of 6 files missing it
   (`SOSManagementPage.tsx`: `assignRescue` + `resolveSOS`; `VolunteersPage.tsx`: `verify`,
   `reject`, `createVolunteer`).
2. Fixed both files: added `import { getErrorMessage } from '../api/client'` and
   `onError: (err) => toast.error(getErrorMessage(err))` to all 5 mutations, matching the exact
   pattern already used correctly elsewhere in the govt frontend and fixed in the tourist PWA in
   Phase 3.
3. Live race-condition test on SOS Management: opened an SOS detail modal, resolved the same SOS
   via a direct `curl PATCH /api/govt/sos/:id/resolve` "underneath" the open modal, then clicked
   "Mark as Resolved" in the now-stale modal — confirmed via `browser_wait_for(text:"closed")` that
   the real backend rejection now surfaces as a toast instead of failing silently.
4. Live duplicate-data test on Volunteers: submitted "Add Volunteer" with an already-registered
   phone number (`9000055503`, the seeded volunteer Priya Deka's) — confirmed the real backend 409
   surfaces as `"Phone number already registered as a volunteer"` in a toast, modal stays open
   (form data preserved, nothing silently lost).
5. E-FIR ladder reconciliation: loaded a FILED case (`EFIR-2026-000001`) and, live in the browser,
   clicked the pre-existing "Mark UNDER INVESTIGATION" button that Phase 2's freshly-enforced
   backend ladder should reject — it did, with a real 400. This surfaced that the govt frontend's
   own `NEXT_STATUSES` map (independent of anything written this session) had two of its own
   illegal skips (`FILED → UNDER_INVESTIGATION`, `ASSIGNED → RESOLVED`), and that Phase 2's backend
   map had made `RESOLVED` fully terminal when the frontend's pre-existing design already correctly
   treated `RESOLVED → CLOSED` as a legitimate step.
6. Reconciled both sides to one map (documented in the code comment in `incident.service.js`,
   cross-referencing `IncidentQueuePage.tsx` so they don't drift apart again): `RESOLVED` is now
   `[CLOSED]` instead of `[]`, and the frontend's `NEXT_STATUSES` was corrected to match exactly.
   Reloaded the FILED case in the browser and confirmed via snapshot that only the two legal next
   states ("Mark ASSIGNED", "Mark CLOSED") are offered — deliberately did not execute the
   transition, to preserve this case's FILED status as one of the demo's intended 3-stage ladder
   examples.
7. `npx tsc -b` on `frontend/govt` — clean after all changes.
8. Backend regression: `npm test` (vitest, 28 tests) against `aaraksha_test` — 28/28 passed.
9. Backend regression: full Postman/Newman collection (124 requests, 269 assertions) against the
   isolated port-5099 instance — 269/269 passed. (See Demo Database Incident: the *first* attempt at
   this step was misdirected at the demo backend by mistake and had to be cleaned up before this
   correctly-isolated re-run.)
10. Live walkthrough of the 4 screens not otherwise exercised by a code fix: Live Map (pin
    rendering, live counts cross-checked against a direct DB query — see below), Risk Overview
    (destination cards, Predictive Risk Model badge), Analytics (all 3 charts, summary cards),
    Checkpoint Scan.
11. Checkpoint Scan error path: submitted a garbage manual code — confirmed a clear
    `"QR code is invalid."` toast, no silent failure.
12. Checkpoint Scan happy path: generated a real, live checkpoint QR token from the tourist PWA
    (logged in as Sneha Das, `GET /api/tourists/checkpoint-qr`), extracted the JWT from the network
    response, and submitted it manually on the govt side — confirmed a real check-in
    (`"Sneha Das checked in at Vns HOSTEL Checkpoint"` toast, tourist profile card rendered with
    name/phone/blood group/ID type).
13. Cross-checked Live Map's "1 SOS active" badge and Analytics'/Dashboard's "2 Still Active"
    figure against a direct `SELECT status, count(*) FROM sos_events` query — confirmed both are
    individually correct under their own (different, and both intentional) definitions: Live Map's
    badge is strictly `status = 'ACTIVE'`; Analytics'/Dashboard's is `status IN ('ACTIVE',
    'ASSIGNED')` by explicit design in `sos.repository.js`'s `countByPeriod` (self-documented in a
    comment distinguishing it from the separate `countAssigned()`). Not a bug.
14. Spot-checked Dashboard's "Recent Incidents" feed against the same direct DB query, which is how
    the second demo-data artifact below was found.

## Results

| Area | Result |
|---|---|
| SOS Management — assignRescue/resolveSOS onError | FIXED, live-verified (real race-condition rejection) |
| Volunteers — verify/reject/createVolunteer onError | FIXED, live-verified (real 409 duplicate-phone rejection) |
| E-FIR ladder (backend + frontend reconciliation) | FIXED, live-verified |
| Live Map | PASS — pin rendering, live counts, anomaly feed all correct |
| Risk Overview | PASS — Predictive Risk Model badge shows ~76% test accuracy, matching Phase 2's measured 75.6% |
| Analytics | PASS — all 3 charts and summary cards correct; "Still Active" semantics verified intentional |
| Checkpoint Scan | PASS — both error path and happy path live-verified end-to-end |
| Dashboard | PASS — summary cards and recent-incidents feed correct once demo-data artifacts (below) were removed |
| Backend regression (vitest) | 28/28 |
| Backend regression (Postman/Newman) | 269/269, against the correctly isolated test-DB instance |

## Bugs Found

- **B1 (P2) — Missing `onError` on 5 govt frontend mutations.** `SOSManagementPage.tsx`
  (`assignRescue`, `resolveSOS`) and `VolunteersPage.tsx` (`verify`, `reject`, `createVolunteer`)
  defined `onSuccess` but not `onError`, so a failed action (stale state, duplicate data, network
  error) failed completely silently — same bug class Phase 3 found repeatedly in the tourist PWA.
- **B2 (P2) — E-FIR ladder: two independent frontend bugs plus one backend design gap in Phase 2's
  own fix.** The govt frontend's pre-existing `NEXT_STATUSES` map allowed `FILED → UNDER_INVESTIGATION`
  and `ASSIGNED → RESOLVED`, both illegal skips of the investigation ladder, independent of anything
  written this session. Separately, Phase 2's backend enforcement had made `RESOLVED` fully terminal,
  which conflicted with the frontend's own (correct) assumption that `RESOLVED → CLOSED` is a real,
  legitimate step. All three found by testing the live UI against the live backend, not by code
  review alone.

## Root Causes

- B1: same root cause as Phase 3 — `onSuccess`-only mutation handlers copy-pasted without the error
  branch, across two frontends independently.
- B2: the frontend's `NEXT_STATUSES` map and the backend's status-transition rules were never a
  single source of truth — they were written independently and had silently drifted apart. Phase
  2 enforced a ladder on the backend without first checking what the frontend already assumed, and
  that assumption turned out to be right about `RESOLVED → CLOSED` and wrong about the two skips.

## Fixes Applied

- `frontend/govt/src/pages/SOSManagementPage.tsx`, `VolunteersPage.tsx`: added `onError` +
  `getErrorMessage()` toast to all 5 mutations.
- `backend/src/services/incident.service.js`: `VALID_STATUS_TRANSITIONS[RESOLVED]` changed from
  `[]` to `[CLOSED]`, with a code comment cross-referencing the frontend's map.
- `frontend/govt/src/pages/IncidentQueuePage.tsx`: `NEXT_STATUSES` corrected to
  `FILED: [ASSIGNED, CLOSED]`, `ASSIGNED: [UNDER_INVESTIGATION, CLOSED]`,
  `UNDER_INVESTIGATION: [RESOLVED, CLOSED]`, `RESOLVED: [CLOSED]`, `CLOSED: []` — now byte-for-byte
  in sync with the backend.

## Regression Tests

Backend vitest 28/28 and Postman/Newman 269/269, both run clean against a freshly reset test DB
after the second `incident.service.js` edit. `tsc -b` clean on `frontend/govt`.

## Demo Database Incident (found and corrected mid-phase)

While re-running the Postman/Newman regression after the ladder fix, the first attempt used
`--env-var "baseUrl=..."` to redirect the collection at the isolated port-5099 instance — but the
collection's environment file defines the variable as `BASE_URL` (not `baseUrl`), so the override
was silently ignored and all 124 requests ran against the **demo backend on port 5000**, i.e. the
real `aaraksha` database, in direct violation of this QA effort's core rule.

Damage was fully scoped by direct query before any cleanup: 2 test tourists ("Arjun Test Tourist",
"Priya Test Tourist"), 2 test volunteers ("Meera Test Volunteer", "Provisioned Test Volunteer"),
and 4 SOS events under the test-tourist account — all self-contained fixture data from the
collection's own registration flow, not touching any of the 5 canonical demo personas or the 3
seeded E-FIR cases. Confirmed with the user before deleting; cleanup ran as a single transaction
(delete `sos_events` → delete `volunteers` → delete `tourists`, respecting FK cascade order) and
was verified empty afterward. The regression was then correctly re-run with the right variable
names (`BASE_URL`, `BASE_URL_ROOT`, `SOCKET_URL`) against port 5099, confirmed by checking the
actual request URLs in the Newman output, reaching the same 269/269 clean result with zero risk to
the demo data.

Separately, spot-checking the Dashboard's "Recent Incidents" feed against a direct DB query
surfaced one more pre-existing artifact unrelated to the Newman incident: a RESOLVED SOS row on
Priya Sharma's account literally messaged `"QA error-path test - please ignore"`, dated today —
almost certainly left over from this same phase's SOS Management race-condition test landing on
the wrong account earlier in the session, before today's stricter test-DB discipline. Confirmed
with the user and deleted (single row, by ID). Priya Sharma's canonical "completed trip,
passport-ready, no incidents" scenario is restored.

Neither incident reflects a code defect — both were testing-process mistakes (a wrong CLI flag, an
earlier stray test row), not application bugs — but both are recorded here in full per this
effort's own non-negotiable rule about the demo database, and because a testing-process near-miss
that could have shown up as visibly wrong demo data during the actual SIH screening is exactly the
kind of thing this whole QA pass exists to catch.

## Remaining Issues

None P0/P1. Backend integration coverage for the govt frontend beyond what Postman covers is still
manual/scripted verification, not permanent automated tests — same flagged gap as Phase 2/3,
carried forward to Phase 11.

## Evidence

Screenshots captured during this phase (Live Map, Risk Overview, Analytics, Checkpoint Scan
error/success, Dashboard) and E-FIR modal snapshots showing the corrected two-button state were
reviewed inline during testing and are not retained in the repo (per the existing screenshot
cleanup convention — see `docs/screenshots/` for anything meant to persist).

## Conclusion

Phase 4 found and fixed the same silent-failure mutation bug class Phase 3 found, independently, in
a second frontend — reinforcing that this was a systemic gap rather than a one-off. It also found a
real three-part inconsistency in the E-FIR investigation ladder that only surfaced by testing the
actual frontend against the actual backend, not from reading either in isolation, and fixed it with
both sides now provably in sync. The phase's own tooling produced a real, if contained and fully
reversible, incident against the demo database — caught immediately by direct verification rather
than assumed clean, disclosed in full, confirmed with the user, and corrected before it could reach
the screening round. No P0 or P1 issues remain open.

## Correction (added during Phase 6)

B1 ("missing `onError` on 5 govt frontend mutations") was found the same way as Phase 3's
equivalent finding — `grep`ing for `useMutation` calls without an `onError` key — without first
checking `frontend/govt/src/lib/queryClient.ts`, which already configures
`defaultOptions.mutations.onError` as an app-wide default. Confirmed by reading the installed
`@tanstack/query-core@5.101.4` source (`queryClient.cjs#defaultMutationOptions`:
`{...defaultOptions.mutations, ...options}`, a shallow merge) and by a live test (`VolunteersPage`'s
duplicate-phone case reproduced with exactly one toast, not two): a mutation that omits `onError`
already inherits the global default, so B1's mutations were **not** silently failing before this
phase's fix. Unlike Phase 3's equivalent mistake, this one caused no regression — govt's merge
semantics mean a per-mutation `onError` *overwrites* the default rather than running alongside it,
so before and after this phase's fix, exactly one identical toast fires either way. The added
handlers are harmless and left in place (removing them is optional cleanup, not a bug fix); B1 is
retracted as a real defect. B2 (the E-FIR ladder reconciliation) is unrelated to this mechanism and
remains a valid, real finding.

---

**TESTS EXECUTED:** 14 (see Tests Executed above), covering all 8 govt frontend screens, 2 full
backend regression suites, and 2 live end-to-end demo-data verification passes.

**BUGS FOUND:** 2 (B1 P2 — 5 missing onError handlers; B2 P2 — 3-part E-FIR ladder inconsistency)
+ 2 testing-process incidents (misdirected Newman run; one pre-existing stray test SOS row) that
were not code defects but required demo-database cleanup.

**BUGS FIXED:** Both — all 5 onError handlers added and live-verified; the E-FIR ladder reconciled
on both backend and frontend and live-verified. Both demo-database artifacts cleaned up, confirmed
with the user before deletion in each case.

**REGRESSION RESULTS:** Backend vitest 28/28, Postman/Newman 269/269 — both re-run clean against
the correctly isolated test DB after the ladder fix. `tsc -b` clean on `frontend/govt`.

**DOCUMENTATION:** This file.

**COMMIT:** See repository log for the commit accompanying this phase.

**REMAINING ISSUES:** None P0/P1. Automated (non-manual) backend integration coverage for the govt
frontend flows remains a Phase 11 item, consistent with Phases 2 and 3.

**NEXT PHASE:** Phase 5 — Guardian Portal.
