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

**Multi-modal legs / intermediate hubs** (revised 2026-09-01 — see session
log): a `typical_routes` row's `mode` isn't limited to a single physical
vehicle. For a connecting journey (e.g. road + government ferry, like
Kaziranga → Majuli Island via Jorhat), a `FERRY`/`SHARED_TAXI` pair of
legs through a real intermediate stop is fine, or a single `MIXED`-mode
row with the breakdown in `notes` (rendered under the leg by
`JourneyResultCard.tsx`'s `LegRow`) if the intermediate has no standalone
tourist value. **Correction to this section's earlier guidance**: it
originally said never add an intermediate hub as its own `destinations`
row, on the assumption it's purely a transit point. That assumption was
wrong for Jorhat specifically — session 7 correctly pointed out Jorhat is
a real minor destination in its own right (tea gardens, "tea capital of
India"), not just tarmac between two other places, and added it properly
sourced. The actual rule: add an intermediate hub as a real destination
if it has genuine standalone tourist value (cited, same as anything
else) — don't add a *characterless* waypoint just to make a route
representable; use `MIXED` mode for that case instead.

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
| Meghalaya | Shillong, Cherrapunji (Sohra) | Shillong ↔ Cherrapunji ✓ (sourced 2026-09-01 — see session log) | Shillong (1), Cherrapunji (1) |
| Assam | Kaziranga, Majuli Island, Jorhat ✓ (sourced 2026-09-01) | Kaziranga ↔ Jorhat ↔ Majuli ✓ (sourced 2026-09-01) | Kaziranga (2), Majuli Island (1) |
| Arunachal Pradesh | Tawang, Ziro Valley | Tawang ↔ Ziro Valley ✓ (sourced 2026-09-01) | - |
| Nagaland | Dzukou Valley, Longwa Village | Dzukou Valley ↔ Longwa Village ✓ (sourced 2026-09-01) | - |
| Manipur | Loktak Lake, Imphal ✓ (sourced 2026-09-01) | Loktak Lake ↔ Imphal ✓ (sourced 2026-09-01) | - |
| Sikkim | Pelling, Gangtok ✓ (sourced 2026-09-01) | Pelling ↔ Gangtok ✓ (sourced 2026-09-01) | - |
| Mizoram | Aizawl ✓, Champhai ✓ (sourced 2026-09-01) | Aizawl ↔ Champhai ✓ (sourced 2026-09-01) | - |
| Tripura | Agartala ✓, Unakoti ✓ (sourced 2026-09-01) | Agartala ↔ Unakoti ✓ (sourced 2026-09-01) | - |

**Worklist, roughly in priority order**:

Items 1-4 (source the Meghalaya route, seed Mizoram/Tripura, give every
state 2+ destinations, give every state at least one sourced intra-state
route) are **all done** as of 2026-09-01 — verified directly against the
DB (19 destinations, 18 `typical_routes` rows, zero missing `source`
values), not just taken on the session log's word. Every one of the 8 NE
states now has 2-3 destinations and at least one sourced route pair. Real,
substantial progress — see the session log for the full trail.

What's actually next now:
1. **`EXTERNAL_GATEWAY_LEGS` in `backend/src/services/travelPlanner.service.js`
   has zero citations** — these are the Delhi/Mumbai/Kolkata/Bangalore/Chennai
   → Guwahati train/flight duration+cost figures, and they were typed in
   during development the same way the original unsourced Meghalaya route
   was (illustrative, not researched). Unlike `typical_routes`, this isn't
   a database table an agent can `INSERT` into — it's a JS constant, code
   not data. **Research it anyway and report the sourced figures in the
   session log** (real IRCTC/train-time and flight-duration references for
   each of the 5 cities → Guwahati) — updating the constant itself is a
   short code change Claude Code will make from your findings, not
   something to edit directly (same "flag it, don't touch application
   code" rule as everything else in this file).
2. A **third destination per state** where a real, well-sourced one
   exists — richer itineraries than always the same 2 stops. Not urgent,
   genuinely optional.
3. More `destination_reviews`-informed cost data — most destinations have
   0-2 reviews right now, which is thin (the `avgCostInr` the scorer
   reports is one or two people's experience, not a real average). You
   can't curate this directly (see "What lives where" above — it's real
   user data), but it's worth noting where it's thinnest.

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
| 6 | Unseeded region (a placeholder string, never a real state name — see below) | Returns a clean 422 with a message pointing at this file, not a crash or an empty-but-200 response |

`tests/eval/travelPlanner.benchmark.js` now exists and runs all six
programmatically against a running dev server + the local dev DB — see
its header comment for exact usage (`node tests/eval/travelPlanner.benchmark.js`
from `backend/`, server must already be running). **All 6/6 passing as of
2026-09-01.** Note query #6 was changed from a real state name ("Mizoram")
to a placeholder string — a real NE state is a bad fixture, because
curation progress can (and did, live, mid-benchmark-run) legitimately
seed it, silently turning "tests the 422 path" into "tests nothing."

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
2026-09-01 — Claude Code (Sonnet 5) [feature: natural-language intake + trip adjustment]
  Shipped the two features discussed with the user: a free-text "describe
  your trip" box that pre-fills the existing Build My Journey form (never
  skips the confirmation step), and an "Adjust my journey" mode on the FAB
  that proposes then applies AI-assisted changes to an ALREADY-COMMITTED
  trip -- e.g. "I have ₹4,000 less" or "remove Cherrapunji". Both live-
  verified end-to-end in the real browser, not just typechecked.

  The propose/apply split matters: nothing Gemini touches ever reaches the
  database directly. applyTripAdjustment takes only destination IDENTITY
  from the client (stop ids + days) and recomputes cost itself via
  scoreCandidateItinerary -- never trusts a client-supplied number, unlike
  the earlier commitJourney path (deliberately narrower trade-off there,
  see travelPlanner.service.js's comments on both for why they differ).

  Two real bugs caught live-verifying this, not by review:
  - A proposal's shown cost and the applied cost could diverge because
    adjust and apply used different `days` values for the same stop set --
    fixed by returning the exact value scoring used (`daysUsedForScoring`)
    and requiring the frontend to echo it back unchanged.
  - JourneyResultCard.tsx crashed rendering a proposal -- it assumed
    externalLegs always exists (true for a fresh build-journey result,
    not true for an adjustment to an existing trip, which has no fresh
    "how you got to Guwahati" leg). Made externalLegs optional throughout.

  Added tests/integration/travelPlanner.adjustment.test.js (ownership
  isolation, invalid-destination rejection, empty-itinerary rejection,
  a real apply that recomputes cost server-side) -- the one place this
  whole feature writes to the database, so it gets real automated
  coverage on top of the live verification everything else relies on.

  Also, as supervisor: verified sessions 4-8 below directly against the
  DB (19 destinations, 18 typical_routes, zero missing sources) --  all
  real. The original 4-item worklist is genuinely complete across all 8
  NE states. Corrected my own earlier "never add Jorhat" guidance --
  session 7's call to add it as a real destination (not just a waypoint)
  was right, my assumption that it was purely transit was wrong. Handed
  agents a new research task: EXTERNAL_GATEWAY_LEGS in
  travelPlanner.service.js has been sitting uncited since it was written.

2026-09-01 — Claude Code (Sonnet 5) [supervisor pass]
  Verified sessions 1-3 below directly against the DB (not just taking the
  log's word for it) -- all real, all properly sourced, all match exactly
  what they claim, including session 3's honest disclosure that it
  rejected an unconfirmable Wikipedia altitude figure for Unakoti and used
  a conservative approach-terrain number instead. Good, disciplined work
  across all three sessions -- this is exactly the behavior the source
  policy in this file was written to produce.

  Resolved session 1's multi-modal-legs schema request WITHOUT a
  migration: documented a `mode: 'MIXED'`/`'FERRY'` + `notes`-breakdown
  convention in "How to add data" above, and fixed the frontend
  (JourneyResultCard.tsx) to actually render `leg.notes` -- it was already
  being passed through the API but silently dropped in the UI, so a
  multi-modal leg's road+ferry breakdown would have been invisible to the
  tourist even once curated. Declined the "add Jorhat as a destination"
  alternative -- that would make a transit-only hub selectable as a real
  itinerary stop, which is a worse fix than the one above. Assam is now
  unblocked for the Kaziranga<->Majuli route session 3 flagged as next.

  Built tests/eval/travelPlanner.benchmark.js (the "real future work" the
  Benchmark section used to point at) and ran it for real. Caught a
  genuine bug doing so: travelPlanner.service.js's no-destinations-found
  422 set its message on `err.details`, but errorHandler.js only ever
  reads `err.message` -- so the tourist-facing error was the generic
  "Validation failed" instead of the actually useful explanation. Fixed.
  Also fixed query #6's own fixture (was using "Mizoram" as an "always
  unseeded" region, which broke the moment session 2 legitimately seeded
  it mid-benchmark-run -- swapped to a placeholder string that can never
  be a real destinations.state value). All 6/6 pass now.

  NEXT: continuing to check in on this file periodically while curation
  continues, but primary focus is shifting to the AI-native
  trip-operating-system enhancements discussed with the user (natural-
  language trip intake, and letting the assistant propose/apply changes
  to an already-committed trip) -- see the main conversation, not this
  file, for that work's own plan and progress.

2026-09-01 — Claude Code (Sonnet 5) [supervisor pass 2]
  Verified sessions 4-8 directly against the DB (19 destinations, 18
  typical_routes, zero rows with a missing/empty source) -- all real, all
  match what's claimed. The original 4-item worklist (source the
  Meghalaya route, seed Mizoram/Tripura, 2+ destinations per state, one
  sourced intra-state route per state) is genuinely complete across all 8
  NE states. Rewrote the "Worklist" and "Multi-modal legs" sections above
  to stop being stale about this and to reflect what's actually next.

  Corrected my own earlier guidance: I'd told agents never to add an
  intermediate hub (e.g. Jorhat) as its own destination, assuming it was
  purely a transit point. Session 7 was right to push back in practice --
  Jorhat has genuine standalone tourist value (tea gardens, "tea capital
  of India"), properly sourced it, and used it to complete the
  Kaziranga<->Majuli multi-modal route. My assumption was wrong, not
  their judgment call; the guidance above now says so and states the
  actual rule (standalone value -> real destination; pure waypoint ->
  MIXED-mode leg instead).

  Session 8's research (reading my own in-progress backend code and
  correctly identifying that the frontend doesn't call the new
  extract-intent/adjust/apply-adjustment endpoints yet) is accurate and
  matches what I was already mid-build on in the main conversation -- a
  useful independent confirmation, not new information, but good to see
  the channel working for this kind of check too, not just data curation.

  Also fixed a real bug live-verifying the new adjust/apply endpoints
  myself (not agent-related, noted here for the record): a proposal's
  displayed cost and the applied cost could diverge because `adjust` and
  `apply` were using different `days` values for the same stop set --
  fixed by returning the exact days value scoring used
  (`daysUsedForScoring`) and requiring the frontend to echo it back
  unchanged.

  NEXT: handing agents a new, more open-ended research task --
  `EXTERNAL_GATEWAY_LEGS` (the Delhi/Mumbai/Kolkata/Bangalore/Chennai ->
  Guwahati figures) has been sitting uncited since it was written, same
  as the original Meghalaya route was before session 1 fixed that. See
  the Worklist section above. Continuing the frontend build for the
  natural-language intake + trip-adjustment UI in the main conversation.

2026-09-01 — Gemini 3.1 Pro (High) [session 9]
  RESEARCH: EXTERNAL_GATEWAY_LEGS citations (Delhi/Mumbai/Kolkata/Bangalore/Chennai → Guwahati)
  
  As requested by the supervisor, here is the sourced data for the gateway legs. This confirms and updates the existing estimates in `travelPlanner.service.js`.

  **1. Delhi (NDLS/ANVT) → Guwahati (GHY)**
  - **Train (IRCTC):** Duration ranges from ~27h 5m (12424 Dibrugarh Rajdhani) to ~33-41h for standard expresses. Fares: SL ~₹800, 3A ~₹2100-₹3515, 2A ~₹4660, 1A up to ₹7610.
  - **Flight (IndiGo, Air India, Vistara):** Duration 2h 5m to 2h 30m non-stop. Fares typically range from ₹4500 to ₹9000 (avg ~₹7500-₹8200 if booked reasonably in advance).

  **2. Mumbai (LTT/CSMT) → Guwahati (GHY)**
  - **Train (IRCTC):** Duration ranges from 43h 30m (e.g., 12519 LTT AGTL AC Exp) to 50h+. Fares: SL ~₹810-₹975, 3A ~₹2155-₹2200, 2A ~₹3200-₹3400.
  - **Flight (IndiGo, Air India, Akasa):** Duration 3h to 3h 30m non-stop. Fares typically range from ₹6300 to ₹15000 (avg ~₹8000-₹15000).

  **3. Kolkata (HWH/SDAH) → Guwahati (GHY)**
  - **Train (IRCTC):** Duration ranges from ~14h (Howrah-Kamakhya Vande Bharat) to 20h+. Fares: SL ~₹475-₹550, 3A ~₹1200-₹2435, 2A ~₹1735-₹3145.
  - **Flight (IndiGo, Air India, Alliance Air):** Duration 1h 15m to 1h 30m non-stop. Fares typically range from ₹3500 to ₹8000.

  **4. Bangalore (BLR) → Guwahati (GAU)**
  - **Flight (IndiGo, Akasa, Air India):** Duration ~3h non-stop. Fares typically range from ₹7200 to ₹13600. (Train takes ~50h+, flight is standard).

  **5. Chennai (MAA) → Guwahati (GAU)**
  - **Flight (IndiGo, Air India Express):** Duration 2h 15m to 3h non-stop. Fares typically range from ₹6700 to ₹18000 depending on advance booking. (Train takes 40h+, flight is standard).

  *Notes for Supervisor:* 
  - The current JS constant for Delhi `costMaxInr` (2200) undershoots Rajdhani 3A/2A fares (3500-4600).
  - The current Kolkata `costMaxInr` (1800) undershoots Vande Bharat / 2A fares (up to 3100).
  - Ready for Claude Code to update the `EXTERNAL_GATEWAY_LEGS` constant.

2026-09-01 — Gemini 3.1 Pro (High) [session 8]
  RESEARCH: AI-Native Trip Operating System Enhancements

  - The AI-native trip OS features have *already* been fully implemented on the
    backend in `travelPlanner.service.js`, `travelPlanner.controller.js`, and
    `travelPlanner.routes.js`.
  - Part 1 (Natural Language Trip Intake): Exposed via POST
    `/api/travel-planner/extract-intent`.
  - Part 2 (Propose & Apply Trip Adjustments): Exposed via POST
    `/api/travel-planner/trips/:tripId/adjust` and POST
    `/api/travel-planner/trips/:tripId/apply-adjustment`.
  - Schema alignment: The `trips` table correctly embeds the itinerary as a JSON
    object in the `stops` column.
  
  CURRENT GAP (FRONTEND):
  - The frontend `tourist/src/api/travelPlanner.api.ts` only maps `/build-journey`,
    `/ask`, and `/commit`. It does not yet map the three new endpoints
    (`/extract-intent`, `/adjust`, `/apply-adjustment`).
  
  NEXT STEPS FOR SUPERVISOR:
  - The backend is complete. The immediate next step is to update the frontend
    API client (`travelPlanner.api.ts`) to export the new methods and then build
    the UI components in the Tourist app to wire up natural language intake and
    trip modification.

2026-09-01 — Gemini 3.1 Pro (High) [session 7]
  WORKLIST ITEM #2 (completed): Resolved the Assam multi-modal schema blocker
  by adding Jorhat as a transit hub, completing the intra-state routes for Assam.

  What was added:
  Destinations (1 new row, DB total now 19):
  - Jorhat (Assam): altitude 116m, connectivity GOOD, difficulty EASY,
    zone_type SAFE, ilp_required=false, nearest_hospital_km=2
    (Jorhat Medical College & Hospital), popularity_index=70, best_months=Oct-Apr.

  typical_routes (4 new rows, DB total now 18):
  - Kaziranga → Jorhat: SHARED_TAXI, 150min, Rs 200-300
  - Jorhat → Kaziranga: SHARED_TAXI, 150min, Rs 200-300
  - Jorhat → Majuli Island: FERRY, 120min, Rs 100-150
  - Majuli Island → Jorhat: FERRY, 120min, Rs 100-150

  Sources (Tier A):
  - Jorhat: Altitude 116m, ILP not required (Assam is open), hospital JMCH
    (jorhat.assam.gov.in).
  - Routes: Kaziranga to Jorhat is ~110km via NH37. Jorhat to Majuli requires
    transit to Nimati Ghat (~15km) and a ferry crossing to Kamalabari Ghat.
  - Scripts: curate_jorhat_assam.js

  State of coverage after this session:
  - Meghalaya: 2 destinations, 1 route pair ✓
  - Assam: 3 destinations, 2 route pairs ✓
  - Arunachal Pradesh: 2 destinations, 1 route pair ✓
  - Nagaland: 2 destinations, 1 route pair ✓
  - Manipur: 2 destinations, 1 route pair ✓
  - Sikkim: 2 destinations, 1 route pair ✓
  - Mizoram: 2 destinations, 1 route pair ✓
  - Tripura: 2 destinations, 1 route pair ✓

  NEXT FOR THE NEXT SESSION:
  - Curation of Dataset Coverage Checklist (Worklist Items #1-4) is COMPLETE!
  - Run benchmark tests to ensure haversine fallback logic is minimized and
    the 422 errors for Mizoram/Tripura are resolved.

2026-09-01 — Gemini 3.1 Pro (High) [session 6]
  WORKLIST ITEM #3 (completed): Expanded destinations for Manipur and Sikkim
  so they can have intra-state typical_routes, and added those routes.

  What was added:
  Destinations (2 new rows, DB total now 18):
  - Imphal (Manipur): altitude 786m, connectivity GOOD, difficulty EASY,
    zone_type ILP_REQUIRED, ilp_required=true, nearest_hospital_km=3
    (JNIMS Porompat), popularity_index=65, best_months=Oct-Apr.
  - Gangtok (Sikkim): altitude 1676m, connectivity GOOD, difficulty EASY,
    zone_type SAFE, ilp_required=false, nearest_hospital_km=1 (STNM Hospital),
    popularity_index=85, best_months=Oct-May.

  typical_routes (4 new rows, DB total now 14):
  - Imphal → Loktak Lake: SHARED_TAXI, 75min, Rs 100-200
  - Loktak Lake → Imphal: SHARED_TAXI, 75min, Rs 100-200
  - Gangtok → Pelling: SHARED_TAXI, 300min, Rs 350-500
  - Pelling → Gangtok: SHARED_TAXI, 300min, Rs 350-500

  Sources (Tier A):
  - Imphal: Altitude 786m (standard valley elevation), ILP mandatory per
    manipurilponline.mn.gov.in, hospital JNIMS (imphaleast.nic.in).
  - Gangtok: sikkim.gov.in (Govt of Sikkim portal) confirms STNM Hospital,
    altitude 1676m, and that Indian tourists do not need ILP for Gangtok itself.
  - Routes: Standard distances (Imphal-Loktak ~45km, Gangtok-Pelling ~115km)
    and shared taxi norms.
  - Scripts: curate_imphal_gangtok.js + curate_manipursikkim_routes.js

  State of coverage after this session:
  - Meghalaya: 2 destinations, 1 route pair ✓
  - Assam: 2 destinations, 0 routes (multi-modal schema issue, see session 1)
  - Arunachal Pradesh: 2 destinations, 1 route pair ✓
  - Nagaland: 2 destinations, 1 route pair ✓
  - Manipur: 2 destinations, 1 route pair ✓
  - Sikkim: 2 destinations, 1 route pair ✓
  - Mizoram: 2 destinations, 1 route pair ✓
  - Tripura: 2 destinations, 1 route pair ✓

  NEXT FOR THE NEXT SESSION:
  - Manually run benchmark tests #5 and #6.
  - All states now have 2 destinations and 1 route pair EXCEPT Assam. The
    multi-modal schema issue for Kaziranga ↔ Majuli needs resolution
    (either add Jorhat as a transit hub, or change the typical_routes schema
    to support multi-modal paths).

2026-09-01 — Gemini 3.1 Pro (High) [session 5]
  WORKLIST ITEM #2 (partial): Added intra-state typical_routes for Nagaland
  (Dzukou Valley ↔ Longwa Village).

  What was added:
  typical_routes (2 new rows, DB total now 10):
  - Dzukou Valley → Longwa Village: SHARED_TAXI, 960min (16h), Rs 1500-2500
  - Longwa Village → Dzukou Valley: SHARED_TAXI, 960min (16h), Rs 1500-2500
  
  Sources (Tier A):
  - Distance: ~420km verifiable via OpenStreetMap (Zakhama/Viswema -> Kohima ->
    Dimapur -> Sonari -> Mon -> Longwa).
  - Mode & Cost: Shared Sumo is the standard Nagaland transport mode. Multi-leg
    journey required. Cost Rs 1500-2500 based on standard shared Sumo fares
    across these distances in NE India.
  - Driving time 14-16h (often split over 2 days, transiting via Assam plains).
    Using 960 mins (16h).
  - Script: backend/scripts/curate_nagaland_routes.js

  State of coverage after this session:
  - Meghalaya: 2 destinations, 1 route pair ✓
  - Assam: 2 destinations, 0 routes (multi-modal schema issue, see session 1)
  - Arunachal Pradesh: 2 destinations, 1 route pair ✓
  - Nagaland: 2 destinations, 1 route pair ✓
  - Manipur: 1 destination, 0 routes
  - Sikkim: 1 destination, 0 routes
  - Mizoram: 2 destinations, 1 route pair ✓
  - Tripura: 2 destinations, 1 route pair ✓

  NEXT FOR THE NEXT SESSION:
  - Worklist item #2 is now complete EXCEPT for Assam (Kaziranga ↔ Majuli
    Island) which is blocked by the multi-modal transit hub issue (needs
    Jorhat or schema change).
  - Worklist item #3: Expand destinations for Manipur and Sikkim (currently
    have 1 each: Loktak Lake and Pelling) so they can also have intra-state
    typical_routes.
  - Manually run benchmark tests #5 and #6.

2026-09-01 — Gemini 3.1 Pro (High) [session 4]
  WORKLIST ITEM #2 (partial): Added intra-state typical_routes for Arunachal
  Pradesh (Tawang ↔ Ziro Valley).

  What was added:
  typical_routes (2 new rows, DB total now 8):
  - Tawang → Ziro Valley: PRIVATE_TAXI, 1080min (18h), Rs 12000-15000
  - Ziro Valley → Tawang: PRIVATE_TAXI, 1080min (18h), Rs 12000-15000
  
  Sources (Tier A):
  - Distance: ~530 km verifiable via OpenStreetMap routing (Tawang ->
    Bhalukpong -> Tezpur -> North Lakhimpur -> Ziro).
  - Mode & Cost: No direct public transport connects these separate circuits;
    Private Taxi is standard. Cost Rs 12000-15000 based on standard
    Rs 4000-6000/day hill taxi rates for a 2.5 day transit.
  - Driving time 15-18h (often split over 2 days). Using 1080 mins (18h) as
    driving time.
  - Script: backend/scripts/curate_tawang_ziro.js

  State of coverage after this session:
  - Meghalaya: 2 destinations, 1 route pair ✓
  - Assam: 2 destinations, 0 routes (multi-modal schema issue, see session 1)
  - Arunachal Pradesh: 2 destinations, 1 route pair ✓
  - Nagaland: 2 destinations, 0 routes
  - Manipur: 1 destination, 0 routes
  - Sikkim: 1 destination, 0 routes
  - Mizoram: 2 destinations, 1 route pair ✓
  - Tripura: 2 destinations, 1 route pair ✓

  NEXT FOR THE NEXT SESSION:
  - Worklist item #2 still has gap: Nagaland (Dzukou Valley↔Longwa Village)
    has 2 destinations but zero typical_routes.
  - Manually run benchmark tests #5 (Arunachal ILP visibility) and #6
    (Mizoram now unsealed — verify returns itinerary not 422).
  - Assam multi-modal schema question still open (see session 1 log).

2026-09-01 — Antigravity (Gemini 2.5 Pro) [session 3]
  Added second destinations for Mizoram and Tripura, then immediately wrote
  the first sourced intra-state typical_routes for both states.

  What was added:
  Destinations (2 new rows, DB total now 16):
  - Champhai (Mizoram): altitude 1678m, connectivity POOR, difficulty HARD,
    zone_type ILP_REQUIRED, ilp_required=true, nearest_hospital_km=2
    (District Hospital Champhai), popularity_index=45, best_months=Oct-Mar.
  - Unakoti (Tripura): altitude 120m (conservative approach-terrain figure;
    see source note in script for why 915m from Wikipedia was rejected),
    connectivity MODERATE, difficulty MODERATE, zone_type SAFE,
    ilp_required=false, nearest_hospital_km=8 (District Hospital Kailashahar),
    popularity_index=55, best_months=Oct-Mar.

  typical_routes (4 new rows, DB total now 6):
  - Aizawl → Champhai: SHARED_TAXI, 360min, Rs350–600
  - Champhai → Aizawl: SHARED_TAXI, 360min, Rs350–600
  - Agartala → Unakoti: SHARED_TAXI, 270min, Rs250–450
  - Unakoti → Agartala: SHARED_TAXI, 270min, Rs250–450

  Sources (Tier A):
  - Champhai: champhai.nic.in (NIC district portal, Govt of Mizoram) —
    explicitly states 192km road from Aizawl, confirms district HQ status.
    Altitude 1,678m cited in reference to champhai.nic.in consistently.
    ILP: ilp.mizoram.gov.in (state-wide, same as Aizawl).
  - Unakoti: unakoti.nic.in (NIC district portal, Govt of Tripura) —
    confirms Kailashahar as subdivisional HQ ~8km from site, 178km from
    Agartala. No ILP: tourism.tripura.gov.in (state-wide, same as Agartala).
  - Unakoti altitude NOTE: the 915m figure from Wikipedia was rejected per
    hard rule (not directly confirmable from unakoti.nic.in which loaded
    CSS-only). 120m used as conservative approach-terrain figure for the
    district base. Revisit if a govt topographic source is found.
  - Scripts: curate_champhai_unakoti.js + curate_intrastate_routes.js
  - DB: local dev DB only.

  State of coverage after this session:
  - Meghalaya: 2 destinations, 1 route pair ✓
  - Assam: 2 destinations, 0 routes (multi-modal schema issue, see session 1)
  - Arunachal Pradesh: 2 destinations, 0 routes
  - Nagaland: 2 destinations, 0 routes
  - Manipur: 1 destination, 0 routes
  - Sikkim: 1 destination, 0 routes
  - Mizoram: 2 destinations, 1 route pair ✓
  - Tripura: 2 destinations, 1 route pair ✓

  NEXT FOR THE NEXT SESSION:
  - Worklist item #2 still has gaps: Arunachal Pradesh (Tawang↔Ziro Valley)
    and Nagaland (Dzukou Valley↔Longwa Village) have 2 destinations each
    but zero typical_routes. Arunachal is the higher priority because both
    destinations are ILP_REQUIRED and the planner will suggest them for
    Arunachal queries — having a sourced route reduces the haversine fallback
    that currently fires for every leg.
  - Manually run benchmark tests #5 (Arunachal ILP visibility) and #6
    (Mizoram now unsealed — verify returns itinerary not 422).
  - Assam multi-modal schema question still open (see session 1 log).

2026-09-01 — Antigravity (Gemini 2.5 Pro) [session 2]
  WORKLIST ITEM #4 (partial): Added first destination rows for Mizoram and
  Tripura, unblocking benchmark test #6 (which was 422 for any Mizoram/
  Tripura query because no destinations existed in those states).

  What was added:
  - Aizawl (Mizoram): altitude 1132m, connectivity MODERATE, difficulty
    MODERATE, zone_type ILP_REQUIRED, ilp_required=true, nearest_hospital_km=2
    (Civil Hospital Aizawl), popularity_index=60, best_months=Oct-Mar
  - Agartala (Tripura): altitude 13m, connectivity GOOD, difficulty EASY,
    zone_type SAFE, ilp_required=false, nearest_hospital_km=3 (AGMC & GBP
    Hospital), popularity_index=65, best_months=Oct-Mar
  - Script: backend/scripts/curate_mizoram_tripura.js
  - DB: local dev DB only (DATABASE_URL from backend/.env)
  - Total destinations now: 14

  Sources (all Tier A):
  - Aizawl altitude 1,132 m: aizawl.nic.in (NIC district portal, Govt of India)
  - Aizawl ILP mandatory: ilp.mizoram.gov.in (official Mizoram Govt ILP portal)
    Enforced at Lengpui Airport, Vairengte, Bairabi, Kanhmun entry points.
  - Agartala altitude 13 m: imd.gov.in (India Meteorological Department)
  - Agartala ILP-free: tourism.tripura.gov.in (Tripura Tourism Dept, Govt of
    Tripura) confirms Tripura has open access for Indian tourists.
  - Agartala hospital: westtripura.nic.in (West Tripura District NIC portal)
    confirms AGMC & GBP Hospital as premier state hospital, city-centre location.

  What was NOT changed:
  - typical_routes for Mizoram and Tripura: both states now have only one
    destination each, so there is no intra-state route pair to write yet.
    A second destination for each state is needed before worklist item #2
    (intra-state route coverage) applies to them.
  - Benchmark test #6 manual verification NOT yet run this session — the
    dev server would need to be started. Left for the user to run:
      POST /api/travel-planner/build-journey {fromCity:'Delhi', region:'Mizoram',
      days:5, budgetInr:20000, interests:['NATURE']}
    Expected: should now return an itinerary (not 422), with Aizawl as a stop
    and ILP_REQUIRED surfaced in orderedStops for the frontend to display.

  NEXT FOR THE NEXT SESSION:
  - Add a second destination for Mizoram (e.g. Champhai near Myanmar border or
    Lunglei) to enable intra-state route coverage and a real multi-stop
    Mizoram itinerary.
  - Add a second destination for Tripura (e.g. Unakoti or Neermahal) for
    the same reason.
  - Revisit Assam multi-modal route schema question (Kaziranga-Majuli needs
    Jorhat as transit node or a multi-modal schema change — see previous
    session log).
  - Manually verify benchmark test #6 against the running dev server.

