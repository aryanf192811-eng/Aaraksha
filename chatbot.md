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
what's thin, what sources are allowed, and how to check whether your
changes actually helped.

---

## Read these first

- [`AGENTS.md`](./AGENTS.md) — general project conventions (git, migrations, deploy).
- [`CLAUDE.md`](./CLAUDE.md) — product context and architecture.
- `backend/src/services/travelScoring.service.js` — the deterministic scorer. Read its header comment before changing anything data-related; the whole feature's integrity depends on this module being the only thing that computes facts.
- `backend/src/services/travelPlanner.service.js` — orchestration (retrieval → score → Gemini narrates).

---

## What lives where

| Data | Table | Curated by |
|---|---|---|
| Destination attributes (connectivity, difficulty, altitude, zone_type, ILP, hospital distance, popularity, description, best_months) | `destinations` | Hand-curated / this tracker |
| Real traveller cost/experience data (rating, actual cost, crowd level, felt_safe, tips) | `destination_reviews` | Real Aaraksha users, not scraped |
| Transport legs between destinations (mode, duration, cost range) | `typical_routes` | Hand-curated / this tracker |
| Long-haul gateway legs (e.g. Delhi → Guwahati) | `backend/src/services/travelPlanner.service.js#EXTERNAL_GATEWAY_LEGS` | A small stable constant, not a DB table — these facts don't change week to week the way in-region routes/reviews do |

## Sourcing rules — read before adding anything

**Allowed**: Ministry of Tourism open data, the OGD (Open Government Data) platform, OpenStreetMap, and Aaraksha's own `destination_reviews` (real user-submitted data, already a first-class feature — never fabricate a review).

**Not allowed**: scraping TripAdvisor, Google Reviews, Reddit, or any other proprietary platform's content. This was a deliberate decision, not an oversight — ToS risk and unnecessary given `destination_reviews` already exists. If you're tempted to "just scrape a few reviews to fill a gap," don't — leave the gap visible (the scorer already handles missing review data honestly, via `FALLBACK_DAILY_SPEND_INR` and the `localSpendEstimated` flag) rather than filling it with something ungrounded.

**Never fabricate a specific number** (a cost, a duration, a rating) to fill a gap. An honest "no data yet" beats a plausible-looking invented one — the whole feature's credibility rests on every number being traceable to a real source.

---

## Dataset coverage checklist

Update this table as destinations/routes/reviews get added. A `-` means genuinely not yet covered — that's the actual worklist.

| State | Destinations w/ full attributes | `typical_routes` legs | `destination_reviews` rows |
|---|---|---|---|
| Meghalaya | Shillong, Cherrapunji (Sohra) | Shillong ↔ Cherrapunji | Shillong (1), Cherrapunji (1) |
| Assam | Kaziranga, Majuli Island | - | - |
| Arunachal Pradesh | Tawang, Ziro Valley | - | - |
| Nagaland | Dzukou Valley, Longwa Village | - | - |
| Manipur | Loktak Lake | - | - |
| Sikkim | Pelling | - | - |
| Mizoram | - | - | - |
| Tripura | - | - | - |

**Worklist, roughly in priority order**: (1) at least one `typical_routes` leg for every state that has 2+ destinations, so a journey within that state can be built without falling back to the haversine estimate for every leg; (2) more `destination_reviews` rows per destination (1 review each right now, which is thin — the `avgRating`/`avgCostInr` the scorer reports is one person's experience, not a real average yet); (3) Mizoram and Tripura have zero `destinations` rows at all — `buildJourney` will 422 for those regions until at least one exists.

---

## Benchmark query set

Fixed, representative "Build My Journey" requests. Re-run these against `POST /api/travel-planner/build-journey` after any dataset change and check the criteria — this is what "improving accuracy" concretely means here: more of these passing, not a vibe.

| # | Request | Pass criteria |
|---|---|---|
| 1 | Delhi → Meghalaya, 5 days, ₹20,000, NATURE+ADVENTURE | `scores.budget` ≥ 80; no stop has `zone_type: RESTRICTED` without a surfaced ILP/advisory note |
| 2 | Mumbai → Meghalaya, 3 days, ₹10,000, RELAXATION | `scores.duration` ≥ 70 (3 days is tight — a good result should say so via a lower duration score, not silently overcommit) |
| 3 | Kolkata → Assam, 4 days, ₹15,000, WILDLIFE | Kaziranga (a real national park) should be in `orderedStops` when WILDLIFE is requested and the region has it |
| 4 | Delhi → Nagaland, 6 days, ₹25,000, ADVENTURE | Dzukou Valley (`difficulty: EXTREME`, `zone_type: HIGH_RISK`) should surface a low `scores.safety` and a corresponding `worstStop` warning, not be hidden |
| 5 | Delhi → Arunachal Pradesh, 5 days, ₹18,000, NATURE | Both stops are `ILP_REQUIRED` — the response should make that visible (frontend renders it from `orderedStops`/`destinations.ilp_required`, verify it's not silently dropped) |
| 6 | (no region seeded, e.g. "Mizoram") | Returns a clean 422 with a message pointing at this file, not a crash or an empty-but-200 response |

A `tests/eval/travelPlanner.benchmark.js` script running these programmatically is real future work (see the plan history) — until it exists, run them by hand via curl (same pattern as this feature's own live verification) and update the table above with the result.

---

## Session log

Format: date, who/which model, what changed, what's next. Newest first.

```
2026-09-01 — Claude Code (Sonnet 5)
  Built: typical_routes migration, travelScoring.service.js (deterministic,
  12 passing unit tests), travelPlanner.repository.js/service.js, Gemini
  narration + intent-extraction functions, /api/travel-planner routes,
  seeded one real Shillong<->Cherrapunji route leg. Live-verified the full
  build-journey -> ask -> commit pipeline end-to-end against the dev DB.
  NEXT: TravelAssistantFAB.tsx (premium floating chat UI) on the tourist
  frontend, then fill in the dataset coverage worklist above.
```
