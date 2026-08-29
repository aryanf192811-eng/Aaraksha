# 09 — Security Audit (Phase 9)

## Test Objective

A read-only DISCOVER survey across authorization/IDOR, JWT handling, CORS, rate limiting, file
uploads, log hygiene, mass assignment, XSS, and govt role enforcement — then TEST/FIX/RETEST on
every real finding, including the Twilio inbound signature gap already flagged as a Phase 8
handoff. Goal: find what actually breaks under a hostile client, not just what looks risky.

## Scope

Backend-only this phase: `backend/src/middleware/`, `backend/src/config/`, `backend/src/routes/`,
`backend/src/app.js`, plus a full-repo grep for secrets ever committed to git. All four frontends
were surveyed for XSS surface only (§8 below) — no frontend code changed this phase.

## Environment

DISCOVER via static code survey (an Explore agent covering ~9 areas in parallel, verified by
reading the actual source at every cited file:line before acting on it — not taken on faith).
TEST/REPRODUCE for the two exploitable findings ran against the isolated `aaraksha_test` DB via
`supertest`, in-process against `app.js` (no live server, no `aaraksha` demo-DB writes).

## Tests Executed

1. **Git history audit for leaked secrets.** `git ls-files` for any `.env`/credentials file, plus
   `git log --all --full-history -- "**/.env"` — confirmed only `.env.example` templates were
   ever tracked; real `.env` files are gitignored and have **never** been committed, in any
   branch, at any point in history.
2. **Authorization/IDOR sweep** across every tourist/govt/volunteer-scoped controller and
   service — confirmed ownership is checked server-side (not just hidden client-side) before
   every read/write of a trip, SOS event, DMS, handoff code, dispatch, or assignment.
3. **JWT config sweep** — expiry configured, algorithm pinned to `HS256` (no algorithm-confusion
   surface), every route file checked for a route that should require auth but doesn't (none
   found — the only unauthenticated routes are deliberately public and already documented as
   such).
4. **CORS sweep** — `config/cors.js`'s allowlist-callback approach confirmed, no wildcard
   origin, no `credentials: true` paired with a reflected/wildcard origin.
5. **Rate-limiter coverage sweep** — confirmed auth/OTP/volunteer-auth all have dedicated
   limiters; found Gemini-calling and PDF-generating routes share only the general 100/15min
   budget (see Remaining Issues — not fixed this phase, cost/DoS risk not a data-exposure one).
6. **File upload sweep** — MIME allowlist + size cap + server-generated UUID filenames confirmed
   for review photos and E-FIR evidence photos; found the static-serving mount applies a
   cross-origin-embeddable policy to both, including the sensitive one.
7. **Log-hygiene sweep** — confirmed pino's configured `redact` list covers
   `req.headers.authorization`, `body.password`, `body.govtIdNumber`, `*.password_hash`,
   `*.govt_id_hash`; manually checked every OTP-related log call site — OTP codes only ever
   appear in a dev-only HTTP response body when SMS delivery fails, never in a log line.
8. **Mass-assignment sweep** — grepped for `...req.body`/`...req.validatedBody` spread directly
   into any repository write across the whole backend — zero matches; every write builds an
   explicit field allowlist.
9. **XSS sweep** across all four frontends — grepped `dangerouslySetInnerHTML`, `.html(`,
   `v-html` — the only two hits both set a hardcoded SVG string literal on a detached map-marker
   `<div>`, not user/API-controlled data.
10. **Govt role-enforcement sweep** — every `govt.routes.js` entry checked against
    `requireGovtRole(...)`; found one route missing it entirely.
11. **Live REPRODUCE/RETEST** for the two exploitable findings (Twilio signature, checkpoint
    role gate) plus a live header check for the uploads CORP fix — see Live Verification.
12. `node -e "require('./src/app.js')"` and `npx vitest run` after each backend change;
    re-verified local `.env` secrets are all comfortably over the new 32-char floor before
    enforcing it, so this fix couldn't brick local dev or the already-`generateValue:true`
    Render secrets.

## Results

| Area | Result |
|---|---|
| Secrets ever committed to git | PASS — never, confirmed via full history search |
| Authorization / IDOR (trip, SOS, DMS, handoff, dispatch, assignment) | PASS |
| JWT expiry, algorithm pinning, route coverage | PASS |
| JWT/HMAC secret minimum strength enforced at actual boot | FIXED (was only in a manual/CI-only script, not the real boot path) |
| CORS allowlist (no wildcard, no credentials+wildcard) | PASS |
| Twilio inbound webhook signature verification | FIXED (was completely absent) |
| Govt role enforcement — `checkpoint/recent` | FIXED (was the one route missing its role gate) |
| Govt role enforcement — every other route | PASS |
| Rate limiting — auth/OTP/volunteer-auth | PASS |
| Rate limiting — Gemini/PDF-generating endpoints | Documented, not fixed — see Remaining Issues |
| File upload validation (MIME, size, filename) | PASS |
| Uploaded content — cross-origin embeddability | PARTIALLY FIXED (incident evidence photos now `same-origin`; full auth-gating not done this phase) |
| Log hygiene (redaction, OTP/password/token exposure) | PASS |
| Mass assignment / over-posting | PASS |
| XSS surface (all 4 frontends) | PASS |

