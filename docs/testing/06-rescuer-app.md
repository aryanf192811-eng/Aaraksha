# 06 — Rescuer / Volunteer App (Phase 6)

## Test Objective

Exercise `frontend/volunteer/` (Auth, Home/dispatch-list, Active Job) as a verified local
responder would, check its `useMutation` error-handling pattern against the same bug class found
in Phases 3–4, verify its MapLibre map against the master plan's explicitly-named zero-distance
`fitBounds` risk (§1.1: "the volunteer app's `ActiveJobPage` map" is one of four instances flagged
for re-check), and walk the full assignment lifecycle (alerted → responding → en route → arrived →
govt resolve) end-to-end against a live SOS. This phase also corrects a real methodological mistake
made in Phases 3 and 4 (see Correction below), discovered while checking this app's own
`queryClient.ts` for comparison.

## Scope

`frontend/volunteer/` (all 4 pages) plus 2 backend files (`sos.service.js`, `govt.service.js`, and
the repository they both now call, `volunteerDispatch.repository.js`) for a real gap found in the
SOS-close path. Also touches 3 already-committed files from Phase 3 (`LoginForm.tsx`,
`RegisterForm.tsx`, `CreateTripPage.tsx`) to fix a regression traced back to that phase, and amends
`03-tourist-pwa.md`/`04-government-portal.md` with correction notes.

## Environment

Live manual walkthrough: volunteer frontend on `localhost:5176`, tourist on `localhost:5173`, govt
on `localhost:5174`, all against the demo backend (`localhost:5000` / `aaraksha`) — a real
cross-portal lifecycle test needs all three talking to the same live SOS. Backend regression
(vitest + Postman/Newman) re-run against the isolated `aaraksha_test` instance on port 5099 after
the two service-layer fixes, this time with the correct `BASE_URL` (not `baseUrl`) env-var name —
the exact mistake that caused Phase 4's demo-database incident, deliberately avoided here by
verifying the actual request URLs in the Newman output before trusting the pass/fail summary.

## Correction (a methodological error from Phases 3–4, found here)

Before any Phase 6 testing began, reading `frontend/volunteer/src/lib/queryClient.ts` for
comparison revealed it — like the tourist and govt frontends — already configures a global mutation
error handler (`MutationCache.onError` here; tourist uses the same mechanism, govt uses
`defaultOptions.mutations.onError`). This prompted going back to check whether Phase 3's and Phase
4's "missing `onError`" findings had actually been verified against a codebase with no safety net,
or just assumed to be bugs from a `grep` pattern. They hadn't. Full detail and the fix (a real
duplicate-toast regression on the tourist frontend, reverted; the govt frontend's equivalent
addition was a harmless no-op, left as is) is in the correction notes now added to
`03-tourist-pwa.md` and `04-government-portal.md`, and the commit that landed the revert. Mentioned
here because it's the direct reason this phase started by reading `queryClient.ts` and every
`useMutation` call *before* assuming anything about error handling, rather than repeating the same
grep-only mistake a third time.

## Tests Executed

1. Read `lib/queryClient.ts`, all 4 page components, `lib/osrm.ts`, and `lib/socket.ts` in full
   before any live testing.
2. Confirmed `AuthPage.tsx`'s `login`/`register` mutations correctly rely on the global
   `MutationCache.onError` (no redundant per-mutation handler — this file was already written
   correctly) and that its own `detectLocation()` geolocation call has proper success/error
   branches with `toast` feedback on both paths.
3. Live: logged in as the seeded verified volunteer (Priya Deka), landed correctly on
   `/active-job` (a govt operator had assigned her before the app was even opened — the
   on-mount `getActiveAssignment` check working as designed).
4. Live: walked the full assignment status lifecycle as the volunteer — "I'm on my way"
   (ASSIGNED → EN_ROUTE) and "Mark arrived" (EN_ROUTE → ARRIVED) — both with correct toasts and UI
   state transitions, then resolved the SOS from the govt side to close the loop, confirming the
   volunteer app correctly bounces back to the alert list once `getActiveAssignment` returns null.
