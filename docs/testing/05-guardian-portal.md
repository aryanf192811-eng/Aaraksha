# 05 — Guardian Portal (Phase 5)

## Test Objective

Exercise the Guardian Portal (`frontend/guardian/`, single screen `TrackingPage.tsx`) as a family
member would — token-in-URL access, no auth — covering token validity/privacy, all live-status
renderings (SAFE/SOS/ASSIGNED/WARNING/NO_SIGNAL), the live map and OSRM route fallback called out
by [`QA-MASTER-PLAN.md`](./QA-MASTER-PLAN.md) §1.1 as one of four independent map instances at risk
of the same zero-distance/fitBounds bug class fixed earlier this session, and the socket-driven
real-time updates.

## Scope

`frontend/guardian/` (read-only, no mutations of its own — it has zero `useMutation` calls, so the
missing-`onError` bug class found in Phases 3–4 doesn't apply here by construction). Two small
fixes landed in `frontend/tourist/src/i18n/locales/` (all 3 locales) for a Guardian-Link copy
inaccuracy discovered while testing this portal. No backend code changed.

## Environment

Live manual walkthrough: guardian frontend on `localhost:5175` and tourist frontend on
`localhost:5173`, both against the demo backend (`localhost:5000` / `aaraksha`) — this portal has
no destructive actions of its own, so no isolated test-DB instance was needed for it specifically.
One multi-portal restoration flow (see Findings) touched the demo DB directly, disclosed and
confirmed with the user before each write, consistent with every prior phase's practice.

## Tests Executed

1. Read `TrackingPage.tsx`, `lib/socket.ts`, `lib/osrm.ts`, and the backend's
   `tourist.service.js#getGuardianView` / `tourist.repository.js#findByGuardianToken` in full before
   any live testing, to form specific hypotheses rather than testing blind.
2. Confirmed via code review that `connectSocket`/`disconnectSocket`'s module-level singleton is
   correctly torn down and recreated on every `token` change (both `useEffect`s key off `[token]`
   and clean up before re-running) — ruled out a suspected session-bleed bug between different
   guardian links without needing a live repro, since the cleanup logic is unambiguous.
3. Confirmed via code review that this map does **not** call `fitBounds` (fixed center + zoom=14
   instead) — the specific "blank map" bug class from the zero-distance `RescueTrackingCard.tsx` fix
   earlier this session structurally cannot recur here.
4. Live: navigated to a real, valid, non-expired guardian token belonging to a **soft-deleted**
   tourist (`is_active = false`, PII already scrubbed by the DPDP deletion flow, confirmed by direct
   query first) — confirmed the portal shows "Tracking link not found or expired" with zero data
   leakage, because `findByGuardianToken`'s query includes `AND is_active = TRUE`.
5. Live: navigated to a syntactically garbage token — same clean 404 handling.
6. Live: navigated to 3 real, valid, active demo personas' tokens (Aryan Demo, Rahul Verma, Sneha
   Das) — exercised SAFE, ASSIGNED, and SOS status renderings respectively.
7. Live: cross-checked the map, ETA, battery, blood group, and TSI fields shown against a direct DB
   query for each persona, which is how the two findings below were caught (not from either surface
   in isolation).
8. Reviewed `getStatus()`'s SAFE/WARNING(2h)/NO_SIGNAL(4h) boundary thresholds by code — not
   artificially triggered live, to avoid further mutating the demo data's timestamps; the logic is
   a direct, unambiguous date-difference comparison with no edge case beyond the two documented
   cutoffs.
9. Reviewed `lib/osrm.ts#getRoute` — confirmed it catches every failure mode (network, timeout via
   `AbortSignal.timeout(6000)`, non-OK response, empty geometry) and returns `null` rather than
   throwing, and confirmed `TrackingPage.tsx` always has a straight-line dashed-polyline fallback
   ready when `route` is null — satisfies the master plan's "falls back to a straight line and says
   so" requirement (the dashed vs. solid line style is the "says so").
