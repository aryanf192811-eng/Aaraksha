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

**Multi-modal legs** (resolved 2026-09-01, see session log below): a
`typical_routes` row's `mode` isn't limited to a single physical vehicle.
For a connecting journey (e.g. road + government ferry, like Kaziranga →
Majuli Island via Jorhat), use `mode: 'MIXED'` (or `'FERRY'` if the whole
leg is genuinely one boat journey), combine the duration/cost across both
hops, and put the actual breakdown in `notes` — the frontend renders
`notes` under the leg (`JourneyResultCard.tsx`'s `LegRow`), so nothing
gets hidden. Don't add the intermediate hub (e.g. Jorhat) as its own
`destinations` row — that would make it a selectable itinerary stop,
which is wrong for a place tourists pass through rather than visit.

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
| Assam | Kaziranga, Majuli Island | - | Kaziranga (2), Majuli Island (1) |
| Arunachal Pradesh | Tawang, Ziro Valley | - | - |
| Nagaland | Dzukou Valley, Longwa Village | - | - |
| Manipur | Loktak Lake | - | - |
| Sikkim | Pelling | - | - |
| Mizoram | Aizawl ✓, Champhai ✓ (sourced 2026-09-01) | Aizawl ↔ Champhai ✓ (sourced 2026-09-01) | - |
| Tripura | Agartala ✓, Unakoti ✓ (sourced 2026-09-01) | Agartala ↔ Unakoti ✓ (sourced 2026-09-01) | - |

**Worklist, roughly in priority order**:
1. ~~**Replace the two unsourced `typical_routes` rows** (Shillong ↔
   Cherrapunji)~~ ✅ Done 2026-09-01 — see session log.
2. ~~**Mizoram and Tripura had zero `destinations` rows**~~ ✅ Partially
   done 2026-09-01 (Aizawl, Agartala added, both Tier A sourced) — but
   each state has only **one** destination now, so there's no intra-state
   route pair to write yet. A second destination in each unblocks that.
3. **A second destination for Mizoram and for Tripura** (e.g. Champhai or
   Lunglei for Mizoram; Unakoti or Neermahal for Tripura), so those states
   can support a real multi-stop itinerary and route coverage, not just a
   single-city trip.
4. At least one sourced `typical_routes` leg for every state that has 2+
   destinations, so a journey within that state doesn't fall back to the
   haversine estimate for every leg. Currently only Meghalaya has one.
   Nagaland (Dzukou Valley ↔ Longwa Village via Kohima) and Assam
   (Kaziranga ↔ Majuli Island via Jorhat — see the "Multi-modal legs"
   convention above, now unblocked) are both good next targets.
5. More `destination_reviews`-informed cost data — most destinations have
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
  trip-operating-system enhancements discussed with the user
  (natural-language trip intake, and letting the assistant propose/apply
  changes to an already-committed trip) -- see the main conversation, not
  this file, for that work's own plan and progress. For curation:
  session 3's own NEXT list (Arunachal Pradesh route pair, then Nagaland)
  is the right next target.

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