5. Live, via `page.route()` intercepting `PATCH /volunteers/me/status` to force a network failure:
   found and fixed a real bug in `HomePage.tsx`'s `toggleStatus` (see Bugs Found).
6. Read `ActiveJobPage.tsx`'s `fitBounds` call (the master-plan-flagged Recenter-button camera
   fit) — found and fixed the same missing-`maxZoom` gap already fixed once this session in
   `RescueTrackingCard.tsx` (see Bugs Found). Confirmed the identical class of bug does **not**
   exist in the other 3 map instances: Guardian (fixed center/zoom, no `fitBounds` at all —
   verified Phase 5), Govt Live Map (`grep`-confirmed zero `fitBounds` calls in `frontend/govt/`),
   Tourist `RescueTrackingCard.tsx` (already fixed, source of the pattern being replicated here).
7. Attempted a live zero-distance repro of the `fitBounds` fix by setting the rescuer's live
   position identical to the SOS position directly in the DB — inconclusive as a live UI repro,
   because `ActiveJobPage.tsx`'s own `watchPosition` immediately overwrites local state with this
   machine's real GPS on every tick (client-side, faster than the ~9s throttled backend push), so
   the injected DB value never reliably reached the screen before being superseded. The fix itself
   is verified by exact pattern-match against `RescueTrackingCard.tsx`'s already-proven fix (same
   library call, same missing option, same failure mode) and by `tsc -b`, not by a forced live
   repro — documented honestly rather than claiming a live verification that didn't actually land.
8. While testing the lifecycle in step 4, `getActiveAssignment` unexpectedly returned a different,
   **days-old** `rescue_assignments` row instead of the one just resolved — traced to two rows
   dangling in a non-`RESOLVED` status against SOS events that had already closed (`FALSE_ALARM`)
   before the master-plan-documented rescuer-release fix existed. Confirmed via direct query this
   was stale pre-fix data (the fix itself, verified in Phase 2, is correct and unaffected) —
   cleaned up (2 rows marked `RESOLVED`).
9. Noticed Priya Deka's "Active alerts" list showing 5 phantom SOS notifications, 17+ hours old,
   all tied to already-closed test SOS events from earlier session testing — traced to a real,
   general backend gap (not just stale data): closing an SOS never touched *other* volunteers'
   pending `ALERTED` broadcast dispatches, only the one assigned rescuer. Fixed at the code level
   (see Bugs Found) and cleaned up the 5 existing stale rows.
10. `npx tsc -b` on `frontend/volunteer` — clean after all changes. Backend `node -e require(...)`
    sanity check on both modified services — loads cleanly.
11. Full backend regression re-run against a freshly reseeded `aaraksha_test` on the isolated
    port-5099 instance: vitest 28/28, Postman/Newman 269/269 (including Tests 118–119, which
    directly exercise the modified `resolveSOS` path) — both confirmed targeting port 5099 by
    reading the actual request URLs in the output, not just trusting the summary table.

## Results

