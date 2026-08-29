# 03 — Tourist PWA (Phase 3)

## Test Objective

Exercise the Tourist PWA live in a real browser — not code review, not assumptions from reading
components — across its safety-critical screens, find and fix real defects, and verify every fix
against the actual running app.

## Scope

`frontend/tourist/` against a live backend on the **demo database** (`aaraksha`, `DATABASE_URL`),
since this phase is about the actual user-facing experience a judge would see, not disposable
contract testing. Playwright-driven, real logins, real form submissions, real network requests.

Covered in depth: Dashboard, Profile, Safety Center (SOS + Dead Man's Switch), Check-in, Trip
Detail (Itinerary/Map/AI Safety Briefing tabs), Community, Travel Advisory, Auth (login, logout,
session-guard on deep links, error handling on both auth forms).

Not covered in this pass, flagged for a future session: Trip creation form, Budget/Packing/Group/
News tabs in depth, Incident Report (E-FIR) filing UI, Checkpoint Pass, Privacy & Data Rights page,
keyboard-navigation/screen-reader accessibility audit, and responsive/mobile-breakpoint testing.
Scope was prioritized toward safety-critical flows per the master plan; the remainder is real,
unclaimed work, not silently skipped.

## Environment

- Backend on default port 5000, `DATABASE_URL` = demo database (`aaraksha`) — this phase
  intentionally tests against the real demo data judges will see, not the disposable test DB.
- Tourist PWA dev server on port 5173.
- Logged in as **Sneha Das** (`9876500003` / `Demo@123`) for the main walkthrough — her seeded
  scenario ("active trip with a running Dead Man's Switch") made her the right account to verify
  DMS end-to-end.

## Tests Executed

1. Full Dashboard walkthrough (active trip card, TSI, Safety strip, quick actions, Latest Alerts,
   Explore Destinations, My Trips, Rescue Readiness).
2. Profile page walkthrough (identity, language, Rescue Readiness, health info, govt ID, emergency
   contacts, guardian link, Digital Tourist ID entry point, Privacy entry point, Sign Out).
3. Cross-screen comparison of the "Rescue Readiness" metric between Dashboard and Profile.
4. Safety Center: SOS button states, Dead Man's Switch activation flow (interval picker → activate
   → live countdown card on Dashboard), Panic Shake / Push Notification toggles, incident-report
   entry point.
5. Check-in: GPS/battery capture, manual "I'm Safe" submission, DMS-reset confirmation, recent
   check-in history.
6. Trip Detail: hero, TSI ring, budget tracker, tab switching (Itinerary, Map, briefly Group/News),
   stop/activity display, **Get AI Safety Briefing** (a real Gemini call, not the offline fallback).
7. Community: Safety Reports tab (hotspot ranking, category counts, individual report cards),
   cross-checked report content for anything that looked like leftover test data.
8. Travel Advisory: destination cards, live "tourists here now" stat, weather, hospital contact.
9. Auth: logout → deep-link auth-guard redirect (`/dashboard` → `/auth` while logged out) → login
   with a wrong password, checking for real user-facing error feedback (not just a network log) →
   login with correct credentials.
10. Regression: `tsc -b` after each fix; re-verified the specific broken flow live in the browser
    after each fix; final full walkthrough confirming Sneha's session and demo scenario were
    restored to (an improved version of) their original state.

## Results

### Bug 1 — "Rescue Readiness" showed two different numbers for the same person (P2, fixed)

Dashboard showed **67%**; Profile showed **100%**, for Sneha, at the same moment. Root cause
traced to two independent implementations under an identical label:

- Dashboard used `RescueReadinessChecklist` (`components/shared/RescueReadinessChecklist.tsx`) — a
  6-item client-side check (emergency contact, medical info, govt ID, **DMS active**, TSI
  reviewed, **offline/service-worker ready**), computed fresh from data already in memory.
- Profile read `profile.rescue_readiness_score` — a **different**, narrower 4-item score computed
  server-side in `tourist.service.js#computeProfileReadiness` (blood group, medical info, ≥1
  contact, ≥2 contacts). This one is also freshly computed on every request (not a stale cached
  value — the code's own comment claims parity with the Dashboard's version, which turned out to
  be inaccurate: same freshness, different item sets).

Neither number was "wrong" on its own terms, but showing the identical label and percentage-bar
treatment with two different definitions is a real, visible inconsistency — exactly the kind of
thing a judge clicking between two screens would notice and flag.