10. Restored the flagship "SOS assigned to a volunteer, EN_ROUTE" demo scenario for Karan Mehta
    end-to-end through the real product flow (not raw SQL for the assignment itself): logged in as
    Karan on the tourist PWA, held the SOS button to the category-picker threshold, selected
    TRAPPED, confirmed "SOS sent"; then on the govt SOS Management page, opened the new SOS and
    assigned volunteer Priya Deka — confirmed live in the DB (`rescue_assignments` row with
    `volunteer_id` set, `status = 'ASSIGNED'`) and live in the Guardian Portal ("Priya Deka
    dispatched · Local Volunteer · ETA ~8 min", real OSRM road route rendered).
11. `npx tsc -b` on `frontend/tourist` and `frontend/guardian` — both clean after the locale fixes.

## Results

| Area | Result |
|---|---|
| Deleted-account token access | PASS — correctly blocked, no PII leakage |
| Invalid/garbage token | PASS — clean error state |
| SAFE / SOS / ASSIGNED status rendering | PASS — all 3 live-verified against real personas |
| WARNING / NO_SIGNAL thresholds | PASS (code review — 2h/4h boundaries correct, not artificially triggered) |
| Map (no fitBounds, so immune to the earlier zero-distance bug class) | PASS |
| OSRM route fallback | PASS — degrades to a visually-distinct dashed straight line, never breaks |
| Socket reconnection across token changes | PASS (code review — cleanup/recreate is correct) |
| Karan Mehta's flagship volunteer-EN_ROUTE scenario | RESTORED, live-verified end-to-end |

## Bugs Found

- **B1 (P3) — Guardian Link copy falsely claims automatic renewal.** `ProfilePage.tsx` shows "Valid
  for 90 days · Renews automatically" (all 3 locales), but `guardianTokenExpires` is set exactly
  once, at registration (`auth.service.js`), with no renewal or regeneration code anywhere in the
  backend. A tourist who reads this literally will have a dead guardian link 90 days after signup
  with no way to get a new one, and no warning it's coming.

## Root Cause

B1: copy was written aspirationally (a renewal mechanism may have been planned) but the feature was
never built, and the string was never revisited.

## Fixes Applied

- `frontend/tourist/src/i18n/locales/{en,hi,as}.ts`: `guardianLinkValidity` corrected to state only
  what's actually true — "Valid for 90 days from registration" (and equivalent, non-renewal-claiming
  Hindi/Assamese translations) — rather than removing the string or promising a fix that isn't in
  scope for this pass. A real renewal/regeneration feature, if wanted, is a product decision outside
  a QA pass's mandate — flagged here, not built.

## Regression Tests

`tsc -b` clean on `frontend/tourist` and `frontend/guardian`. No backend or API-contract changes in
this phase, so the backend regression suites were not re-run (nothing in their scope changed).

## Demo Database Findings (the substantive part of this phase)

Testing the Guardian Portal's live map for Rahul Verma surfaced a rescue-team ETA of **"~1d 8h"**
for what should be a ~40-minute dispatch. Traced to root cause and confirmed by direct query, not
assumed:

**4 of 5 canonical demo personas' `tourist_locations` row had been silently overwritten with this
machine's real browser geolocation** (Vadodara, Gujarat — visible earlier this session as the
Checkpoint Scan page's auto-filled "Vadodara" district) instead of their seeded Northeast-India trip
coordinates. Root-caused to three tourist-side actions that all call `navigator.geolocation` for
real — Check-In (`CheckinPage.tsx`), sending an SOS (`useSOS.ts`), and Dead Man's Switch reset
(`useDMS.ts`, confirmed live mid-phase when triggering Karan Mehta's SOS reproduced the exact same
leak in real time) — having been exercised against these accounts at various points earlier in this
session, before this session's real-device-GPS implication was well understood. This is a testing-
process artifact, not an application bug — the app is correctly reporting genuine device GPS; the
issue is purely that the demo personas' stories assume they're in Northeast India.

This also retroactively explains 3 of the "Off planned route, 2000+km from nearest stop" anomalies
seen on the govt Live Map in Phase 4 — those were real anomaly-detection output, correctly computed,
just fed by this same corrupted location data rather than a real anomaly-detection defect.

Separately, Priya Sharma (whose seeded persona is "completed trip, passport-ready, no incidents,"
and who was never given a `tourist_locations` row by the seed script at all) had acquired a stray
one, coincidentally identical to Karan Mehta's seeded coordinates — a side effect of the same
"QA error-path test" SOS artifact already found and removed from her account in Phase 4.