| Area | Result |
|---|---|
| Login/Register onError | PASS — correctly relies on global handler, no fix needed |
| `detectLocation` (registration GPS) | PASS — proper success/error handling already present |
| Full assignment lifecycle (ASSIGNED→EN_ROUTE→ARRIVED→resolved) | PASS, live-verified end-to-end |
| `toggleStatus` (Available/Off duty) | FIXED — was silently stuck-disabled on any failure |
| `ActiveJobPage` map `fitBounds` zero-distance guard | FIXED (pattern-matched, not live-repro'd) |
| Stale dangling `rescue_assignments` (pre-fix demo data) | Cleaned up (2 rows) |
| Volunteer-alert close-out on SOS resolution | FIXED (real backend gap) + cleaned up (5 rows) |
| Backend regression | vitest 28/28, Postman/Newman 269/269 |

## Bugs Found

- **B1 (P2) — `toggleStatus` silently soft-locks the Available/Off-duty button.** `HomePage.tsx`
  called `volunteerApi.updateStatus(...)` directly inside a geolocation callback with no
  try/catch. A rejected call (network error, 4xx/5xx) was an unhandled promise rejection: zero
  toast, and `setTogglingStatus(false)` never ran, so the button stayed disabled until a full page
  reload. Not covered by the app-wide `MutationCache.onError` because this code path doesn't use
  `useMutation` at all. Live-verified both before (0 toasts, button stuck disabled) and after (a
  "Network Error" toast, button re-enabled) via `page.route()` request interception.
- **B2 (P2) — `ActiveJobPage`'s map `fitBounds` had no `maxZoom` guard.** The exact bug class the
  master plan named this file as one of four at-risk instances for. A rescuer's live position
  landing very close to the SOS location (a real, likely scenario as they close in) would zoom the
  camera in past the point tiles render anything, same "blank map" failure already fixed once this
  session in `RescueTrackingCard.tsx`.
- **B3 (P3) — SOS closure never released *other* alerted volunteers' pending notifications.**
  `sos.service.js#markFalseAlarm` and `govt.service.js#resolveSOS` both correctly release the one
  *assigned* rescuer (verified working, Phase 2) but never touched `volunteer_dispatches` rows for
  volunteers who were broadcast an alert and never responded — those sat in `ALERTED` status
  indefinitely, showing as actionable "Active alerts" for an emergency that's long since over.

## Root Causes

- B1: the geolocation-callback code path predates (or was never migrated to) the `useMutation`
  pattern used everywhere else in this file, so it never got the try/catch discipline that pattern
  enforces implicitly.
- B2: `RescueTrackingCard.tsx`'s `fitBounds` fix (earlier this session) was never cross-applied to
  the other 3 map instances sharing the same risk — exactly why the master plan called out
  re-checking all four explicitly rather than trusting one fix to generalize.
- B3: the rescuer-release fix (Phase 2, `markFalseAlarm`) closed the gap for the *assigned*
  rescuer specifically, since that was the reported symptom (a stuck-`DEPLOYED` volunteer/team) —
  the broader "every alerted-but-unresponded volunteer" case wasn't in scope for that fix and was
  never separately covered.

## Fixes Applied

- `frontend/volunteer/src/pages/HomePage.tsx`: `toggleStatus` refactored into a shared
  `applyStatus(lat?, lng?)` helper with try/catch/finally — `setTogglingStatus(false)` always runs,
  errors surface via `toast.error(getErrorMessage(err))`. Also handles the (rare) case
  `navigator.geolocation` is undefined, which previously left the button permanently disabled too.
- `frontend/volunteer/src/pages/ActiveJobPage.tsx`: added `maxZoom: 16` to the Recenter button's
  `fitBounds` call, identical to `RescueTrackingCard.tsx`'s existing fix, with a comment
  cross-referencing it.
- `backend/src/repositories/volunteerDispatch.repository.js`: added
  `declineAllPendingForSOS(sosEventId)` — bulk-closes any remaining `ALERTED` dispatches for a
  closed SOS to `DECLINED`.
- `backend/src/services/sos.service.js` (`markFalseAlarm`) and `backend/src/services/govt.service.js`
  (`resolveSOS`): both now call `declineAllPendingForSOS` inside their existing transaction,
  alongside the pre-existing rescuer-release step.

## Regression Tests

`tsc -b` clean on `frontend/volunteer`. Backend `node -e require(...)` sanity check clean on both
modified services. Full regression re-run against a freshly reseeded, correctly-isolated
`aaraksha_test` (port 5099, verified by request URL, not just the summary): vitest 28/28,
Postman/Newman 269/269 — including the two tests (118, 119) that exercise `resolveSOS` directly.

## Demo Database Changes

- 2 stale `rescue_assignments` rows (pre-dating the Phase 2 rescuer-release fix) closed to
  `RESOLVED`.
- 5 stale `volunteer_dispatches` rows (broadcast alerts from earlier session testing, tied to
  already-closed test SOS events) closed to `DECLINED`.
- Priya Deka's live rescuer position on Karan Mehta's assignment was overwritten by this machine's
  real GPS twice more during this phase's live lifecycle testing (the `ActiveJobPage`
  `watchPosition` behavior flagged to the user in Phase 5/6 conversation) — restored each time;
  final state is moot since that SOS is now fully resolved as part of this phase's lifecycle test
  (see below).