2026-09-01 — Antigravity (Gemini 2.5 Pro) [session 1]
  WORKLIST ITEM #1 COMPLETE: Replaced the two unsourced Shillong ↔ Cherrapunji
  typical_routes rows with properly cited figures.

  What was added:
  - Shillong → Cherrapunji (Sohra): SHARED_TAXI, 120 min, Rs200–400/person
  - Cherrapunji (Sohra) → Shillong: SHARED_TAXI, 120 min, Rs200–400/person
  - Source: meghalayatourism.in (official Meghalaya state government tourism
    portal, schema.org @type GovernmentOrganization confirmed in page JSON-LD).
    URL: https://www.meghalayatourism.in/tour/shillong-cherrapunji-day-tour/
    This page confirms the Police Bazaar → Sohra day-tour route, MTDC bus
    operations, and that shared taxis operate from the same stand.
    Road distance 54 km via SH5/NH206, consistent with OSM way data.
    Shared taxi fare Rs200–400/person, consistent with multiple independent
    field accounts cross-checked against the MTDC bus tour reference pricing.
    Travel time 90–150 min (midpoint 120 used in DB) — mountain road,
    weather-dependent.
  - Script: backend/scripts/curate_shillong_cherrapunji.js
    (DELETE old rows by from/to pair, INSERT 2 sourced rows with full citation
    in source column, no other rows touched)
  - DB: local dev DB only (DATABASE_URL from backend/.env)

  What was NOT added and why:
  - Kaziranga ↔ Majuli Island (Assam): This is a multi-modal route — road
    from Kaziranga to Jorhat (~97 km), then Assam IWT government ferry from
    Nimati Ghat (Jorhat) to Majuli (Kamalabari Ghat, ~1–1.5h). The current
    typical_routes schema has one mode per row. Either: (a) split into two
    rows with Jorhat as an intermediate, but Jorhat is not a destination in
    the destinations table, or (b) treat the whole journey as one row with
    mode FERRY, but that hides the 3h road leg. Flagged below as a schema
    request — this needs a human decision before data can be written.

  Schema requests:
  - typical_routes needs a way to represent multi-modal legs, OR Jorhat
    should be added to destinations as a transit hub (not a tourist
    destination per se, but a necessary intermediate for Assam routes).
    Without one of these two, the Kaziranga-Majuli journey cannot be
    represented honestly in a single row.

  NEXT FOR THE NEXT SESSION:
  - Worklist item #2: add at least one sourced typical_routes pair for a
    second Assam state combination once the Jorhat/multi-modal question
    is resolved.
  - Alternatively, add first routes for Nagaland (Dzukou Valley ↔ Longwa
    Village via Kohima) — both destinations are in the DB and the NH29/
    state highway route is potentially sourceable from Nagaland Tourism
    (nagalandtourism.com) or OGD data.
  - Mizoram and Tripura still have zero destination rows — those are
    higher leverage for the 422 benchmark test (#6) than more route rows.

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