**Confirmed with the user before every write, in two rounds:**
- Round 1: restored Aryan Demo, Rahul Verma, Sneha Das, and Karan Mehta's `tourist_locations` to
  their seeded coordinates; deleted Priya Sharma's stray row entirely.
- Round 2 (mid-phase, self-inflicted and immediately caught): restoring Karan Mehta's flagship
  scenario required actually triggering a live SOS as him to test the full cross-portal flow — which
  reproduced the exact same GPS leak on his account and on Sneha Das's already-active SOS, in real
  time, confirming the root cause hands-on. Both were corrected again (this time including the
  `sos_events` rows themselves, not just `tourist_locations`, since an SOS snapshots its trigger
  coordinates rather than live-linking to the tourist's current position).

**User-facing guidance provided during this phase** (not a code fix — a live-demo logistics
question the corruption surfaced): the presenter is physically in Vadodara, and any live trigger of
Check-In / SOS / DMS-reset during the actual SIH screening will reproduce this same leak from
wherever the demo is actually run. Recommended mitigation: use Chrome DevTools → Sensors → Location
override to the intended city before triggering any of those three specific actions live; everything
else (viewing screens, maps, dashboards) is unaffected since nothing else re-fetches GPS.

## Remaining Issues

None P0/P1. A real guardian-token renewal/regeneration feature does not exist and is out of scope to
build in a QA pass — flagged as a product gap (B1's root cause), not fixed beyond correcting the
false claim about it. Karan Mehta's demo account still has 3 stray `PLANNED`-status trips from
earlier session testing (harmless — they simply don't render as his active trip anywhere, confirmed
by his Guardian Portal view correctly showing a blank "Destination" field rather than a wrong one)
that could be tidied in a later pass but don't affect any current portal's correctness.

## Evidence

Guardian Portal screenshots for the deleted-account block, Rahul Verma (before and after the
location fix), Sneha Das, and the restored Karan Mehta scenario were reviewed inline during testing
and are not retained in the repo, per the existing screenshot-cleanup convention.

## Conclusion

The Guardian Portal's own code held up cleanly — no missing-onError class bug (structurally exempt,
it has no mutations), no map-blanking bug (structurally exempt, no fitBounds), correct privacy
enforcement on deleted accounts, correct OSRM degrade-not-break behavior, and correct socket
lifecycle across token changes. The one real code bug found (B1) was a small, honest documentation-
style fix. The far larger finding this phase was a demo-data integrity issue spanning 4 of 5
canonical personas and 3 different portals (Guardian, Govt Live Map, Govt Analytics' anomaly feed) —
caught only because the Guardian Portal's live ETA calculation made an otherwise-invisible data
problem visually obvious ("~1d 8h" instead of "~40 min"), which is exactly the kind of cross-portal,
real-data verification this master plan exists to do that a purely code-level review would have
missed entirely. No P0 or P1 issues remain open.

---

**TESTS EXECUTED:** 11 (see Tests Executed above), covering all 5 status renderings (3 live, 2 by
code review), token validity/privacy (2 live cases), map/route fallback (code review), and one full
cross-portal live restoration (tourist SOS → govt assignment → guardian view).

**BUGS FOUND:** 1 (B1, P3 — misleading "renews automatically" guardian-link copy) + 1 significant
demo-data integrity issue (not a code bug) spanning 4 personas and traced to 3 real-GPS-triggering
tourist actions.

**BUGS FIXED:** B1 fixed in all 3 locales. The demo-data issue was corrected twice (initial restore,
then again after it reproduced live mid-phase during the Karan Mehta scenario restoration) — all 5
affected `tourist_locations` rows and 2 affected `sos_events` rows now consistent with each persona's
intended story, confirmed with the user before each write.

**REGRESSION RESULTS:** `tsc -b` clean on `frontend/tourist` and `frontend/guardian`. No backend
changes this phase.

**DOCUMENTATION:** This file.

**COMMIT:** See repository log for the commit accompanying this phase.

**REMAINING ISSUES:** None P0/P1. Guardian-token renewal is a real product gap, not fixed (out of
scope) — only the false claim about it was corrected. 3 stray `PLANNED` trips on Karan Mehta's
account are harmless clutter, not urgent.

**NEXT PHASE:** Phase 6 — Rescuer App.