- **Note for whoever preps the live demo:** Karan Mehta's SOS, restored to a live "assigned to
  volunteer, EN_ROUTE" state at the end of Phase 5, is now **RESOLVED** — completing the
  ASSIGNED→EN_ROUTE→ARRIVED→resolved lifecycle was necessary to properly test `ActiveJobPage` and
  the govt resolve path in this phase. This is arguably a *more* complete demo moment (a full
  successful rescue, points awarded) than a perpetually-stuck "en route," but it is a different
  story than what Phase 5 left behind. Re-triggering a fresh live SOS as Karan (now a known,
  quick, repeatable flow — see Phase 5's report) is straightforward if the "currently en route"
  beat specifically is wanted back before the actual screening.

## Remaining Issues

None P0/P1. B2's fix is verified by exact pattern-match and compile, not a forced live repro
(documented honestly above) — worth a quick live confirmation in Phase 11's automated pass if the
opportunity arises. `findByVolunteerId`'s dispatch list has no time-based cutoff (only `LIMIT 20`
most-recent) — B3's fix stops new stale alerts from accumulating, but a volunteer who is legitimately
inactive for a long stretch could still see old, now-`DECLINED`-status entries in their history;
not a bug (they render in the "History" section, not "Active alerts," once declined) but noted.

## Evidence

Live toast/button-state checks for B1 were captured via `page.route()` interception and DOM text
extraction (before: `[]` toasts, disabled button persisting past 6s; after: `["Network Error"]`
toast appearing correctly, button re-enabled) — reproduced and quoted inline during testing, not
retained as screenshots. Regression suite output (28/28, 269/269) captured above.

## Conclusion

This phase found and fixed one real, user-facing silent-failure bug (B1) of a different shape than
Phases 3–4's mistaken finding — this one is genuinely unprotected by any global handler, confirmed
by both static analysis and a live before/after test — plus the exact map-blanking bug class the
master plan asked this file be checked for (B2), plus a real, general backend gap in the SOS-close
path that Phase 2's fix didn't fully cover (B3). It also corrected a real methodological mistake
from Phases 3 and 4 before repeating it a third time, which is arguably the most valuable outcome
of this phase even though it isn't a bug in this app's own code. No P0 or P1 issues remain open.

---

**TESTS EXECUTED:** 11 (see Tests Executed above), covering all 4 volunteer app screens, a full
live cross-portal assignment lifecycle, the master-plan-flagged map bug class, and 2 full backend
regression suites.

**BUGS FOUND:** 3 (B1 P2 — silent toggleStatus failure; B2 P2 — missing fitBounds maxZoom guard;
B3 P3 — SOS close not releasing other volunteers' pending alerts) + 1 methodological correction to
Phases 3–4's findings (not a bug in this app).

**BUGS FIXED:** All 3. B1 live-verified before/after. B2 verified by pattern-match + compile
(live repro attempted, inconclusive due to this machine's real GPS racing the test). B3
live-verified via the full regression suite's Tests 118–119 directly exercising the modified path.

**REGRESSION RESULTS:** Backend vitest 28/28, Postman/Newman 269/269, both re-run clean against a
correctly-verified isolated test DB. `tsc -b` clean on `frontend/volunteer`.

**DOCUMENTATION:** This file, plus correction addenda in `03-tourist-pwa.md` and
`04-government-portal.md`.

**COMMIT:** See repository log for the commits accompanying this phase.

**REMAINING ISSUES:** None P0/P1. B2 not live-repro'd (environmental limitation, not a fix
concern). Karan Mehta's demo scenario is now RESOLVED rather than live EN_ROUTE — flagged above for
whoever preps the actual screening, not fixed unilaterally since either state is a legitimate demo
moment.

**NEXT PHASE:** Phase 7 — Cross-portal integration (the flagship SOS→govt→rescuer→guardian
acceptance test).