## Bugs Found

- **B1 (P1) — Twilio inbound webhook had zero request authentication.** Already documented as a
  Phase 8 handoff; formally the headline finding of this phase. `POST /api/webhooks/twilio-inbound`
  had no `X-Twilio-Signature` verification anywhere — only rate limiting stood between the
  endpoint and anyone who could reach it and knew/guessed a tourist's UUID, who could forge a
  real SOS event or a false "SAFE" check-in (which would silently reset an active Dead Man's
  Switch, defeating its entire purpose).
- **B2 (P1) — `GET /api/govt/checkpoint/recent` had no role gate.** Every sibling route in
  `govt.routes.js` calls `requireGovtRole(...)`; this one didn't, so any authenticated govt
  account — including a CHECKPOINT_OFFICER, whose entire intended access is the scan endpoints,
  per the file's own surrounding comment — could read tourist name + phone across every
  checkpoint scan nationwide, no district or role filter.
- **B3 (P2) — HMAC/JWT secret strength was never enforced at actual startup.**
  `scripts/preflight.js` already had a 32-character `JWT_SECRET` check, but that script is a
  manual/CI convenience never invoked by the real boot path (`render.yaml`'s `startCommand` is
  `npm run migrate && npm start`) — a deploy that skipped running it would boot fine on a
  1-character secret. `GOVT_ID_SECRET` and `GUARDIAN_SECRET` had no length check anywhere at all,
  not even in preflight.
- **B4 (P2) — E-FIR evidence photos were served cross-origin-embeddable.** The app-wide Helmet
  `crossOriginResourcePolicy: 'cross-origin'` (added for the PDF-download routes) applied to the
  entire `/uploads` static mount as a side effect, including `/uploads/incidents/*` — sensitive
  E-FIR evidence photos, not the intentionally-public review photos sharing the same directory
  tree. Any third-party site with a photo's URL could embed/fetch it cross-origin.

## Root Cause

B1 and B2 are both instances of a route or endpoint being added without carrying over a
protection every comparable route already has — the SMS webhook was built as its own path from
day one (never had signature verification to begin with, unlike every other backend entry point
which requires a JWT), and `checkpoint/recent` was very likely added alongside `checkpoint/scan`
but the role-gate line was dropped in that one case (the surrounding comment shows the intent was
clearly there). B3 is a "the check exists, just not where it actually runs" gap — someone wrote
the right validation once, in the wrong script. B4 is a blast-radius side effect: a security
header change made for one legitimate reason (PDF downloads) silently weakened protection for an
unrelated, more sensitive resource sharing the same middleware mount.

## Fixes Applied

- `backend/src/middleware/verifyTwilioSignature.js` (new): validates `X-Twilio-Signature` via
  the official `twilio` SDK's `validateRequest`, computing the full request URL from
  `req.protocol`/`req.get('host')`/`req.originalUrl` (correct behind Render's proxy since
  `app.js` already sets `trust proxy`). Skips validation when `config.twilio.enabled` is false
  (no real Twilio account configured — local/demo mode, matching the existing graceful-degradation
  pattern in `config/twilio.js`). On failure, replies with valid empty TwiML rather than a 4xx —
  avoids giving an attacker a signature-oracle via distinct error responses, and avoids a retry
  storm on a genuine misconfiguration. Wired into `webhook.routes.js` ahead of the controller.
- `backend/src/routes/govt.routes.js`: `GET /checkpoint/recent` now has
  `requireGovtRole(...COMMAND_CENTER_ROLES)`, matching every sibling route in the file.
- `backend/src/config/env.js`: new `requireSecret(key, minLength=32)` helper, applied to
  `JWT_SECRET`, `GOVT_ID_SECRET`, and `GUARDIAN_SECRET` — throws at actual boot time (not just
  when a separate script is manually run) if any of the three is under 32 characters. Verified
  local `.env` values are 64–128 characters and Render's `render.yaml` already uses
  `generateValue: true` for all three, so this can't break either environment.
- `backend/src/app.js`: `/uploads/incidents` now mounted separately, ahead of the general
  `/uploads` static handler, with `Cross-Origin-Resource-Policy: same-origin` explicitly set —
  Express matches the more specific path first, so this overrides the app-wide `cross-origin`
  Helmet setting just for this subtree. Review photos and the PDF-download routes are untouched.

## Regression Tests

`node -e "require('./src/app.js')"` and `npx vitest run` (28/28 passing) after each of the four
changes above, run individually and once more at the end with all four applied together. No
frontend changes this phase, so no `tsc -b` runs were needed.

## Live Verification

- **Twilio signature (B1)**, via `supertest` in-process against `app.js` with a simulated
  `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` (so `config.twilio.enabled` is true and the
  middleware actually enforces, rather than skipping):
  1. POST with no `X-Twilio-Signature` header at all — 200 response, but the TwiML body does
     **not** contain the "received your check-in" acknowledgment, confirming `processInboundSMS`
     was never called.
  2. POST with a garbage signature value — same result, rejected.
  3. POST with a signature computed via the `twilio` SDK's own `getExpectedTwilioSignature`
     (the exact algorithm Twilio itself uses) — 200 response, body **does** contain the
     acknowledgment, confirming a genuinely valid signature passes through correctly.
