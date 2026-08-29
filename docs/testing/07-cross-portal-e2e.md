# 07 — Cross-Portal Integration (Phase 7)

## Test Objective

The flagship SOS→govt→rescuer→guardian acceptance test named explicitly in the master plan's phase
list: run one continuous, live SOS lifecycle with all four portals open simultaneously and verify
real-time (Socket.IO-driven) propagation is correct at every handoff — not portal-by-portal
correctness, which Phases 3–6 already covered individually, but whether the four independently-built
frontends actually stay in sync with each other and with the backend in real time, with no manual
refresh anywhere.

## Scope

Live, manual, four-tab simultaneous testing across `frontend/tourist`, `frontend/govt`,
`frontend/volunteer`, `frontend/guardian`, plus one real bug found and fixed in
`frontend/govt/src/hooks/useSOSSocket.ts`. No backend code changed this phase.

## Environment

Four browser tabs in one Playwright context, all against the demo backend
(`localhost:5000` / `aaraksha`): govt (admin), tourist (Karan Mehta), volunteer (Priya Deka),
guardian (Karan's tracking link). A `context.setGeolocation({ latitude: 26.1445, longitude: 91.7362 })`
override was set for the whole browser context before triggering anything — the correct way to
avoid the real-GPS-leak issue found in Phase 5 (this machine is physically in Vadodara; the
DevTools/Playwright geolocation override makes `navigator.geolocation` report the intended demo
location instead), confirmed working: no location corruption occurred anywhere in this phase.

## Tests Executed

1. Logged into all four portals in separate tabs, confirmed clean baseline state on each
   (govt SOS Management showing existing scenarios only, volunteer HomePage with no active job,
   guardian showing Karan's SAFE state).
2. Triggered a real SOS as Karan Mehta (2-second hold, default category) — confirmed **govt's SOS
   Management list updated within the same second, no reload**, with the correct (geolocation-
   override) coordinates, not a corrupted real-GPS value.
3. Confirmed **Priya Deka's volunteer app showed the new alert in "Active alerts" in real time**,
   on a tab that had been sitting idle on the dispatch list the whole time.
4. Tested the volunteer's own "I'm responding" self-response action — confirmed this is
   intentionally informational only (marks the volunteer's own dispatch `RESPONDED`) and does
   **not** auto-create a formal assignment; govt still explicitly assigns. Not a bug — confirmed
   product design by observing the SOS stayed `ACTIVE` (not `ASSIGNED`) on the govt side afterward.
5. Assigned Priya Deka from the govt SOS Management dialog — confirmed in the same instant: the
   volunteer's tab **auto-navigated to `/active-job` with no user action**, and the guardian tab
   showed "Help is on the way to Karan — Priya Deka dispatched, VOLUNTEER · ETA ~10 min" (a sane
   ETA, unlike Phase 5's "~1d 8h" before that phase's location fixes and this phase's geolocation
   override).
6. Advanced the volunteer through EN_ROUTE ("I'm on my way") and ARRIVED ("Mark arrived") —
   confirmed both the govt SOS card (`Priya Deka (EN_ROUTE)` → `Priya Deka (ARRIVED)`, live ETA
   recalculating) and the guardian tab's banner updated in real time without reload at each step.
7. Resolved the SOS from govt — confirmed the volunteer tab correctly returned to the alert list
   (its `getActiveAssignment` query returning null once resolved).
8. While resolving, noticed the resolve action produced **three** identical "SOS resolved" toasts
   from one click — investigated and found a real bug (see Bugs Found), fixed it, and re-verified
   live twice: once via a raw API call from a page that itself doesn't call the socket hook
   (`/volunteers`, relying purely on the persistent `GovtLayout`'s subscription) after a prior
   client-side navigation away from `/sos`, confirming both the duplicate-toast fix and a second,
   more severe bug the same investigation surfaced (see B2).
9. `npx tsc -b` on `frontend/govt` — clean after the fix.

## Results

| Area | Result |
|---|---|
| Tourist SOS → govt real-time list update | PASS, no reload |
| Govt SOS → volunteer real-time alert push | PASS, no reload |
| Volunteer self-response ("I'm responding") | PASS — confirmed informational-only by design |
| Govt formal assignment → volunteer auto-navigate to Active Job | PASS, no reload |
| Govt assignment → guardian real-time "help is on the way" | PASS, no reload, sane ETA |
| Volunteer EN_ROUTE/ARRIVED → govt + guardian real-time updates | PASS, no reload, both portals |
| Govt resolve → volunteer real-time return to alert list | PASS, no reload |
| Socket listener duplication across simultaneously-mounted pages | FIXED (real bug) |
| Socket connection surviving client-side navigation | FIXED (real bug, more severe than the toast symptom) |

## Bugs Found

- **B1 (P2) — `useSOSSocket` registered duplicate listeners.** `GovtLayout` (always mounted) and
  up to 4 individual pages (`SOSManagementPage`, `IncidentQueuePage`, `DashboardPage`,
  `LiveMapPage`) each independently called `useSOSSocket()`, and each independently ran its own
  `socket.on(SOS_RESOLVED, ...)` (and every other event) against the **same shared socket
  instance** — Socket.IO doesn't deduplicate handlers, so N mounted callers meant N toasts per
  real event. Live-reproduced: resolving one SOS while both `GovtLayout` and `SOSManagementPage`
  were mounted fired the "SOS resolved" toast 3 times (2 from duplicate socket listeners + 1 from
  the mutation's own direct success toast).
- **B2 (P1, more severe, same investigation) — the shared socket connection was killed on every
  client-side page navigation.** The hook's own `mountCount = useRef(0)` is scoped **per component
  instance**, not shared across the different components calling the hook — so it can only ever
  count 0→1→0 within a single instance's own lifecycle, never seeing that other instances (like
  the persistent `GovtLayout`) are still mounted. Its cleanup unconditionally called
  `disconnectSocket()` whenever *any* instance's own count reached 0, i.e. on every single page
  unmount. In practice: navigating from any page using this hook to a page that doesn't (e.g.
  `/sos` → `/volunteers`) killed the shared connection GovtLayout still needed, and since
  GovtLayout's own effect has no reason to re-run (`[token]` unchanged), nothing ever reconnected
  it — real-time updates for the rest of the session would have silently gone dead after the
  *first* page navigation. This is a significantly worse bug than the toast symptom that led to
  finding it: not "annoying duplicate notifications" but "the flagship real-time feature quietly
  stops working after one click," in an app whose entire value proposition for a live SIH demo is
  real-time SOS awareness.

## Root Cause

Both bugs share one root cause: the hook was designed assuming each "mount" could see how many
other mounts existed (the code comment said as much — "only the last one to unmount should
actually tear down the shared socket connection"), but `useRef` state is private to a single
component instance, not shared across instances. The reference-counting the hook intended never
actually happened; the code just look liked it did.

## Fixes Applied

`frontend/govt/src/hooks/useSOSSocket.ts` rewritten:
- `refCount`, `activeSosCount`, `latestSOS`, and `unregisterListeners` moved from per-instance
  `useRef`/`useState` to true module scope, shared by every call site.
- The actual `socket.on(...)` registration (all 11 events) now happens exactly once, guarded by
  `refCount === 0` at registration time — regardless of how many components call the hook.
  `disconnectSocket()` and listener teardown now correctly happen only when the shared `refCount`
  reaches zero (the true last unmount across the whole app), not on every individual instance's
  own unmount.
- Every hook instance still gets live `activeSosCount`/`latestSOS` values via a small module-level
  subscriber list (`Set<() => void>`) that triggers a local re-render on each instance when the
  shared state changes — preserving the existing return-value contract for `GovtLayout` (the only
  actual consumer of the returned values; the other 4 call sites already discarded them, calling
  the hook purely for its side effects).

## Regression Tests

`npx tsc -b` on `frontend/govt` — clean. No backend changes this phase, so the backend regression
suites were not re-run.

## Live Verification

Both fixes confirmed in a single tight test to control timing precisely: from the browser's own
JS context (`page.evaluate`, not an external `curl`, to eliminate round-trip timing uncertainty),
logged in as govt admin, resolved an SOS via a direct API call while the govt tab sat on
`/volunteers` — a page that does not itself call `useSOSSocket()` and had been client-side-
navigated to *after* leaving `/sos` (which does call it), specifically to test whether the earlier
navigation had killed the connection. Result: **exactly one** "SOS resolved" toast appeared,
proving both that the shared connection survived the navigation (B2 fixed) and that only one
listener fired (B1 fixed).

## Demo Database Changes

- Karan Mehta's SOS lifecycle was run fully to `RESOLVED` again (same trade-off already flagged in
  Phase 6's report — a live re-trigger is a known, quick, repeatable flow if the "currently
  EN_ROUTE" demo beat is wanted back before the actual screening). His location data stayed
  correct throughout this phase thanks to the geolocation override — no cleanup needed there this
  time.
- Sneha Das's SOS (resolved twice during this phase's live socket-fix verification) and her Dead
  Man's Switch were both restored: DMS reactivated (`ACTIVE`, fresh `next_trigger_at`), matching
  her canonical "running Dead Man's Switch" demo persona.
- One more stray QA artifact found and removed: a volunteer literally named "Test Reject
  Applicant" (`is_verified: false`), left over from earlier Volunteers-page reject-flow testing —
  deleted.

## Remaining Issues

None P0/P1. B2 was the most severe finding of this entire QA pass to date — a real-time system
that silently stops being real-time after one navigation is exactly the class of bug that could
have embarrassed the demo without any error ever appearing, since everything *looks* fine until an
event that should have pushed live simply doesn't. Worth specifically re-confirming during Phase
13's final acceptance pass, not because this fix is in doubt, but because this exact bug class
(assumed-shared state that isn't actually shared) is worth a habit of suspicion around in the
remaining phases.

## Evidence

Live toast counts (`page.locator(...).allTextContents()`) quoted inline during testing: 3 toasts
before the fix, 1 after, both captured directly rather than described from memory. Guardian
Portal's live ETA figures (~10 min → ~0 min as the volunteer's live position updated) observed
directly in successive snapshots, not retained as screenshots per the existing convention.

## Conclusion

All four portals stay correctly synchronized in real time across the full SOS lifecycle — this
was the actual, substantive thing this phase existed to check, and it holds. The phase also found
the most severe bug of this entire QA effort so far: a systemic flaw that would have made the govt
portal's real-time alerting quietly stop working after the very first page click in any live
session, discovered only because a *cosmetic* symptom (triplicate toasts) prompted a closer look
rather than being dismissed as a minor annoyance. Both the surface bug and its more serious root
cause are fixed and live-verified. No P0 or P1 issues remain open.

---

**TESTS EXECUTED:** 9 (see Tests Executed above), covering one complete live four-portal SOS
lifecycle (trigger → alert → assign → en route → arrived → resolve) with real-time verification
at every handoff, plus a targeted investigation and fix for an unexpected finding mid-test.

**BUGS FOUND:** 2, from one investigation (B1 P2 — triplicate toasts from duplicate socket
listeners; B2 P1 — the shared real-time connection silently dying after the first page
navigation, the more severe root cause behind B1's symptom).

**BUGS FIXED:** Both, in one rewrite of `useSOSSocket.ts`'s reference-counting from per-instance
refs to true module-level shared state. Live-verified together in a single precisely-timed test.

**REGRESSION RESULTS:** `tsc -b` clean on `frontend/govt`. No backend changes this phase.

**DOCUMENTATION:** This file.

**COMMIT:** See repository log for the commit accompanying this phase.

**REMAINING ISSUES:** None P0/P1. Recommend re-confirming B2's fix specifically during Phase 13's
final acceptance pass, given its severity and the "looks fine until it silently doesn't" failure
mode. Karan Mehta's SOS is again RESOLVED rather than live EN_ROUTE (see Phase 6's report for the
same note) — a quick, known, repeatable re-trigger if wanted before the actual screening.

**NEXT PHASE:** Phase 8 — Offline/resilience.
