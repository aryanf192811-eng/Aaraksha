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

## Addendum — closing out the Remaining Issues from the first pass

The four items above were tracked down and either verified or fixed. Two more real bugs turned up
along the way, both fixed and verified.

### RegisterForm — now live-verified

Attempted a real registration with Sneha Das's existing phone number (a genuine duplicate,
otherwise-valid Aadhaar/dates/emergency contact). Backend correctly returned `409`; confirmed via
`browser_wait_for` that the same `getErrorMessage()` toast fires as it does for `LoginForm`, and
the form's Step 3 data stayed intact (no data loss on a failed submit) rather than resetting.

### Previously out-of-scope screens — now covered

Checked: Digital Tourist ID (real rotating QR, live "Expires in 4:54" countdown, no console
errors), Privacy & Data Rights (all four DPDP rights present, "Export My Data" and "Delete My
Account" both real, honest placeholder-labeling on the grievance contact), Trip Creation (see
Bug 5 below), E-FIR filing (see below), and the Budget/Packing/Group/News trip-detail tabs.

The AI-backed features were specifically exercised, not just visually checked: **Get AI Safety
Briefing** (Gemini, references the trip's actual TSI score and real stop data, not generic
boilerplate) and **Generate AI Packing List** (a genuinely context-aware 20-item list — flagged
Inner Line Permit copies for the ILP-zone destination, child-specific items for a Family-type trip
— not a static template). Both real calls, not the offline fallback, no console errors.

E-FIR filing: filled and submitted a real report (Harassment, with description), got a real
case number (`EFIR-2026-000007`) and "Filed" status back, form cleared correctly after success. No
silent-failure bug here — unlike Bug 5, this mutation already had working feedback. Verified the
README's "photo never leaves the device until filing" claim is stated identically in-product
("Analyzed on your device — the photo isn't sent anywhere until you file the report."); did not
independently re-verify via network-tab inspection in this pass (a real photo-attach flow wasn't
exercised) — noted as still open below. Test E-FIR deleted from the demo database by exact ID
afterward.

### Bug 5 — Trip creation silently accepted a wizard reaching Review with no name or dates (P1, fixed)

The 3-step "Plan New Trip" wizard's Next/Review buttons (`setStep(n+1)`) never validate anything on
the way through — only the final "Create Trip" button calls `handleSubmit`. Reproduced directly:
advanced through Steps 1→2→3 with the Trip Name and both dates left completely empty, reached
Review Trip showing a title-less card and a bare "→" where the date range should be, with "Create
Trip" fully enabled. Clicking it correctly failed Zod validation (`title`/`startDate`/`endDate` are
all required) and **no `POST /api/trips` request was ever sent** — confirmed via
`browser_network_requests` — but nothing told the tourist why: no toast, no navigation back to the
step with the problem. `handleSubmit(onSubmit)` had no invalid-case handler, so react-hook-form's
already-working inline errors on Step 1 (`errors.title`, `errors.startDate`, `errors.endDate` all
already render correctly there) were never reached.

**Fix:** added `handleSubmit(onSubmit, onInvalid)`. `onInvalid` shows a toast with the first real
validation message and jumps back to Step 1 (title/travelType/date errors) or Step 2 (stop errors)
— whichever step actually holds the problem — so the tourist lands exactly where the already-built
inline error UI shows what to fix. Also added the same missing `onError` the mutation itself
lacked (same class of gap as Bug 2), for the case where the backend rejects an otherwise-valid
payload.

**Verified live, both directions:** reproduced the exact broken sequence (blank name/dates through
to Review) — confirmed it now jumps back to Step 1 with "Trip name required" and two "Select a
valid date" inline errors visible, first field auto-focused. Then completed a full valid submission
(title, dates, one real stop) — trip created successfully, navigated to its detail page, confirming
the fix didn't regress the happy path. Test trip deleted from the demo database by exact ID
afterward.

### Bug 6 — the `?token=` auth fallback worked on every authenticated route, not just downloads (P2, fixed)

