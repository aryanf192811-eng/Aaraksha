# Aaraksha — Testing Documentation

Index for the final system-wide QA, integration, security, and UX validation pass ahead of the
SIH screening round. Full plan: [`QA-MASTER-PLAN.md`](./QA-MASTER-PLAN.md).

**Rule this index exists to enforce:** everything actively being tested lives here, in
`docs/testing/`. General research and strategy docs live in `docs/Research/`. Current portal
screenshots live in `docs/screenshots/`. Don't mix the three.

## Phase reports

| # | Phase | Report | Status |
|---|---|---|---|
| 1 | System audit | [`01-system-audit.md`](./01-system-audit.md) | PASS WITH ISSUES |
| 2 | Backend/API/DB | [`02-backend-api-db.md`](./02-backend-api-db.md) | PASS WITH ISSUES |
| 3 | Tourist PWA | [`03-tourist-pwa.md`](./03-tourist-pwa.md) | PASS WITH ISSUES |
| 4 | Government Command Center | [`04-government-portal.md`](./04-government-portal.md) | PASS WITH ISSUES |
| 5 | Guardian Portal | [`05-guardian-portal.md`](./05-guardian-portal.md) | PASS WITH ISSUES |
| 6 | Rescuer App | [`06-rescuer-app.md`](./06-rescuer-app.md) | PASS WITH ISSUES |
| 7 | Cross-portal E2E | [`07-cross-portal-e2e.md`](./07-cross-portal-e2e.md) | PASS WITH ISSUES |
| 8 | Offline/resilience | `08-offline-resilience.md` | not started |
| 9 | Security audit | `09-security-audit.md` | not started |
| 10 | Real-time consistency | `10-realtime-validation.md` | not started |
| 11 | UI/UX QA | `11-ui-ux-qa.md` | not started |
| 12 | Regression report | `12-regression-report.md` | not started |
| — | Final QA report | `FINAL_QA_REPORT.md` | not started |

## Other testing artifacts in this repo

- [`aaraksha-field-manual.html`](./aaraksha-field-manual.html) — tester-facing playbook: how to run
  a QA pass on each portal, shared-environment ground rules, and what's expected to run in fallback
  mode (not a bug list).
- `backend/tests/` — Vitest unit + integration suite.
- `backend/postman/` — Postman/Newman API contract collection.
- `.github/workflows/test.yml` — CI: backend suite against an ephemeral Postgres, frontend suite
  matrixed across all four portals.

## Databases

| DB | Env var | Purpose |
|---|---|---|
| `aaraksha` | `DATABASE_URL` | SIH demo/presentation database — **never reset, never bulk-mutate** |
| `aaraksha_test` | `DATABASE_TEST_URL` | Disposable — reset/migrate/seed freely for testing |

Full rule set in [`QA-MASTER-PLAN.md`](./QA-MASTER-PLAN.md) §0.
