# Aaraksha Travel Assistant — dataset curation & benchmark tracker

> This is **not** a model-training log. Nothing in this project fine-tunes or
> trains a model — that was deliberately rejected (see `README.md`'s "Build
> My Journey" section and the planning history for why: an LLM here only
> ever narrates numbers a deterministic scorer already computed, it never
> invents a cost, distance, or safety score). What *does* benefit from
> multiple sessions/models working on it over time is the **structured
> dataset** this feature reasons over — that's what this file tracks.

If you're an Antigravity model (or any other agent) picking this up: read
this whole file before touching data. It tells you what's already covered,
what's thin, what sources are allowed, how to actually write a change, and
how to check whether your changes helped. This file is the **only**
communication channel between curation sessions — a human (or Claude Code,
acting as supervisor) reads what you wrote in the session log below and
plans the next unit of work around it. If you don't update it, the next
agent has no idea what you did.

---

## How this works (the supervisor model)

There is no live orchestration between agents — no shared queue, no API.
Coordination happens entirely through this file being read and rewritten
over successive sessions, the same way a team leaves notes for the next
shift. Concretely:

1. **Read this whole file first.** Especially the coverage checklist and
   the most recent session log entries.
2. **Pick ONE gap** from the coverage checklist — the highest-priority one
   you can actually source data for. Don't try to fill everything in one
   session; a focused, well-sourced contribution beats a broad, thin one.
3. **Research it** using only the allowed sources below.
4. **Write it** to the **local dev database only**, using the exact
   pattern in "How to add data" below.
5. **Update this file**: tick the coverage checklist, add a session log
   entry describing exactly what you added and where it came from, and
   leave the worklist accurate for whoever reads this next.
6. **Never touch application code or migrations.** If you find you need a
   new column or table that doesn't exist, don't add it yourself — write
   what you needed in the session log under "Schema requests" and stop.
   Schema changes go through Claude Code (or a human), reviewed like any
   other migration in this repo.

A single agent session can do all of steps 3-4 itself (research →
validate → write), or if you're running multiple Antigravity sessions in
parallel, split them by role instead of by region:

| Role | Does | Never does |
|---|---|---|
| **Researcher** | Finds candidate facts from allowed sources, with citations | Writes to the database |
| **Validator** | Checks a Researcher's citations are real, current, and actually say what's claimed | Invents a citation to fill a gap |
| **Writer** | Takes validated facts and inserts them via the exact SQL pattern below | Adds anything without a citation already validated by a Validator pass |

If you're one agent doing all three, do them as three explicit passes in
order, not blended — it's much easier to catch your own mistake in
"did I actually validate this, or did I just decide it sounded right"
when it's a distinct step.

---

## Read these first

- [`AGENTS.md`](./AGENTS.md) — general project conventions (git, migrations, deploy, dual-DB discipline).
- [`CLAUDE.md`](./CLAUDE.md) — product context and architecture.
- `backend/src/services/travelScoring.service.js` — the deterministic scorer. Read its header comment before changing anything data-related; the whole feature's integrity depends on this module being the only thing that computes facts.
- `backend/src/services/travelPlanner.service.js` — orchestration (retrieval → score → Gemini narrates).

---

## What lives where

| Data | Table | Curated by |
|---|---|---|
| Destination attributes (connectivity, difficulty, altitude, zone_type, ILP, hospital distance, popularity, description, best_months) | `destinations` | Hand-curated / this tracker |
| Real traveller cost/experience data (rating, actual cost, crowd level, felt_safe, tips) | `destination_reviews` | Real Aaraksha users, not scraped — never write to this table yourself |
| Transport legs between destinations (mode, duration, cost range) | `typical_routes` | Hand-curated / this tracker |
| Long-haul gateway legs (e.g. Delhi → Guwahati) | `backend/src/services/travelPlanner.service.js#EXTERNAL_GATEWAY_LEGS` | A small stable constant, not a DB table — these facts don't change week to week. Code change, not a data-curation task; flag it in the session log instead of editing it yourself. |

Both `destinations` and `typical_routes` have a `source` text column
(migration `026_travel_data_provenance`). On `typical_routes` it's
**required** — the database itself rejects a row with no source. Use it.