**Fix:** `ProfilePage.tsx` now fetches the same `trips` + DMS data as the Dashboard (identical
query key, so the two screens share one TanStack Query cache entry) and renders the same
`RescueReadinessChecklist` component instead of a bespoke bar reading the narrower backend field.
One real implementation, used in both places, instead of two. Removed the now-unused `Shield`
icon import.

**Verified live:** before the fix, 67% (Dashboard) vs 100% (Profile). After: both show 67%, same
6 items, same checkmarks. Then activated Sneha's Dead Man's Switch through the real UI (see Bug/
Finding 3 below) and confirmed both screens moved to 83% together, in the same reactive update.

### Bug 2 — Login and Registration failed completely silently on error (P1, fixed)

`LoginForm.tsx` and `RegisterForm.tsx` both defined `onSuccess` on their mutation but **no
`onError` at all**. A wrong password, a duplicate phone number on registration, a duplicate govt
ID, any backend-side rejection the client-side Zod schema doesn't also encode — all of it failed
with zero user-facing feedback. No toast, no inline message, the form just sat there with the
values still filled in. The only trace was a raw `401`/`400` in the browser's network log, which no
real user would ever see.

A working `getErrorMessage(error)` helper already existed in `api/client.ts`, built for exactly
this purpose, just never wired into either auth form.

**Fix:** added `onError: (err) => toast.error(getErrorMessage(err))` to both mutations.

**Verified live** (`LoginForm`): logged out, attempted login with a wrong password, confirmed via
Playwright's `wait_for(text: "Invalid")` that a toast containing the real backend message
("Invalid phone or password") appears. Getting to a reliable verification took several attempts —
an ad-hoc DOM-polling approach and an incorrect toast-container selector both produced false
"still broken" readings before `browser_wait_for`, the tool actually built for this, settled it
cleanly. Documented here so the false starts aren't mistaken for separate bugs: the fix was correct
on the first attempt: the *test method* needed correcting, not the code.

**`RegisterForm`** received the identical fix (same pattern, same helper) and compiled cleanly, but
was not independently re-verified live with a real registration failure in this pass — code-review
confidence only, flagged honestly rather than claimed as tested.

### Finding 3 — Sneha's "running Dead Man's Switch" had already expired (not a bug, demo drift — restored)

Her only seeded DMS record was created days earlier (real wall-clock time elapsed across this
multi-day session) with a 2-hour interval; it had long since auto-triggered and was sitting
`RESOLVED`. The README's demo-account table still describes her as having "a running Dead Man's
Switch," which was no longer true of the live demo database.

Not a code defect — this is exactly what should happen to a real DMS left unattended. **Restored**
by activating a fresh Dead Man's Switch through the actual UI (1-hour interval), which
simultaneously verified the real activation flow end-to-end (interval picker → activate → live
"Active — Check-in every 60 min" card, visible on both the Safety Center and, as a countdown card,
the Dashboard) and put Sneha's account back into the state the README promises.

### Finding 4 — Leftover QA test artifacts were visible in the live Community feed (P2, fixed)

Three rows of unmistakable debug residue from earlier in this session's testing were present in
the **demo database** and rendering on the real Community page as if they were genuine tourist
content:

- A scam report: *"Testing empty incidentDate fix after the reported bug"* (Shillong, category
  `OTHER`).
- A scam report: *"QA regression test report: a street vendor near the park entrance..."*
  (Kaziranga, `HARASSMENT`).
- A destination review: *"QA regression test review: loved the walk to Elephant Falls..."*.

These read as nonsensical and unprofessional to anyone actually browsing Community — exactly the
kind of thing a judge could stumble into and reasonably read as a broken or fake feature.

**Fix:** identified all three by their unambiguous text (precise `id` match, not a broad delete)
and removed them directly from the demo database. Re-verified live: Community's report count and
feed no longer contain any trace of them; no other rows were touched.

## Root Causes

- Bug 1: two features (Dashboard's checklist, Profile's score) were built at different times
  against the same concept without being reconciled into one implementation.
- Bug 2: an `onError` handler was simply never added when these forms were built — `onSuccess` was
  written, the failure path wasn't, and nothing caught the gap because a failed login/registration
  doesn't throw or crash, it just silently does nothing.
- Finding 3: expected real-time decay of a seeded demo scenario across a long session, not a defect.
- Finding 4: earlier QA work in this session used the live demo database directly (before this
  session established the `aaraksha_test` split) and its artifacts were never cleaned up.

## Fixes Applied