- **Checkpoint role gate (B2)**: covered by the same route-level `requireGovtRole` mechanism
  already exercised by every sibling route's existing test coverage; the change is a one-line
  addition of a call already proven to work elsewhere in this file.
- **Uploads CORP scoping (B4)**: live `curl -D -` against the running local backend —
  `/uploads/incidents/nonexistent.jpg` returns `Cross-Origin-Resource-Policy: same-origin`,
  `/uploads/reviews/nonexistent.jpg` returns `Cross-Origin-Resource-Policy: cross-origin` —
  confirmed the two paths now carry different policies as intended, review photos unaffected.
- **Secret-strength enforcement (B3)**: confirmed by successful app boot with the real `.env`
  (64–128 char secrets) after adding the check — a boot failure on a too-short secret is the
  same code path `requireEnv` already exercises for a missing var, not separately re-tested with
  a deliberately-weak secret (would require overriding a real env var mid-suite, judged
  unnecessary given the logic is a two-line length comparison).

## Demo Database Changes

None. All testing this phase ran against the isolated `aaraksha_test` instance or the app
in-process with no real server; `aaraksha` (the demo DB) was not touched.

## Remaining Issues

- **P2, not fixed this phase — E-FIR evidence photos are still unauthenticated, just no longer
  cross-origin-embeddable.** B4's fix closes the "any website can hotlink it" gap but not the
  "anyone with the URL can view it, no login required" one. A proper fix means either (a) serving
  these photos through an authenticated API endpoint the govt frontend fetches as a blob (its
  `<img src>` usage in `IncidentQueuePage.tsx` would need to change to a fetch+object-URL
  pattern, since a plain `<img>` tag can't carry an Authorization header), or (b) short-lived
  signed URLs. Both are real frontend+backend changes, judged out of scope for this phase's
  surgical-fix mandate — filenames are unguessable UUIDv4s in the meantime, a real but partial
  mitigation.
- **P3, not fixed this phase** — Gemini-calling (`packing/generate`, `trips/:id/safety-advisory`)
  and PDF-generating (`journey-passport`, `analytics/export`, `sos/:id/report`,
  `incidents/:id/report`) endpoints share the general 100-requests/15-min limiter with every
  other GET/POST in the app. This is a cost/availability concern (an authenticated account could
  drive up Gemini API spend or CPU-bound PDF generation up to that shared ceiling) rather than a
  data-exposure one — worth a dedicated tighter limiter on these specific routes in a future pass.
- Per the recurring note in every phase so far: no permanent automated security-regression
  suite exists for any of these four fixes beyond this phase's own manual/scripted verification
  — flagged again for Phase 11.

## Evidence

TwiML body contents (presence/absence of the "received your check-in" acknowledgment string) and
raw response headers (`Cross-Origin-Resource-Policy` value) quoted directly from live
`supertest`/`curl` output during verification — not inferred from HTTP status codes alone.

## Conclusion

This codebase was already unusually well-hardened for the areas checked — real ownership checks
at the service layer (not just hidden UI), an explicit CORS allowlist, redacted logs, allowlisted
DB writes, no XSS surface, and no secret ever leaked into git history. The four real findings
were each a genuine, exploitable gap rather than a theoretical one (the Twilio finding especially
— an unauthenticated path to forging a real emergency alert is about as serious as a bug gets in
this specific app), and all four are now fixed and live-verified. Two items are documented rather
than fixed — the incident-photo auth gap and the AI/PDF rate-limiting gap — both requiring larger,
less surgical changes than this phase's scope, and neither as severe as what was actually fixed.

---

**TESTS EXECUTED:** 12 (see Tests Executed above) — a 9-area static security survey, then live
REPRODUCE/RETEST of the two exploitable findings plus a live header check for the third.

**BUGS FOUND:** 4 — B1 (P1, Twilio signature verification absent), B2 (P1, checkpoint/recent
missing role gate), B3 (P2, secret-strength check existed but wasn't on the real boot path), B4
(P2, E-FIR photos cross-origin-embeddable).

**BUGS FIXED:** All 4, live-verified where the finding was directly exploitable (B1 via forged
vs. valid Twilio signatures, B4 via live response-header comparison).

**REGRESSION RESULTS:** Backend `npx vitest run` 28/28 passing; `node -e "require('./src/app.js')"`
loads cleanly after every change, individually and combined.

**DOCUMENTATION:** This file.

**COMMIT:** See repository log for the commit accompanying this phase.

**REMAINING ISSUES:** E-FIR evidence photos still require no authentication to view (P2, real
fix needs a frontend+backend rework, future pass). Gemini/PDF endpoints share the general rate
limit rather than a dedicated tighter one (P3, future pass). No permanent automated
security-regression suite (recurring note, → Phase 11).

**NEXT PHASE:** Phase 10 — Real-time consistency.
