# Database Guide — Aaraksha

> Read this before writing any SQL query, migration, or schema change.

---

## GOLDEN RULES

```js
// 1. Always parameterized — NEVER string concatenation for values
const { rows } = await pool.query(
  `SELECT id, full_name, phone FROM tourists WHERE id = $1`,
  [touristId]
)

// 2. Always name columns — NEVER SELECT *
// WRONG:  SELECT * FROM trips
// CORRECT: SELECT id, tourist_id, tsi_score, tsi_label, status FROM trips

// 3. Always check rows.length before accessing rows[0]
if (rows.length === 0) {
  const err = new Error('Tourist not found')
  err.statusCode = 404
  throw err
}

// 4. Use transactions for multi-table writes
const client = await pool.connect()
try {
  await client.query('BEGIN')
  // ... multiple queries
  await client.query('COMMIT')
} catch (err) {
  await client.query('ROLLBACK')
  throw err
} finally {
  client.release()
}
```

---

## TABLE REFERENCE

> **This section is stale and does not reflect the live schema.** It documents an early 13-table
> design; the actual database (both `aaraksha` and `aaraksha_test`) has grown to 24 domain tables
> across 19 migrations (`backend/src/migrations/001_initial_schema.js` through
> `019_vadodara_rescue_team.js`) — including `volunteers`, `checkpoint_scans`,
> `destination_news`, `destination_reviews`, `incident_reports`, `safety_anomalies`,
> `otp_verifications`, `push_subscriptions`, and `trip_members`, none of which appear below.
> **Treat the migrations directory as the authoritative source for exact table/column names and
> types** — the golden rules above (parameterized queries, named columns, transactions) remain
> accurate and in force; only this specific table list has drifted. Kept below for the general
> shape/relationship intuition it still conveys, not as a column-accurate reference. (Flagged in
> `docs/testing/01-system-audit.md`'s Phase 1 finding D6, addressed here in the final QA pass.)

### `tourists`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | gen_random_uuid() |
| full_name | TEXT | |
| phone | TEXT UNIQUE | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | bcrypt |
| blood_group | TEXT | |
| emergency_contact_name | TEXT | |
| emergency_contact_phone | TEXT | |
| govt_id_type | TEXT | AADHAAR / PASSPORT / VOTER_ID |
| govt_id_hash | TEXT | SHA-256 of full ID |
| govt_id_suffix | CHAR(4) | Last 4 digits only |
| guardian_token | UUID | Public tracking token |
| rescue_readiness_score | INT | 0–100 |
| is_active | BOOLEAN | Default true |
| created_at | TIMESTAMPTZ | |

### `trips`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tourist_id | UUID FK | → tourists.id |
| title | TEXT | |
| start_date | DATE | |
| end_date | DATE | |
| travel_type | TEXT | SOLO / GROUP / FAMILY / ADVENTURE |
| status | TEXT | PLANNED / ACTIVE / COMPLETED / CANCELLED |
| tsi_score | INT | 0–100 |
| tsi_label | TEXT | |
| tsi_factors | JSONB | |
| tsi_updated_at | TIMESTAMPTZ | |
| rescue_readiness | JSONB | |

### `sos_events`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tourist_id | UUID FK | → tourists.id |
| trip_id | UUID FK | → trips.id (nullable) |
| latitude | NUMERIC(10,7) | |
| longitude | NUMERIC(10,7) | |
| category | TEXT | MEDICAL / LOST / TRAPPED / DISASTER / OTHER |
| trigger_type | TEXT | MANUAL / DMS / INBOUND_SMS |
| status | TEXT | ACTIVE / RESOLVED / FALSE_ALARM |
| message | TEXT | |
| resolved_at | TIMESTAMPTZ | |
| resolved_by | UUID FK | → govt_users.id |

### `dead_mans_switches`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tourist_id | UUID FK | → tourists.id |
| trip_id | UUID FK | → trips.id |
| interval_minutes | INT | Tourist-configured |
| last_checkin_at | TIMESTAMPTZ | Reset on each check-in |
| next_trigger_at | TIMESTAMPTZ | Computed: last_checkin_at + interval |
| warning_sent_at | TIMESTAMPTZ | |
| status | TEXT | ACTIVE / TRIGGERED / PAUSED / CANCELLED |

### `checkins`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tourist_id | UUID FK | → tourists.id |
| trip_id | UUID FK | → trips.id |
| dms_id | UUID FK | → dead_mans_switches.id (nullable) |
| latitude | NUMERIC(10,7) | |
| longitude | NUMERIC(10,7) | |
| battery_pct | INT | 0–100 |
| note | TEXT | |
| created_at | TIMESTAMPTZ | |

### `tourist_locations`
| Column | Type | Notes |
|--------|------|-------|
| tourist_id | UUID PK | → tourists.id (upsert table) |
| latitude | NUMERIC(10,7) | |
| longitude | NUMERIC(10,7) | |
| battery_pct | INT | |
| updated_at | TIMESTAMPTZ | |

### `govt_users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | |
| full_name | TEXT | |
| role | TEXT | ADMIN / DISTRICT_OFFICER / RESCUE_COORDINATOR |
| district | TEXT | |
| state | TEXT | |
| is_active | BOOLEAN | |

### `rescue_teams`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT | |
| type | TEXT | POLICE / MEDICAL / FOREST / NDRF |
| district | TEXT | |
| contact_phone | TEXT | |
| status | TEXT | AVAILABLE / DISPATCHED / UNAVAILABLE |
| latitude | NUMERIC(10,7) | |
| longitude | NUMERIC(10,7) | |

### `rescue_assignments`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| sos_event_id | UUID FK | → sos_events.id |
| team_id | UUID FK | → rescue_teams.id |
| assigned_by | UUID FK | → govt_users.id |
| status | TEXT | ASSIGNED / EN_ROUTE / COMPLETED |
| assigned_at | TIMESTAMPTZ | |

### `destinations`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT | |
| state | TEXT | |
| district | TEXT | |
| connectivity | TEXT | GOOD / POOR / NONE |
| difficulty | TEXT | EASY / MODERATE / HARD / EXTREME |
| altitude_m | INT | |
| zone_type | TEXT | URBAN / RURAL / REMOTE / FOREST |
| hospital_name | TEXT | |
| hospital_km | NUMERIC(6,2) | |
| latitude | NUMERIC(10,7) | |
| longitude | NUMERIC(10,7) | |

### `weather_cache`
| Column | Type | Notes |
|--------|------|-------|
| destination_id | UUID PK | → destinations.id |
| condition | TEXT | clear / clouds / rain / snow / thunderstorm |
| temp_celsius | NUMERIC(5,2) | |
| risk_level | TEXT | LOW / MODERATE / HIGH / EXTREME |
| risk_reason | TEXT | |
| fetched_at | TIMESTAMPTZ | Updated by cron every 60min |

### `scam_reports`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| destination_id | UUID FK | → destinations.id |
| tourist_id | UUID FK | → tourists.id |
| category | TEXT | OVERCHARGING / FAKE_GUIDE / THEFT / OTHER |
| description | TEXT | |
| created_at | TIMESTAMPTZ | |

### `inbound_sos_sms`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| from_phone | TEXT | Twilio inbound `From` number |
| raw_body | TEXT | Full SMS body |
| parsed | JSONB | Extracted fields after parsing |
| sos_event_id | UUID FK | → sos_events.id (set after matching) |
| received_at | TIMESTAMPTZ | |

---

## RELATIONSHIPS

```
tourists
  ├── 1:N → trips
  │         ├── 1:N → checkins
  │         ├── 1:N → sos_events
  │         └── 1:N → dead_mans_switches
  ├── 1:1 → tourist_locations   (upsert, latest position only)
  ├── 1:N → scam_reports
  └── 1:N → checkins

sos_events
  └── 1:N → rescue_assignments
                └── N:1 → rescue_teams

destinations
  ├── 1:1 → weather_cache
  └── 1:N → scam_reports

inbound_sos_sms
  └── N:1 → sos_events   (linked after phone matching)
```

**Key join patterns:**

```sql
-- Tourist + active trip + TSI
SELECT t.id, t.full_name, tr.id AS trip_id, tr.tsi_score, tr.tsi_label
FROM tourists t
JOIN trips tr ON tr.tourist_id = t.id AND tr.status = 'ACTIVE'
WHERE t.id = $1

-- SOS with tourist + destination (for govt dashboard)
SELECT
  se.id, se.category, se.status, se.latitude, se.longitude, se.created_at,
  t.full_name, t.phone, t.blood_group,
  d.name AS destination_name, d.hospital_name, d.hospital_km
FROM sos_events se
JOIN tourists t ON t.id = se.tourist_id
LEFT JOIN trips tr ON tr.id = se.trip_id
LEFT JOIN destinations d ON d.id = tr.destination_id
WHERE se.status = 'ACTIVE'
ORDER BY se.created_at DESC

-- DMS check (cron every 1 min)
SELECT
  dms.id, dms.tourist_id, dms.trip_id, dms.interval_minutes,
  dms.next_trigger_at, dms.warning_sent_at,
  t.phone, t.full_name, t.emergency_contact_phone
FROM dead_mans_switches dms
JOIN tourists t ON t.id = dms.tourist_id
WHERE dms.status = 'ACTIVE'
  AND dms.next_trigger_at <= NOW()
```

---

## UPSERT PATTERN (tourist_locations)

```sql
-- Update live location (called on every check-in)
INSERT INTO tourist_locations (tourist_id, latitude, longitude, battery_pct, updated_at)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (tourist_id)
DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  battery_pct = EXCLUDED.battery_pct,
  updated_at = NOW()
```

---

## GOVT ID HANDLING

Government IDs (Aadhaar, Passport, Voter ID) must **never** be stored in plaintext.

```js
import crypto from 'crypto'

// On registration
const govtIdHash   = crypto.createHash('sha256').update(govtIdFull).digest('hex')
const govtIdSuffix = govtIdFull.slice(-4)   // Last 4 chars only

// Store: govt_id_hash + govt_id_suffix
// Display: "**** **** XXXX" (suffix only)
// Verify: hash incoming ID and compare hashes
```

---

## OFFLINE SMS FORMAT

Inbound SOS SMS must follow this structure (parsed in webhook controller):

```
AARAKSHA_SOS|ID:{tourist_id}|LAT:{lat}|LNG:{lng}|CAT:{category}|BATT:{battery_pct}|TIME:{unix_ts}
```

Parser regex:
```js
const FIELD_RE = /AARAKSHA_SOS\|ID:([^|]+)\|LAT:([^|]+)\|LNG:([^|]+)\|CAT:([^|]+)\|BATT:([^|]+)\|TIME:(\d+)/
const [, id, lat, lng, cat, batt, time] = body.match(FIELD_RE) || []
```
