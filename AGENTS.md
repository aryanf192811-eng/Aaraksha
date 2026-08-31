# AGENTS.md — Aaraksha

> Cross-tool entry point. Any coding agent working in this repo — Claude Code,
> Antigravity, Cursor, Codex, or otherwise — should read this file first. It
> points to the project's own rule docs and captures hard-won operational
> knowledge that isn't written down anywhere else yet.

---

## Read these, in order, before doing anything non-trivial

1. [`CLAUDE.md`](./CLAUDE.md) — product context, architecture, session tracker, definition of done, git rules
2. [`Architecture.md`](./Architecture.md) — stack, directory structure, naming, locked dependencies
3. [`DB_GUIDE.md`](./DB_GUIDE.md) — schema, query rules (parameterized SQL, no `SELECT *`)
4. [`API_GUIDE.md`](./API_GUIDE.md) — HTTP verbs, response shape, error codes
5. [`UI_GUIDE.md`](./UI_GUIDE.md) — design tokens, per-portal theme, component conventions

Those five files are the actual rulebook. Everything below is what's *missing*
from them — real bugs and conventions discovered by actually running this
app, not just reading the code.

---

## The one habit that matters most: verify live, not just green checkmarks

`tsc -b` passing and tests passing are necessary, not sufficient. Several
real bugs in this codebase were invisible to both and only surfaced by
actually running the app end to end:

- **Auth redirect loop** (tourist/govt/volunteer login) — typechecked fine,
  tests passed fine, only visible by logging in with a stale token in an
  actual browser and watching it bounce between pages.
- **`tourist.repository.js`'s `SAFE_COLS` allowlist** (see below) — the API
  returned `200 OK` with a subtly wrong body. No error anywhere, no failing
  test, nothing a type-checker could catch.
- **A Postgres NUMERIC-as-string arithmetic bug** in cluster detection —
  `"26.1442" + 0.02` silently string-concatenated into garbage that Postgres
  then rejected. Only visible by actually triggering the code path and
  reading the resulting DB error.

None of these would have been caught by code review alone. Before calling a
feature done: run the actual servers, drive the actual UI (Playwright or by
hand), and query the actual database to confirm state changed the way you
think it did — not just that a request returned 200.

---

## Known gotchas, paid for the hard way

**`backend/src/repositories/tourist.repository.js`'s `SAFE_COLS`** is an
explicit column allowlist (deliberately excludes `password_hash`/
`govt_id_hash`). Every time a migration adds a column to `tourists`, it must
also be added to `SAFE_COLS`, or `findById`/`findByPhone`/
`findByGuardianToken` silently return `undefined` for it everywhere, with no
error. This has already bitten one feature (trust score) — check this file
whenever a `tourists` migration lands.

**Postgres returns `NUMERIC`/`DECIMAL` columns as strings**, not numbers. `-`
and `*` on a numeric string coerce fine in JS; `+` silently
string-concatenates instead of adding. Always `Number(...)` explicitly
before doing arithmetic on a value straight off a DB row (`latitude`,
`longitude`, any `decimal`/`numeric` column — `smallint` columns like
`trust_score` come back as real numbers already and don't need this).

**Each of the four frontend apps (`tourist`/`govt`/`guardian`/`volunteer`)
duplicates its own copy of small "platform" files** — `lib/osrm.ts`,
`api/client.ts`, etc. — rather than sharing a package. This is deliberate,
not an oversight. Don't consolidate them. A fix to one portal's copy (e.g.
the OSRM route-fetch throttle) has to be applied to every portal's copy
independently.

**Two separate Postgres databases exist locally**: `aaraksha` (dev, has seed
data, safe to poke at directly for live-testing) and `aaraksha_test`
(isolated, used only by `npm test`, no seed data). A new migration must be
run against **both**:
```bash
npm run migrate                                                              # dev DB (aaraksha)
DATABASE_URL="$DATABASE_TEST_URL" npx node-pg-migrate -m src/migrations up   # test DB
```
Forgetting the second makes `npm test` fail with `column "..." does not
exist` even though the dev DB and the feature itself are fine.

**Never run manual/live tests against the deployed demo database.** Local
`aaraksha` (dev) is fine to manipulate directly via a throwaway script when
live-verifying a feature — just clean up any test rows/accounts afterward so
the seeded demo data stays presentable for a real demo.

---

## Deploy behavior (Render + Vercel)

- **Backend (Render)**: `render.yaml`'s start command is `npm run migrate &&
  npm start` — every deploy auto-runs pending migrations against the **live**
  demo database, with no manual step. A schema-changing push is a real
  production action the moment it lands on `main` and Render redeploys, not
  just a code change.
- **Frontends (Vercel)**: each of the 4 portals has its own `vercel.json` and
  its own Vercel project, connected via GitHub integration — pushing to
  `main` triggers all four independently.
- **Always confirm the actual deployed URL from the platform dashboard
  before live-debugging a "production" issue.** A wrong assumed URL (a
  stale/guessed hostname) has already caused one long, wasted debugging
  session. Don't guess — check.

---

## Git discipline

See `CLAUDE.md`'s Git Rules section for the base rules (conventional
commits, never touch git identity, don't commit unless asked). One addition
not yet written there:

- **Never add a `Co-Authored-By` trailer for any AI/agent.** Every commit
  goes under the user's own git identity only.
- When a working tree has accumulated a lot of unrelated changes across many
  shared files, prefer several coherent commits over one giant one — but
  never hand-split a single file's diff across commits in a way that leaves
  an intermediate commit non-functional. A "hub" file touched by several
  unrelated changes should land whole, in whichever commit best represents
  its overall purpose.

---

## Design ethos (applies to any new feature, not just UI polish)

- **Reuse existing patterns exhaustively before inventing new ones.** This
  codebase already has an explainable-scoring precedent
  (`backend/src/utils/rescueScoring.js`), an audited-anomaly-detection
  precedent (`backend/src/services/anomaly.service.js` +
  `safety_anomalies` table), and a govt-review-queue UI precedent
  (`frontend/govt/src/pages/VolunteersPage.tsx`). A new score, a new
  detect-and-flag system, or a new govt approval queue should extend these,
  not reinvent them.
- **Never let an anti-abuse mechanism block the actual safety-critical
  path.** The tourist trust-score system is built around one hard rule: a
  restricted account can *always* still trigger a real SOS. Anti-fraud logic
  gates convenience and adds scrutiny, never the emergency path itself. Any
  future anti-abuse feature should hold the same line.
- **No flat empty states.** Empty/loading states use a colored icon badge in
  a boxed container, never a bare icon floating on blank white.
- **The rescuer (volunteer) app is modeled on delivery-partner apps**
  (Zomato/Swiggy/Rapido) — map-first, persistent contact actions, a real
  "start" moment for navigation, not a generic dashboard.
- Match responsive strategy per portal: tourist/volunteer are mobile-first,
  govt is desktop-first, guardian is public with no login.

---

## Keeping this file alive

If a pattern keeps needing to be re-explained across sessions or tools, it
belongs here (or in `CLAUDE.md`), not just in one tool's private memory.
Update this file when a real gotcha gets discovered the hard way — that's
the whole point of it existing.
