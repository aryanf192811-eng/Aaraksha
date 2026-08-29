# 08 — Offline / Resilience (Phase 8)

## Test Objective

Per the master plan's own framing (§1.9): this codebase has **three genuinely different
offline/resilience mechanisms**, and conflating them produces meaningless results. Tested each
separately: (1) the Dexie/IndexedDB app-offline queue + Workbox background sync, (2) the
Twilio SMS-inbound webhook — a device with *no data signal at all*, and (3) whether the two
racing together (or racing the Dead Man's Switch) can create duplicate incidents.

## Scope

Backend: `webhook.service.js` (the SMS-inbound path), `dms.service.js`, `sos.service.js`.
Frontend: `db.ts` (Dexie schema), `useOfflineSync.ts`, `useSOS.ts`, `vite.config.ts`'s Workbox
config, `OfflineBanner.tsx`, `SOSPage.tsx`. No new endpoints or schema this phase.

## Environment

DISCOVER (static code survey) done first, then TEST/REPRODUCE live against the isolated
`aaraksha_test` DB via `supertest` (直接 in-process requests to `app.js`, not a running server —
needed to control exact timing of two back-to-back webhook posts). No `aaraksha` (demo) writes
this phase.

## Tests Executed

1. Mapped the Dexie offline queue (`db.ts`'s `offlineSOSQueue` table), `useOfflineSync.ts`'s
   `online` listener, and confirmed `useSOS.ts` does **not** trust `navigator.onLine` alone —
   `probeConnectivity()` does a real 2.5s-timeout `GET /health` first, since `navigator.onLine`
   reads `true` on a dead Wi-Fi/captive portal. Confirmed the UI is honest: `sendOfflineSMS()`
   never claims delivery, only that the SMS app was opened.
2. Found a **second, independent retry mechanism** stacked on top of the Dexie queue:
   `vite.config.ts`'s Workbox config registers a real Background Sync queue
   (`backgroundSync: { name: 'sos-post-queue' }`) for `POST /api/sos`, which survives a closed
   tab — separate from `useOfflineSync`'s same-tab `online`-event fallback. Two independent
   retry paths for the same failed POST is a real duplicate-submission risk, covered below.
3. Traced the Twilio SMS-inbound path (`webhook.controller.js` → `webhook.service.js`) end to
   end: structured `AARAKSHA_SOS|ID:...|LAT:...` pattern, the loose SAFE/OK/CHECKIN pattern,
   malformed-input handling (persists every inbound message via `inboundRepo.create()` before
   parsing, never crashes, never leaves the sender without a reply).
4. Confirmed `processInboundSMS`'s SOS branch called `sosRepo_t.create()` **directly**, not
   through `sos.service.js#createSOS` — meaning it had none of this session's earlier
   same-tourist ACTIVE-incident dedup guard, and never called `emitGuardianSOSAlert`. Live
   reproduced against `aaraksha_test`: two webhook POSTs for the same tourist (a real
   double-send scenario — retry after no confirmation, a second attempt from panic) via
   `supertest`, checked `sos_events` row count directly.
5. Checked Twilio inbound-request authentication: **zero signature verification anywhere** in
   `backend/src` (grep-confirmed) — only `webhookLimiter` rate-limiting protects the endpoint.
   `TWILIO_AUTH_TOKEN` is loaded but only used for the *outbound* Twilio SDK client, never to
   validate `X-Twilio-Signature` on inbound requests.
6. Checked `SOSPage.tsx`'s own connectivity indicator (top-right Wifi/WifiOff icon) — found it
   read `navigator.onLine` directly as a one-time snapshot at render, not the reactive
   `isOnline` store state `useOfflineSync` maintains via `online`/`offline` listeners.
7. Checked where `OfflineBanner` (the honest "You're offline — trip data cached · SOS via SMS"
   banner) is actually rendered — only `DashboardPage.tsx`, confirmed via grep across `src/`.
8. `npx tsc -b` on `frontend/tourist`, `npx vitest run` in `backend/` after each fix.

## Results

| Area | Result |
|---|---|
| Dexie offline queue — UI honesty (never fakes delivery) | PASS |
| Dexie queue — connectivity check uses real probe, not bare `navigator.onLine` | PASS |
| SMS-inbound — malformed/unknown-tourist/invalid-coordinate handling | PASS, no crash, always replies |
| SMS-inbound — same-tourist duplicate-SOS suppression | FIXED (real gap — path bypassed the guard entirely) |
| SMS-inbound — guardian notified | FIXED (real gap — `emitGuardianSOSAlert` was never called on this path) |
| Twilio inbound signature verification | **OPEN — P1/P2, handed to Phase 9 (Security)**, not fixed this phase |
| SOSPage connectivity icon reactivity | FIXED |
| `OfflineBanner` visible on the Safety Center, not just Dashboard | FIXED |
| Two independent retry mechanisms (Workbox background sync + Dexie/`useOfflineSync`) for one POST | Documented, not a bug per se — see Remaining Issues |

## Bugs Found

- **B1 (P1) — SMS-inbound SOS had no duplicate-incident guard.** `webhook.service.js#processInboundSMS`
  called `sosRepo_t.create()` directly inside its own `withTransaction` block instead of routing
  through `sos.service.js#createSOS`, so it never got the same-tourist ACTIVE-incident check
  added earlier this session. A tourist who re-sends the offline SMS (no confirmation reached
  them, or they panic-resend) — or whose Dexie-queued/Background-Synced app POST *also* lands
  around the same time — could produce two independent `ACTIVE` `sos_events` rows for one real
  emergency. Live-reproduced: two webhook POSTs 400ms apart for the same tourist ID produced
  exactly one `sos_events` row (`trigger_type: SMS_INBOUND`) once fixed; unfixed, it produced two.
- **B2 (P1) — SMS-inbound SOS never notified the guardian.** `processInboundSMS` called
  `emitSOSReceived` (govt dashboard only) but never `emitGuardianSOSAlert`, unlike
  `sos.service.js#createSOS` and `dms.service.js#processDMSTriggers`, which both notify the
  guardian room for their own triggers. This is the one trigger path where the gap matters
  most: a tourist using the SMS fallback has, by definition, no signal to call their guardian
  directly either — the app is the only channel that could have told them, and it silently
  didn't.
- **B3 (P2) — `SOSPage`'s connectivity icon was a stale one-time read.** `navigator.onLine` was
  read once at render via `{navigator.onLine ? <Wifi/> : <WifiOff/>}` — not reactive, so it
  never updated if connectivity changed while the page stayed mounted (exactly the scenario a
  tourist deciding whether to trust the SOS button cares about).
- **B4 (P2) — `OfflineBanner` only reachable from the Dashboard.** A tourist who opens the app
  offline and navigates straight to the Safety Center (the nav bar's own raised SOS button
  leads there) saw no indication of offline state or the SMS fallback at all on that screen —
  only the small header Wifi icon, with no explanation of what it means for the SOS button
  about to be held.
- **Not fixed this phase, flagged for Phase 9 — Twilio inbound requests are not
  authenticated.** No `X-Twilio-Signature` validation exists anywhere; the webhook is reachable
  by anyone who can reach the endpoint and knows or guesses a tourist's UUID, with only rate
  limiting as a barrier. This is a real vulnerability (forged SOS creation, or forged SAFE
  check-ins that could suppress a genuine DMS timeout) but is an authentication/security
  concern squarely in Phase 9's scope, not an offline-resilience one — recorded here so Phase 9
  doesn't have to rediscover it, per the master plan's own §1.10 convention for known gaps.

## Root Cause

B1 and B2 share one root cause: `webhook.service.js` was written as its own self-contained SOS
creation path (own transaction, own `sosRepo.create()` call, own side-effect list) rather than
delegating to `sos.service.js#createSOS`, so any protection or notification later added to
`createSOS` — including this session's own dedup guard — never automatically reached this
third entry point. `dms.service.js#processDMSTriggers` has the same structural shape (its own
inline `create()` call) but *did* get its own copy of the dedup guard added alongside
`sos.service.js`'s earlier this session; the SMS path was the one entry point missed at the time
because it wasn't touched in that pass.

## Fixes Applied

- `backend/src/services/webhook.service.js`: `processInboundSMS`'s SOS branch now calls
  `sosRepo_t.findLatestActiveByTouristId(tourist.id)` before creating a row — mirrors the exact
  pattern already in `sos.service.js#createSOS` and `dms.service.js#processDMSTriggers`. On a
  duplicate, the inbound record is still linked to the existing SOS via `markParsed` (so the
  audit trail shows the SMS arrived) but no second row is created and no side effects re-fire.
  Also added `emitGuardianSOSAlert(tourist.guardian_token, sosEvent, tourist)` alongside the
  existing `emitSOSReceived` call for the non-duplicate path.
- `frontend/tourist/src/pages/safety/SOSPage.tsx`: header connectivity icon now reads
  `useSafetyStore((s) => s.isOnline)` instead of a one-time `navigator.onLine`; added
  `<OfflineBanner />` at the top of the page, same component and placement pattern as
  `DashboardPage.tsx`.

## Regression Tests

- `node -e "require('./src/app.js')"` — loads cleanly after the webhook.service.js change.
- `npx vitest run` — 28/28 passing (no existing suite covers `webhook.service.js` directly —
  same gap already flagged in earlier phases: integration coverage beyond auth is still
  manual/scripted, not permanent automated tests).
- `npx tsc -b` on `frontend/tourist` — clean after the SOSPage changes.

## Live Verification

Against `aaraksha_test`, via `supertest` directly against the Express app (in-process, so two
POSTs could be sequenced with a controlled 400ms gap for the fire-and-forget processing to
finish each time, rather than racing a real network round-trip):

1. Registered a fresh test tourist.
2. POST `/api/webhooks/twilio-inbound` with a well-formed `AARAKSHA_SOS|...` body — 200 response,
   `sos_events` gained one `ACTIVE` row (`trigger_type: SMS_INBOUND`).
3. POST a second, different `AARAKSHA_SOS|...` body (different lat/lng/category) for the **same**
   tourist ID 400ms later — 200 response, but `sos_events` still shows exactly **one** row
   (confirmed via direct `SELECT ... WHERE tourist_id = $1`, not inferred from the HTTP response
   alone).
4. Confirmed `emitGuardianSOSAlert` was actually invoked on the non-duplicate path — this test
   harness never calls `initSocket`, so the call surfaces as a caught-and-logged
   `"Socket.IO not initialized"` error rather than a silent no-op; that log line appearing at
   all is proof the function is now being called, where before this fix it never was.

## Demo Database Changes

None. All testing this phase ran against the isolated `aaraksha_test` instance; `aaraksha` (the
demo DB) was not touched.

## Remaining Issues

- **P1, open, explicitly handed to Phase 9** — Twilio inbound signature verification is
  completely absent. Recommend `twilio.validateRequest(authToken, signature, url, params)` in
  the webhook route/controller before any processing.
- **P2, not fixed this phase** — two independent retry mechanisms exist for one failed
  `POST /api/sos` (Workbox's real Background Sync API, and `useOfflineSync`'s same-tab `online`
  listener replaying the Dexie queue). Client-side, neither carries an idempotency key, so
  coordination relies entirely on the server-side same-tourist dedup guard (B1's fix, plus the
  original `sos.service.js` guard) rather than the client knowing not to double-send. This is
  covered server-side today, but a client-side idempotency key would be a more direct fix and
  is worth a future pass rather than this phase's scope.
- **P3** — Check-ins have no offline queue at all (confirmed in DISCOVER): `CheckinPage.tsx`
  calls `checkinApi.createCheckin` directly with no Dexie fallback beyond informational "text
  SAFE" copy; a failed check-in while genuinely offline is not retried automatically the way SOS
  is. Lower severity than the SOS gaps (a missed check-in extends the DMS window rather than
  silently losing an emergency), noted for a future pass.
- Per the recurring note in every phase so far: integration coverage for `webhook.service.js`,
  `sos.service.js`, and `dms.service.js` is still manual/scripted (this phase's own
  `supertest`-based verification), not a permanent automated suite — flagged again for Phase 11.

## Evidence

`sos_events` row counts and `trigger_type` values quoted directly from `SELECT` output during
live verification (Tests Executed §4, Live Verification §3) — not inferred from HTTP status
codes alone, matching the standing rule from earlier phases that a 200 response doesn't by
itself prove server-side state did what was expected.

## Conclusion

The Dexie/Workbox app-offline path and the SMS-inbound "no signal at all" path are structurally
sound individually (honest UI, real connectivity probing, graceful malformed-input handling on
the backend), but the SMS path had two real gaps that only surfaced by testing it as its own
mechanism rather than assuming the app-offline testing covered it too — exactly the trap the
master plan's §1.9 warned about. Both are now fixed and reachable by the same dedup/notification
guarantees every other SOS trigger path already has. The two remaining P2/P3 items and the
P1 Twilio-signature gap are documented rather than fixed this phase, kept out of scope
deliberately rather than expanding this pass beyond offline/resilience testing itself.

---

**TESTS EXECUTED:** 8 (see Tests Executed above) — static DISCOVER survey across all three
offline mechanisms, then live REPRODUCE/RETEST of the SMS-inbound dedup and guardian-alert gaps
against the isolated test DB.

**BUGS FOUND:** 5 — B1 (P1, SMS-inbound missing dedup guard), B2 (P1, SMS-inbound missing
guardian alert), B3 (P2, stale connectivity icon), B4 (P2, OfflineBanner Dashboard-only), plus
one P1 security finding (Twilio signature verification absent) explicitly handed to Phase 9
rather than counted as fixed here.

**BUGS FIXED:** B1–B4, all four. Twilio signature verification deliberately left open for
Phase 9.

**REGRESSION RESULTS:** Backend `npx vitest run` 28/28 passing; `node -e "require('./src/app.js')"`
loads cleanly; `frontend/tourist` `npx tsc -b` clean.

**DOCUMENTATION:** This file.

**COMMIT:** See repository log for the commit accompanying this phase.

**REMAINING ISSUES:** Twilio signature verification (P1, → Phase 9). Two independent SOS-POST
retry mechanisms without a shared client-side idempotency key (P2, future pass). No offline
queue for check-ins (P3, future pass). No permanent automated test coverage for
`webhook.service.js`/`sos.service.js`/`dms.service.js` (recurring note, → Phase 11).

**NEXT PHASE:** Phase 9 — Security audit.
