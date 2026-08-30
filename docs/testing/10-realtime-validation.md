# 10 — Real-Time Consistency (Phase 10)

## Test Objective

A DISCOVER survey of the Socket.IO architecture across the backend and all four frontends —
connection/reconnect handling, room-join correctness, the known duplicate-listener bug class
(already fixed once in govt's `useSOSSocket.ts`), event fan-out completeness, and stale-closure/
multi-session risk — then TEST/REPRODUCE/FIX/RETEST on every real finding. Goal: confirm real-time
updates actually stay consistent across reconnects, session changes, and navigation, not just on
the happy path a demo would exercise.

## Scope

`backend/src/socket/{index.js,emitters.js}`, `backend/src/constants/events.js`, and every
`lib/socket.ts` + every `socket.on(...)` call site across all 4 frontends (12 files). No database
schema changes this phase.

## Environment

DISCOVER via an Explore agent's static survey, verified by reading the actual source at every
cited file:line. TEST/REPRODUCE/RETEST ran against a real local backend instance (port 5099, own
process) pointed at the isolated `aaraksha_test` database (`DATABASE_URL` overridden to
`DATABASE_TEST_URL` for that process only — confirmed before starting, `aaraksha` never touched),
driven by `socket.io-client` scripts using real JWTs signed with the local `.env`'s actual
`JWT_SECRET`. No frontend dev servers were needed for the fixes that could be verified directly
against the backend; the two frontend-only fixes (govt's 3 new listeners, volunteer's socket
lifecycle move) were verified via `tsc -b` + structural code review, consistent with how
lower-risk mechanical fixes were handled in prior phases (e.g. Phase 9's B2).

## Tests Executed

1. **Backend socket auth sweep** — room structure, JWT verification path, and the
   `_io.use()` middleware's failure handling (`backend/src/socket/index.js:32-60`).
2. **All 4 frontends' `lib/socket.ts`** — reconnection config, auth-object staleness on
   reconnect, whether a cached socket is identity-checked before being reused.
3. **Every `socket.on(...)` call site** (12 files) — duplicate-registration risk (the
   `useSOSSocket.ts` refcount pattern vs. plain per-mount `useEffect`), dependency-array
   correctness, and whether each hook's owning component could realistically double-mount.
4. **Event fan-out cross-reference** — every `emitters.js` function's target rooms vs. what each
   frontend actually listens for.
5. **Live REPRODUCE/RETEST** against the isolated backend (port 5099 / `aaraksha_test`):
   - 5 auth scenarios via a real `socket.io-client` connection: no credentials, garbage token,
     expired-but-well-formed token, token signed with the wrong secret, valid tourist JWT.
   - Regression check that the untouched `guardianToken` (no-JWT) path still connects.
   - A retry-storm safety check: connect with an invalid token using the real
     `reconnectionAttempts: Infinity` config, count `connect_error` events over 8 seconds.
   - A same-tab identity-switch reproduction: port the exact fixed `connectSocket()`/
     `disconnectSocket()` logic verbatim into a throwaway script, connect as "tourist A", then
     call `connectSocket()` again with a genuinely different tourist's token, and assert (a) the
     stale socket is not silently reused, (b) a new connection is established, (c) the old socket
     is actually disconnected server-side, not just replaced client-side.
6. `npx tsc -b` on all 4 frontends after every change; `node -e "require('./src/app.js')"` and
   `npx vitest run` (28/28) on the backend after every change.

## Results

| Area | Result |
|---|---|
| Room structure (tourist/guardian/govt/volunteer) | PASS |
| Server-side room rejoin on reconnect | PASS (server re-runs full auth+connection handler on every reconnect) |
| JWT verification on missing/invalid/expired/wrong-secret token | FIXED (previously silently downgraded to a connected-but-roomless "anonymous" socket) |
| `guardianToken` (no-JWT) auth path | PASS — unchanged, regression-checked |
| Reconnection attempt cap | FIXED (10 attempts → unbounded, capped backoff) |
| Retry-storm risk from combining the two fixes above | FIXED (client-side safety valve; live-verified, 1 attempt not N) |
| Same-tab logout→login socket reuse (tourist, govt, guardian, volunteer) | FIXED (identity-mismatch check + disconnect-before-reuse; live-verified) |
| Govt duplicate-listener pattern (`useSOSSocket.ts`) | PASS — reference-correct, genuinely exercised by concurrent mounts |
| Tourist's 4 root-level socket hooks | PASS — single mount site, mutually distinct events |
| Guardian's single-page socket hook | PASS — only one screen exists, old per-mount-disconnect shape is safe here |
| Govt dashboard missing `TSI_BULK_UPDATE`/`VOLUNTEER_ASSIGNMENT_UPDATED`/`HANDOFF_VERIFIED` | FIXED |
| Volunteer socket torn down on Home→ActiveJob navigation | FIXED |
| `GOVT_JOIN_DISTRICT` room mechanism | Vestigial/dead on both ends — documented, not fixed |
| `DMS_WARNING`/`CHECKIN_CONFIRMED`/`GUARDIAN_STATUS_CHANGE` | Dead events, symmetric — documented, not fixed |
| Multi-tab/multi-session broadcast (room semantics) | Looks correct by construction — not independently live-tested with two real tabs this phase |

## Bugs Found

- **B1 (P1) — Invalid/expired/missing JWT silently downgraded a socket connection to
  `role: 'anonymous'` instead of rejecting it.** `backend/src/socket/index.js:51-55` (old) caught
  a `jwt.verify()` failure, logged a debug line, and still called `next()` — the socket connected
  "successfully" from the client's point of view but joined zero rooms. A tab whose 24h JWT
  expired (no refresh flow exists) would silently stop receiving every SOS/rescue/DMS/anomaly
  real-time update for the rest of its life, with nothing in the UI to indicate it. On a safety
  app whose entire premise is real-time emergency updates, a session just quietly going deaf is
  about as serious as this category of bug gets.
- **B2 (P1) — Same-tab logout→login (or account switch) kept broadcasting into the PREVIOUS
  user's socket room.** None of the 4 `lib/socket.ts` files ever checked whether a cached,
  still-connected `_socket` was built for the identity being requested now — `connectSocket()`'s
  guard was `if (_socket?.connected) return _socket`, full stop. Since this app's logout doesn't
  reload the page (a pure store state change), a tourist logging out and a different tourist
  logging back in on the same device/tab would keep the original tourist's socket alive, still
  joined to `tourist:{oldId}` — the new session's real-time updates never arrive at all, with no
  error, until a manual page reload. Realistic on a shared/kiosk device or quick account handoff.
- **B3 (P2) — `reconnectionAttempts: 10` with default backoff gave up permanently after well
  under a minute of continuous failure**, with no `reconnect_failed` handling and no
  reconnecting/offline UI anywhere in any of the 4 frontends. This app's stated core scenario is
  mountain/remote-trekking connectivity gaps (see existing comments in `RescueTrackingCard.tsx`
  and `ActiveJobPage.tsx`) — an outage longer than ~40s would silently and *permanently* kill
  real-time updates for the rest of that tab's life, recoverable only by a reload.
- **B4 (P2) — Govt Command Center silently dropped 3 events the backend actively computes and
  fans out to it.** `HANDOFF_VERIFIED` and `VOLUNTEER_ASSIGNMENT_UPDATED` weren't even declared in
  `frontend/govt/src/constants/enums.ts`'s `SOCKET_EVENTS`; `TSI_BULK_UPDATE` was declared but
  never subscribed to in `useSOSSocket.ts`. This wasn't a scoped design choice — the backend does
  real work (`emitters.js`) to compute and target these at `GOVT_DASHBOARD`, but the listener list
  was never updated to match, so they fell on the floor. Two of the three degraded gracefully to
  existing polling (30s for volunteers, the next risk-overview fetch for TSI); `HANDOFF_VERIFIED`
  had no fallback at all on the govt side — an operator would not learn a rescue's handoff code
  was verified (the exact gate that unlocks "Mark as Resolved") until manually refreshing.
- **B5 (P2) — The volunteer app's only socket connection was torn down the instant a volunteer
  was routed into an active job.** `HomePage.tsx`'s effect cleanup unconditionally called
  `disconnectSocket()`; `onAssigned` navigates to `/active-job`, which unmounts `HomePage` and
  runs that cleanup right as the job starts. `ActiveJobPage.tsx` never reconnects — it relies
  entirely on 20s HTTP polling and its own outbound GPS `PATCH` calls, so this was masked rather
  than absent, but any live push meant to reach a volunteer mid-job (`HANDOFF_VERIFIED` targets
  `volunteer:{id}` specifically "so their app updates too," per `emitters.js:333-334`) had no path
  to arrive — the connection was already dead by the time it would matter.

## Root Cause

B1 and B2 share a root cause: the auth/session layer was built to handle the *first* successful
connection correctly, but neither side ever asked "what if this connection's identity is no
longer valid, or no longer matches what the client thinks it is." B3 is a config value picked
without the app's own stated real-world connectivity profile in mind. B4 is drift — the emitter
side of `emitters.js` was extended (this session's own earlier rescue-handoff and cancel/decline
work added `HANDOFF_VERIFIED`/`RESCUER_ASSIGNMENT_CANCELLED`) without a corresponding sweep of
`useSOSSocket.ts`'s listener list, so newly-added emitters silently outran their consumer. B5 is a
lifecycle-ownership bug: the socket connection was scoped to a page component instead of the
authenticated session, so a route change (not a logout) tore it down — the exact same class of
bug the govt refcounted-singleton pattern was already built to solve elsewhere in this codebase,
just not applied here yet.

## Fixes Applied

- `backend/src/socket/index.js`: the JWT `catch` branch now calls `next(new Error('AUTH_INVALID'))`
  instead of falling through to `role: 'anonymous'` + `next()`; the no-credentials fallback now
  calls `next(new Error('AUTH_REQUIRED'))` the same way. Confirmed via grep that every real
  frontend call site always supplies a `token` or `guardianToken` — no legitimate intentionally-
  anonymous connection exists anywhere in the app, so rejecting both cases is safe. The
  `guardianToken` branch is untouched.
- `frontend/{tourist,govt,guardian}/src/lib/socket.ts` (identical files) and
  `frontend/volunteer/src/lib/socket.ts` (adapted for its single-role signature):
  - `connectSocket()` now tracks the identity (`role:token`, or just `token` for volunteer) the
    cached socket was built with in a new module-scope `_identity`, and disconnects the stale
    socket before creating a new one whenever the requested identity differs — fixes B2.
  - `reconnectionAttempts: 10` → `Infinity`, with `reconnectionDelayMax: 10000` added to cap
    backoff growth instead of retrying instantly forever — fixes B3.
  - New `connect_error` handling: on `AUTH_INVALID`/`AUTH_REQUIRED` specifically, calls
    `socket.disconnect()` to stop further reconnection attempts — without this, combining B1's
    now-real rejection with B3's unbounded retries would create a permanent retry storm against
    an expired token. This is a fix for a regression risk introduced by this phase's own other two
    fixes, not a pre-existing bug.
- `frontend/govt/src/constants/enums.ts`: added the two missing `SOCKET_EVENTS` entries
  (`HANDOFF_VERIFIED`, `VOLUNTEER_ASSIGNMENT_UPDATED`).
- `frontend/govt/src/hooks/useSOSSocket.ts`: added `onHandoffVerified` (toast + invalidate
  `['govt','sos']`/`['govt','dashboard']`), `onTsiBulkUpdate` (silent invalidate of
  `['govt','risk-overview']`/`['govt','dashboard']` — no toast, hourly per-tourist recalcs can
  burst and would flood the operator), and `onVolunteerAssignmentUpdated` (silent invalidate of
  `['govt','volunteers']`/`['govt','sos']`, matching the existing silent `onRescuerUpdate`
  pattern) — registered/unregistered in the same module-scope listener list as every other event
  in this file. Fixes B4.
- `frontend/volunteer/src/hooks/useVolunteerSocketSync.tsx` (new): the `VOLUNTEER_SOS_ALERT`/
  `VOLUNTEER_ASSIGNED` connect+listen logic moved out of `HomePage.tsx` into a hook mounted once
  at the app root, mirroring the tourist app's proven `AppWithSync` pattern — connects when
  `token` becomes available and stays connected across in-app navigation; its cleanup only calls
  `socket.off(...)`, never `disconnectSocket()`. `frontend/volunteer/src/main.tsx`: added an
  `AppWithSync` wrapper rendering this hook, mounted before `<Routes>`. `HomePage.tsx`: the old
  per-page connect/listen effect removed entirely; `disconnectSocket()` now only fires from
  `handleLogout`, the one genuine session-teardown point. Fixes B5.

## Regression Tests

`npx tsc -b` clean on all 4 frontends after every change (one real error caught and fixed along
the way — an unused `data` parameter on the new `onHandoffVerified` handler). Backend
`node -e "require('./src/app.js')"` loads cleanly and `npx vitest run` passes 28/28, both re-run
after each backend change and once more with everything applied together.

## Live Verification

All against a real local backend process (port 5099) with `DATABASE_URL` overridden to
`DATABASE_TEST_URL` for that process only — confirmed before starting via the string containing
`aaraksha_test`; the demo `aaraksha` database was never touched or pointed at.

- **B1 (auth rejection)**, via a `socket.io-client` script and 5 real connection attempts:
  no credentials → `connect_error: AUTH_REQUIRED`; garbage token → `AUTH_INVALID`; a
  well-formed but expired token (`expiresIn: -10`) → `AUTH_INVALID`; a token signed with the
  wrong secret → `AUTH_INVALID`; a genuinely valid tourist JWT → connects successfully. All 5
  passed. Regression-checked the untouched `guardianToken` path still connects with no JWT at
  all, as designed.
- **B3 + the retry-storm regression risk**, together: connected with an invalid token using the
  real `reconnectionAttempts: Infinity` config and counted `connect_error` events over 8 seconds
  — exactly 1, not a storm, confirming the `connect_error` safety valve actually halts retries
  rather than looping forever against a permanently-invalid credential.
- **B2 (same-tab identity switch)**: ported the exact fixed `connectSocket()`/`disconnectSocket()`
  logic into a standalone script and ran it against the live server with two distinct real
  tourist JWTs. Confirmed: (a) calling `connectSocket()` again with the *same* still-connected
  identity reuses the cached socket (no wasteful reconnect for the common case); (b) calling it
  with a *different* identity does **not** return the stale socket; (c) the new identity's
  connection succeeds with a different socket ID; (d) the old socket is genuinely disconnected
  server-side afterward, not just orphaned client-side. All 4 assertions passed.
- **B4 and B5**: verified structurally rather than via a live browser session — `tsc -b` clean,
  and direct confirmation that `HomePage.tsx` no longer imports or calls `connectSocket`
  anywhere, and its only remaining `disconnectSocket()` call site is `handleLogout`. Both fixes
  are mechanical additions/moves following exactly the shape of already-proven working patterns
  in this codebase (govt's existing 12+ listeners for B4; tourist's existing `AppWithSync` for
  B5) rather than new logic, so this level of verification was judged proportionate — full
  cross-portal live confirmation of these two is a reasonable Phase 11 regression-suite candidate
  if browser automation capacity allows.

## Demo Database Changes

None. All live testing this phase ran against the isolated `aaraksha_test` instance via a
separate local backend process; `aaraksha` was never started against, queried, or mutated.

## Remaining Issues

- **P3, not fixed — `GOVT_JOIN_DISTRICT` is a fully vestigial room mechanism.** The server handler
  exists (`backend/src/socket/index.js:71-76`) and the event name is mirrored in 3 frontend enum
  files, but no frontend ever emits it and no backend emitter ever targets a district-scoped room.
  Either wire it up for real (per-district govt dashboards) or remove it — currently dead code on
  both ends, not a live inconsistency.
- **P3, not fixed — 3 declared-but-unused events** (`DMS_WARNING`, `CHECKIN_CONFIRMED`,
  `GUARDIAN_STATUS_CHANGE`): zero emit sites, zero listeners, symmetric on both sides so no
  runtime behavior is affected — just noise in the constants files. Candidate for a documentation/
  cleanup pass, not a bug fix.
- **P3, not independently live-tested — genuine multi-tab/multi-session broadcast.** The room
  design (`io.to(room).emit(...)`) supports the same tourist/govt operator receiving updates on
  two simultaneous tabs or devices by construction, and nothing restricts room membership to one
  socket — but this phase didn't open two real concurrent tabs against a live server to prove it
  end-to-end. Recommended as a Phase 11 automated-regression candidate given the tooling now
  exists (this phase's own live scripts) to script it directly.
- Per the recurring note in every phase so far: no permanent automated regression suite exists
  for any of the 5 fixes in this phase beyond the scripted live verification performed here —
  flagged again for Phase 11.

## Evidence

Raw `connect_error` messages, socket IDs, and pass/fail assertions quoted directly from the live
`socket.io-client` script output during verification (see Live Verification above) — not inferred
from indirect signals.

## Conclusion

Two of the five findings (B1, B2) are the kind of bug that would never surface in a scripted demo
walkthrough — they require either a token aging out mid-session or a same-tab account switch,
neither of which a rehearsed SOS→rescue flow would ever exercise — but both meant a real user
could end up watching a real-time safety app that had silently stopped updating, with zero visible
signal. Both are now fixed and live-verified against a real server with real JWTs, not just
reasoned about. B3 directly reflects the app's own stated rural-connectivity premise, which the
original 10-attempt cap contradicted; fixing it introduced a real regression risk (retry storm)
that was caught and closed in the same pass rather than left for a later phase to find. B4 and B5
are more ordinary drift/lifecycle bugs, fixed by extending patterns already proven correct
elsewhere in this codebase. Three items are documented rather than fixed — two are genuinely dead
code with no runtime effect, and the third (multi-tab live confirmation) is a real gap in this
phase's own test coverage rather than a known-broken behavior.

---

**TESTS EXECUTED:** 6 categories (see Tests Executed above) — a static survey across backend +
all 4 frontends, then live REPRODUCE/RETEST of every finding against a real local server on the
isolated test database.

**BUGS FOUND:** 5 — B1 (P1, silent anonymous fallback on invalid JWT), B2 (P1, same-tab
logout/login reused a stale socket), B3 (P2, reconnection permanently gave up after ~40s), B4
(P2, govt dashboard silently dropped 3 real-time events), B5 (P2, volunteer socket torn down on
navigation into the active job).

**BUGS FIXED:** All 5, live-verified for B1/B2/B3 (real connection attempts against a live
server), structurally verified for B4/B5 (type-check clean, mechanical extension of already-
proven patterns).

**REGRESSION RESULTS:** Backend `npx vitest run` 28/28 passing; `node -e "require('./src/app.js')"`
loads cleanly. `npx tsc -b` clean on all 4 frontends.

**DOCUMENTATION:** This file.

**COMMIT:** See repository log for the commit accompanying this phase.

**REMAINING ISSUES:** `GOVT_JOIN_DISTRICT` and 3 other events are dead code with no runtime
effect (P3, cleanup candidate). Genuine multi-tab broadcast behavior not independently live-
tested this phase (P3, → Phase 11 candidate). No permanent automated real-time regression suite
(recurring note, → Phase 11).

**NEXT PHASE:** Phase 11 (per `docs/testing/QA-MASTER-PLAN.md`: Automated/E2E regression; per
`docs/testing/README.md`'s index: UI/UX QA — confirm which with the user before starting, since
the two planning documents order phases 11/12 differently).