- `frontend/tourist/src/pages/profile/ProfilePage.tsx` — consolidated Rescue Readiness onto the
  shared `RescueReadinessChecklist` component and its data sources.
- `frontend/tourist/src/pages/auth/components/LoginForm.tsx` — added `onError` toast.
- `frontend/tourist/src/pages/auth/components/RegisterForm.tsx` — added `onError` toast.
- Demo database (`aaraksha`): activated a real 1-hour Dead Man's Switch for Sneha Das; deleted 2
  QA-artifact `scam_reports` rows and 1 QA-artifact `destination_reviews` row, identified by exact
  `id`.

## Regression Tests

- `tsc -b` clean after every fix (3 files changed, zero type errors).
- Each fix re-verified live in the running app immediately after applying it (Rescue Readiness on
  both screens; login error toast via `browser_wait_for`; Community feed re-checked for the
  removed artifacts).
- Final full pass: logged back in as Sneha Das, confirmed her dashboard, DMS card, and Rescue
  Readiness all render correctly and consistently — the demo scenario is left in a working, in
  some respects *more* correct state than before this phase started.
- Demo database mutations were narrowly scoped (exact-`id` deletes, one legitimate DMS activation
  through the real product flow) — nothing else in `aaraksha` was touched.

## Remaining Issues

- `RegisterForm`'s fix is code-verified, not live-verified with a real failed registration attempt
  — worth a quick pass in a future phase.
- Screens/flows explicitly out of scope for this pass (see Scope above) remain untested: trip
  creation, Budget/Packing/Group/News tabs, E-FIR filing UI, Checkpoint Pass, Privacy & Data
  Rights, accessibility, responsive breakpoints.
- No automated (Playwright/vitest) test was written to lock in either fix — this phase's
  verification was manual/live, same caveat as Phase 2's, and the same recommendation applies:
  Phase 11 should convert the highest-value manual checks here (Rescue Readiness parity, the
  login-error toast) into permanent regression tests.

## Evidence

- Rescue Readiness: screenshots of Dashboard (67%) and Profile (100%) taken within the same
  session before the fix; both showing 67%, then 83% after DMS activation, after the fix.
- Login error toast: `browser_wait_for(text: "Invalid")` returned successfully post-fix (would
  have timed out pre-fix, since no error path existed to produce that text at all).
- Community artifacts: exact `scam_reports`/`destination_reviews` row IDs and text quoted above,
  confirmed removed via a live re-fetch of the Community page (`document.body.innerText` no longer
  contains either string).
- DMS: real `dead_mans_switches` row confirmed `ACTIVE`, `interval_minutes=60`, correct
  `next_trigger_at`, via direct query against the demo database immediately after activating it
  through the UI.

## Conclusion

**PHASE STATUS: PASS WITH ISSUES**

Two real, user-facing defects were found through actual browser interaction rather than code
reading alone, and both are fixed and verified: a visible data-consistency bug between two screens
showing the same metric, and a much higher-severity silent-failure bug on the two most-used forms
in the app (login and registration), where a wrong password or a rejected registration produced no
feedback whatsoever. The second one is the kind of thing that could genuinely derail a live demo —
a presenter mistyping a password with no explanation why nothing happened — so despite not being
architecturally complex, it's treated here as the phase's most important finding.

Two further real issues were found and resolved in the demo database itself, not the code: a
decayed demo scenario restored to match what the README promises, and three pieces of leftover QA
debris removed from what a judge would actually see browsing Community.

---

**TESTS EXECUTED:** 10 (see Tests Executed above) covering Dashboard, Profile, Safety Center/DMS,
Check-in, Trip Detail (incl. live AI Safety Briefing), Community, Advisory, and the full auth
logout/guard/login-error/login-success cycle.

**BUGS FOUND:** 2 code bugs (Rescue Readiness inconsistency — P2; silent auth-form failure — P1)
+ 2 non-code findings (decayed DMS demo scenario; QA artifacts in live Community data).

**BUGS FIXED:** All 4.

**REGRESSION RESULTS:** `tsc -b` clean. Every fix re-verified live post-fix. Demo database
confirmed correctly restored/cleaned, nothing else disturbed.

**DOCUMENTATION:** This file.

**COMMIT:** See repository log for the commit accompanying this phase.

**REMAINING ISSUES:** `RegisterForm` fix not independently live-verified. Several tourist screens
and flows remain out of scope for this pass (listed above). No automated regression coverage added
yet for either fix.

**NEXT PHASE:** Phase 4 — Government Command Center.