---

## Source policy — read before adding anything

**Tier A (preferred)** — official and structurally reliable:
- Ministry of Tourism open data / the OGD (Open Government Data) platform
- State tourism department publications
- OpenStreetMap (cite the node/way id or a stable OSM URL)

**Tier B (acceptable, cite specifically)** — other open datasets or APIs
with a clear, checkable origin (not "I recall that..." — an actual
document, dataset, or page you can name).

**Tier C** — Aaraksha's own `destination_reviews` (real user-submitted
data, already a first-class feature). Use it to inform `typical_routes`
cost estimates, but never write to `destination_reviews` yourself — those
rows represent a real person's experience.

**Not allowed, ever**: scraping TripAdvisor, Google Reviews, Reddit, or
any other proprietary platform's content. Deliberate, not an oversight —
ToS risk, and `destination_reviews` already covers "real traveller
experience" honestly.

**The hard rule**: never fabricate a specific number to fill a gap. Every
`typical_routes` row's `source` column should let a skeptical reader find
what you found. An honest "no data yet" (leave the pair absent — the
scorer already handles this via the haversine-estimate fallback and the
`estimated: true` flag it returns) beats a plausible-looking invented
figure with a vague or copied-default source string. If you can't cite a
real source, don't write the row.

---

## How to add data

**`typical_routes`** (transport legs) — write directly to the local dev
DB with a real source citation, following this exact shape:

```js
// Run with: node -e "<script>" from backend/, same pattern this project's
// own live-verification scripts use — reads DATABASE_URL from .env.
const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
;(async () => {
  const { rows } = await pool.query(
    "SELECT id, name FROM destinations WHERE name IN ('X', 'Y')"
  )
  const byName = Object.fromEntries(rows.map(r => [r.name, r.id]))
  await pool.query(
    `INSERT INTO typical_routes
       (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
     VALUES ($1,$2,'SHARED_TAXI',<minutes>,<min_inr>,<max_inr>,'<human note>','<real citation>')`,
    [byName['X'], byName['Y']]
  )
  await pool.end()
})()
```

Add the reverse leg too if the return trip has different characteristics
worth noting (usually it doesn't — same mode/cost/duration is fine).

**`destinations`** (new destination or enriched attributes) — same
pattern, `INSERT`/`UPDATE` against `destinations`, always set `source`.

**Never**:
- Write to the deployed/demo database — local dev DB only (see `AGENTS.md`'s dual-DB discipline).
- Run a destructive command (`DELETE`/`DROP`/`TRUNCATE`) without it being explicitly what this session's task is.
- Modify `pgmigrations`, run `node-pg-migrate`, or touch anything under `backend/src/migrations/` — that's Claude Code's / a human's job.

---

## Dataset coverage checklist

Update this table as destinations/routes/reviews get added. A `-` means
genuinely not yet covered — that's the actual worklist.

| State | Destinations w/ full attributes | `typical_routes` legs | `destination_reviews` rows |
|---|---|---|---|
| Meghalaya | Shillong, Cherrapunji (Sohra) | Shillong ↔ Cherrapunji (⚠ unsourced estimate — see below) | Shillong (1), Cherrapunji (1) |
| Assam | Kaziranga, Majuli Island | - | Kaziranga (2), Majuli Island (1) |
| Arunachal Pradesh | Tawang, Ziro Valley | - | - |
| Nagaland | Dzukou Valley, Longwa Village | - | - |
| Manipur | Loktak Lake | - | - |
| Sikkim | Pelling | - | - |
| Mizoram | - | - | - |
| Tripura | - | - | - |

**Worklist, roughly in priority order**:
1. **Replace the two unsourced `typical_routes` rows** (Shillong ↔
   Cherrapunji) — they were typed in during development as an illustrative
   example, not researched, and are now explicitly marked as such in their
   `source` column. Find a real citable figure and update them.
2. At least one sourced `typical_routes` leg for every state that has 2+
   destinations, so a journey within that state doesn't fall back to the
   haversine estimate for every leg.
3. More `destination_reviews`-informed cost data — most destinations have
   0-2 reviews right now, which is thin (the `avgCostInr` the scorer
   reports is one or two people's experience, not a real average). This
   one you can't curate directly (see the table above), but it's worth
   noting where it's thinnest.
4. Mizoram and Tripura have zero `destinations` rows at all — `buildJourney`
   will 422 for those regions until at least one exists, sourced properly.

---

## Benchmark query set

Fixed, representative "Build My Journey" requests. Re-run these against
`POST /api/travel-planner/build-journey` after any dataset change and
check the criteria — this is what "improving accuracy" concretely means
here: more of these passing, not a vibe.

| # | Request | Pass criteria |
|---|---|---|
| 1 | Delhi → Meghalaya, 5 days, ₹20,000, NATURE+ADVENTURE | `scores.budget` ≥ 80; no stop has `zone_type: RESTRICTED` without a surfaced ILP/advisory note |
| 2 | Mumbai → Meghalaya, 3 days, ₹10,000, RELAXATION | `scores.duration` ≥ 70 (3 days is tight — a good result should say so via a lower duration score, not silently overcommit) |
| 3 | Kolkata → Assam, 4 days, ₹15,000, WILDLIFE | Kaziranga (a real national park) should be in `orderedStops` when WILDLIFE is requested and the region has it — **confirmed passing 2026-09-01, live-verified in browser** |
| 4 | Delhi → Nagaland, 6 days, ₹25,000, ADVENTURE | Dzukou Valley (`difficulty: EXTREME`, `zone_type: HIGH_RISK`) should surface a low `scores.safety` and a corresponding `worstStop` warning, not be hidden |
| 5 | Delhi → Arunachal Pradesh, 5 days, ₹18,000, NATURE | Both stops are `ILP_REQUIRED` — the response should make that visible (frontend renders it from `orderedStops`/`destinations.ilp_required`, verify it's not silently dropped) |
| 6 | (no region seeded, e.g. "Mizoram") | Returns a clean 422 with a message pointing at this file, not a crash or an empty-but-200 response |

A `tests/eval/travelPlanner.benchmark.js` script running these
programmatically is real future work — until it exists, run them by hand
via curl (same pattern as this feature's own live verification) and
update the table above with the result and the date.

**Quality signals to eventually track per benchmark run** (not built yet,
worth having in mind while curating): budget adherence, route validity,
duration adherence, backtracking reduction vs. a naive sequential order,
safety-constraint adherence, and — specific to this dataset — the
fraction of legs in a result that are `estimated: false` (i.e. backed by
a real curated `typical_routes` row rather than the haversine fallback).
More sourced data directly moves that last number, which is the honest
version of "the dataset got bigger."

---

## Session log

Format: date, who/which model, what changed, what's next. Newest first.

```
2026-09-01 — Claude Code (Sonnet 5)
  Added the `source` column (migration 026_travel_data_provenance) to
  destinations and typical_routes -- required on typical_routes, so a
  curation agent cannot insert a row with no traceable origin. Retagged
  the two existing hand-typed Shillong<->Cherrapunji rows as explicitly
  unsourced/illustrative rather than leaving them looking legitimate.
  Rewrote this file as the supervisor communication line: source-tier
  policy, agent role split (Researcher/Validator/Writer), and the exact
  SQL pattern for writing data safely to the local dev DB only.
  NEXT: hand this file to Antigravity agents. First real task for them:
  worklist item #1 (source a real Shillong<->Cherrapunji figure) and #2
  (at least one sourced route pair for Assam, Arunachal Pradesh, or
  Nagaland, which all currently have zero typical_routes coverage).

2026-09-01 — Claude Code (Sonnet 5)
  Built: typical_routes migration, travelScoring.service.js (deterministic,
  12 passing unit tests), travelPlanner.repository.js/service.js, Gemini
  narration + intent-extraction functions, /api/travel-planner routes,
  seeded one Shillong<->Cherrapunji route leg (later flagged as
  unsourced, see above). Live-verified the full build-journey -> ask ->
  commit pipeline end-to-end against the dev DB, including a second fresh
  pass with a different region (Assam/Wildlife -> correctly surfaced
  Kaziranga, benchmark query #3 above).
  NEXT: TravelAssistantFAB.tsx (done, shipped same session) -- see above.
```