Noticed while reviewing the "Export My Data" link, which (necessarily, since a plain `<a href>`
download can't set an `Authorization` header) passes the tourist's JWT as `?token=` in the URL.
Checked `middleware/auth.js`'s `extractToken()`: this fallback was accepted on **every**
authenticated route across both `authenticateTourist` and `authenticateGovt`, not scoped to the
handful of routes that actually need it. A URL-embedded token is exposed to server/proxy access
logs and browser history in ways a header token isn't, so a leaked download link could be replayed
as a general bearer credential against the entire API — not just to re-download the same file.

Found the real scope by grepping every frontend `?token=` usage (5 legitimate cases: tourist data
export, journey passport PDF, and three govt PDF downloads — incident report, analytics export, SOS
report).

**Fix:** replaced the blanket fallback with an explicit path allow-list, matched against
`req.originalUrl` (safe across router nesting). Everything else now requires a real `Authorization`
header.

**Verified live against the running demo backend:** the legitimate data-export link still returns
`200` via `?token=`; an arbitrary non-listed route (`GET /tourists/me?token=...`) now correctly
returns `401` with the same token that used to work everywhere; the same route via a proper
`Authorization` header is unaffected. Repeated the check for the journey-passport PDF vs. its
adjacent (deliberately not-listed) `/hash` endpoint to confirm the allow-list regexes are precise,
not accidentally over-broad. Full regression after the change: backend vitest 28/28, Postman/Newman
269/269 (this middleware sits in front of nearly every endpoint the collection exercises).

## Remaining Issues

- E-FIR photo-upload flow (attach a real photo, inspect the network tab for the "never leaves the
  device until filing" claim) wasn't independently exercised — the in-product copy matches the
  README's claim, but the claim itself wasn't re-proven this pass the way it was in an earlier
  session for Community Report submissions.
- Checkpoint Pass, Privacy page, and Trip Creation are now covered functionally, but none of the
  three had an accessibility or responsive/mobile-breakpoint pass — that's still fully open.
- No automated (Playwright/vitest) test was written to lock in any of this phase's fixes —
  verification throughout was manual/live. Recommend Phase 11 convert the highest-value checks here
  (Rescue Readiness parity, both auth-form error toasts, the trip-creation invalid-submit path, the
  `?token=` allow-list) into permanent regression tests.

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
- Trip creation: `browser_network_requests` confirmed zero `POST /api/trips` calls on the broken
  attempt (validation correctly blocked it client-side) and one successful call on the fixed retry.
- `?token=` scope: six real HTTP status codes quoted above from direct `curl` calls against the
  live demo backend — two allowed routes, two now-blocked routes (one general, one the adjacent
  passport-hash endpoint), two header-auth controls.

## Conclusion

**PHASE STATUS: PASS WITH ISSUES**

Six real, user-facing or security-relevant defects were found through actual interaction — browser
and API — rather than code reading alone, and all six are fixed and verified. The two most
consequential: a silent-failure bug on login, registration, *and* trip creation (three different
forms sharing the same missing-`onError`/missing-`onInvalid` root pattern) where a wrong password,
a rejected registration, or an empty required field produced zero feedback — the exact kind of
thing that could derail a live demo with no visible explanation; and an authentication scope
finding, where a JWT meant only for five specific download links was actually valid as a bearer
credential against the entire authenticated API surface once exposed via a URL.

Two further real issues were resolved directly in the demo database: a decayed DMS scenario
restored to match what the README promises, and QA-testing debris (from earlier in this session,
before the disposable test database existed) removed from what a judge would actually see browsing
Community.

---

**TESTS EXECUTED:** 10 initial (Dashboard, Profile, Safety Center/DMS, Check-in, Trip Detail, AI
Safety Briefing, Community, Advisory, auth logout/guard/login cycle) + a closing pass covering
RegisterForm's error path live, Digital Tourist ID, Privacy & Data Rights, Trip Creation (broken
and happy path), E-FIR filing, Budget/Packing/Group/News tabs, the AI Packing List, and the
`?token=` fix verified against 6 distinct routes plus the full regression suite.

**BUGS FOUND:** 4 code bugs (Rescue Readiness inconsistency — P2; silent login/register failure —
P1; silent trip-creation invalid-submit — P1; overbroad `?token=` auth fallback — P2) + 2 non-code
findings (decayed DMS demo scenario; QA artifacts in live Community data).

**BUGS FIXED:** All 6.

**REGRESSION RESULTS:** `tsc -b` clean throughout. Backend vitest 28/28 and Postman/Newman 269/269
re-run clean after the auth middleware change. Every fix re-verified live post-fix, both directions
where applicable. Demo database confirmed correctly restored/cleaned across all test data created
this phase, nothing else disturbed.

**DOCUMENTATION:** This file.

**COMMIT:** See repository log for the commits accompanying this phase.

**REMAINING ISSUES:** E-FIR photo-privacy claim not independently re-verified via network
inspection. Accessibility and responsive/mobile-breakpoint testing remain fully open across the
whole Tourist PWA. No automated regression coverage added yet for any of this phase's 6 fixes.

**NEXT PHASE:** Phase 4 — Government Command Center.
