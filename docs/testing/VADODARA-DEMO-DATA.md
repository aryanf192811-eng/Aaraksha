# Vadodara / Parul University demo data

Added for the SIH 2025 screening round, which happens at Parul University
itself. Everything here is additive-only and lives alongside the existing
Northeast India demo dataset — nothing was removed or overwritten. Listed
here specifically so it's easy to find and strip back out after the
screening if you want to return to a pure Northeast India demo.

## What was added, and why

| # | What | Migration / how it was created |
|---|---|---|
| 1 | `Parul University` destination — real GPS coordinate this session's own live device testing captured (22.29257080, 73.34510910), Gujarat | `backend/src/migrations/018_vadodara_seed.js` |
| 2 | `Vadodara` destination — city-level, standard published coordinates (22.3072, 73.1812) | `backend/src/migrations/018_vadodara_seed.js` |
| 3 | Backfilled one existing ACTIVE demo trip with "Parul University" as an added stop | `backend/src/migrations/018_vadodara_seed.js` (same file — picks whichever demo tourist already has an active trip, not a specific hardcoded one) |
| 4 | `Parul University Response Team` — official rescue team (MEDICAL type), same coordinate as #1, status AVAILABLE | `backend/src/migrations/019_vadodara_rescue_team.js` |
| 5 | A demo tourist account based at Parul University, with an active trip there | Created via the real `POST /api/auth/register` API (not a migration — needs a real bcrypt password hash and a Verhoeff-valid Aadhaar number the app's own code computes) |
| 6 | An OFFICIAL rescuer account linked to the team in #4, able to log into the Rescuer app | Created via the real `POST /api/govt/volunteers` API with `teamId` set to #4's id |

## Demo credentials

| Role | Name | Phone | Password | Notes |
|---|---|---|---|---|
| Tourist | Meera Shah | 9099911001 | Demo@123 | Tourist app login. Active trip "SIH 2025 Screening at Parul University" (id `da5c424e-792a-42fa-b613-d2e96e869b3d`), TSI 83 (Low Risk). Emergency contact: Kiran Shah, 9099911002 (contact only, not a login). |
| Official rescuer | Rajesh Solanki | 9099911002 | 7PSDH7CWE9MN | Rescuer app login. Linked to "Parul University Response Team" (id `efc3f050-e9c9-45b9-a4a1-a45447747378`). Note: shares its phone digits with Meera's emergency-contact phone above by coincidence — harmless since tourists/volunteers are separate login tables, but pick a different number if that reads as confusing on stage. |

Govt admin login for assigning this team to an SOS during the demo: `admin@aaraksha.gov.in` / `Admin@123` (existing seed account, not new).

**Suggested live demo flow:** log in as Meera Shah (tourist) → trigger SOS from Parul University → log in as govt admin → assign "Parul University Response Team" (or Rajesh Solanki directly) from the SOS queue → log in as Rajesh Solanki (rescuer) → advance EN_ROUTE → ARRIVED → verify handoff → govt resolves.

## How to remove all of this later

1. **Migrations 018/019** (destinations + team): `npm run migrate:down` twice from `backend/`
   rolls back 019 then 018 in order — both `down` migrations explicitly `DELETE` only the rows
   they added (`WHERE name IN (...)`/`WHERE name = ...`), nothing else. Note 018's `down` does
   **not** try to remove the trip-stop backfill (can't cleanly identify which array element was
   added after other edits) — if you want that gone too, manually edit the affected trip's
   `stops` JSONB to drop the Parul University entry.
2. **The tourist and rescuer accounts** (items 5/6): these aren't migrations, they're real rows
   created through the API — remove them the same way you'd remove any other demo account
   (govt's Volunteers page has a reject/deactivate path for the rescuer; the tourist account has
   no self-service delete from an admin view today, so either leave it — it's harmless, isolated
   demo data — or delete the `tourists` row directly if you want it fully gone).
3. Either way, re-run `npm run migrate` after any rollback so `pgmigrations` stays in sync with
   what's actually applied.

## Why no verified emergency phone numbers

`Parul University` destination's `nearest_hospital_name` uses "Parul Sevashram Hospital" (a real,
verifiable institution on the same campus) but deliberately has **no phone number** set, and the
rescue team's `contact_phone` (9099911100) is a placeholder, not a verified number. Didn't want to
fabricate a specific number that could be wrong and end up actually dialed live during a demo —
worth filling in with real, verified numbers before the screening if those fields get shown.
