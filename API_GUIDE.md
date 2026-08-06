# API Guide — Aaraksha

> Read this before writing any route, controller, or making HTTP calls from the frontend.

---

## HTTP METHOD CONVENTIONS

Use the correct verb. Claude occasionally mixes POST/PUT/PATCH — this section is authoritative.

| Method | Meaning | Idempotent | Body? | Example |
|--------|---------|------------|-------|---------|
| `GET` | Retrieve resource(s) | Yes | No | `GET /api/trips` |
| `POST` | Create a new resource | No | Yes | `POST /api/sos` |
| `PUT` | Replace an entire resource | Yes | Yes | `PUT /api/trips/:id` |
| `PATCH` | Partial update (one or few fields) | Yes | Yes | `PATCH /api/sos/:id/status` |
| `DELETE` | Remove a resource | Yes | Rare | `DELETE /api/trips/:id` |

**Rules:**
- Never use `POST` to update. Use `PATCH` for partial, `PUT` for full replacement.
- Never use `GET` with a request body.
- `DELETE` should return `204 No Content` with no body, or `200` with a confirmation object.
- Prefer `PATCH` over `PUT` unless you are replacing the entire resource.

---

## URL STRUCTURE

```
/api/{resource}           ← collection
/api/{resource}/:id       ← single item
/api/{resource}/:id/{sub} ← sub-resource
```

**Examples:**
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/trips                     ← tourist's trips
POST   /api/trips                     ← create trip
GET    /api/trips/:id                 ← single trip
PATCH  /api/trips/:id                 ← update trip fields
DELETE /api/trips/:id
POST   /api/sos                       ← trigger SOS
PATCH  /api/sos/:id/resolve           ← resolve SOS
PATCH  /api/sos/:id/false-alarm       ← mark false alarm
GET    /api/govt/sos                  ← all active SOS (govt only)
POST   /api/govt/rescue-assignments   ← assign rescue team
GET    /api/guardian/:token           ← guardian tracking (no auth)
```

---

## STANDARD HTTP STATUS CODES

Use exactly these codes. No creative HTTP statuses.

| Code | Meaning | When to use |
|------|---------|-------------|
| `200` | OK | Successful GET, PATCH, PUT, DELETE with body |
| `201` | Created | Successful POST that created a resource |
| `204` | No Content | Successful DELETE with no response body |
| `400` | Bad Request | Validation failed, malformed input |
| `401` | Unauthorized | Missing or invalid JWT |
| `403` | Forbidden | Valid JWT but insufficient role/permissions |
| `404` | Not Found | Resource doesn't exist or isn't accessible by this user |
| `409` | Conflict | Duplicate resource (e.g., phone already registered) |
| `422` | Unprocessable Entity | Input is well-formed but semantically invalid |
| `429` | Too Many Requests | Rate limiter triggered |
| `500` | Internal Server Error | Unhandled exception — caught by errorHandler |

**Never use:** 202, 301, 418, or any other codes not in this list without explicit justification.

---

## RESPONSE WRAPPER

All responses go through `utils/response.js`. Never call `res.json()` directly.

```js
// utils/response.js — these are the only three functions
sendSuccess(res, data, message = 'Success', statusCode = 200)
sendError(res, message, statusCode = 500, errors = null)
sendPaginated(res, rows, total, page, limit, message = 'Success')
```

**Shapes:**
```json
// sendSuccess
{
  "success": true,
  "message": "SOS triggered",
  "data": { ... }
}

// sendError
{
  "success": false,
  "message": "Tourist not found",
  "errors": null
}

// sendPaginated
{
  "success": true,
  "message": "Trips retrieved",
  "data": [ ... ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

## ROUTE FILE TEMPLATE

Every route file follows this exact pattern:

```js
// backend/src/routes/sos.routes.js
import express from 'express'
import { authenticateTourist } from '../middleware/auth.js'
import * as sosController from '../controllers/sos.controller.js'
import { sendSuccess } from '../utils/response.js'

const router = express.Router()

router.post('/', authenticateTourist, async (req, res, next) => {
  try {
    const result = await sosController.createSOS(req)
    sendSuccess(res, result, 'SOS triggered', 201)
  } catch (err) {
    next(err) // errorHandler.js handles all errors
  }
})

router.patch('/:id/resolve', authenticateTourist, async (req, res, next) => {
  try {
    const result = await sosController.resolveSOS(req)
    sendSuccess(res, result, 'SOS resolved')
  } catch (err) {
    next(err)
  }
})

export default router
```

---

## CONTROLLER TEMPLATE

```js
// backend/src/controllers/sos.controller.js
import { pool } from '../database/pool.js'
import { logger } from '../utils/logger.js'
import { sendError } from '../utils/response.js'
import { emitSOSReceived } from '../socket/index.js'
import { notificationService } from '../services/notification.service.js'

export const createSOS = async (req) => {
  const { category, latitude, longitude, message, tripId } = req.body
  const touristId = req.tourist.id

  // 1. Validate
  if (!category || !latitude || !longitude) {
    const err = new Error('category, latitude, longitude are required')
    err.statusCode = 400
    throw err
  }

  // 2. Persist
  const { rows } = await pool.query(
    `INSERT INTO sos_events (tourist_id, trip_id, latitude, longitude, category, trigger_type, status)
     VALUES ($1, $2, $3, $4, $5, 'MANUAL', 'ACTIVE')
     RETURNING id, tourist_id, trip_id, latitude, longitude, category, status, created_at`,
    [touristId, tripId, latitude, longitude, category]
  )
  const sos = rows[0]

  // 3. Side effects (never let these fail the response)
  try {
    await notificationService.sendSMS(req.tourist.phone, `SOS received: ${category}`)
  } catch (smsErr) {
    logger.error({ smsErr, touristId }, 'SMS failed — SOS continues')
  }

  emitSOSReceived({ sos, tourist: req.tourist })

  logger.info({ sosId: sos.id, touristId, category }, 'SOS created')
  return sos
}
```

---

## INPUT VALIDATION RULES

- Validate in the **controller**, not in the route or service layer
- Check all required fields before any DB query
- Throw an Error with `err.statusCode` set — errorHandler will pick it up
- For numeric values, validate range (e.g., latitude ∈ [-90, 90])
- For enums (category, status), validate against an allowed list

```js
// Validation helper pattern
const VALID_CATEGORIES = ['MEDICAL', 'LOST', 'TRAPPED', 'DISASTER', 'OTHER']

if (!VALID_CATEGORIES.includes(category)) {
  const err = new Error(`category must be one of: ${VALID_CATEGORIES.join(', ')}`)
  err.statusCode = 400
  throw err
}
```

---

## AUTHENTICATION HEADERS

```
Authorization: Bearer <jwt_token>
```

- Tourist endpoints: use `authenticateTourist` middleware
- Govt endpoints: use `authenticateGovt` middleware
- Guardian endpoint: no auth (token is in the URL path)
- Both middlewares attach the user object to `req.tourist` or `req.govt`

---

## FRONTEND API LAYER PATTERN

```ts
// src/api/client.ts — single axios instance
import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
```

```ts
// src/api/sos.api.ts — domain API file
import api from './client'
import type { SOSPayload, SOSResponse } from '@/types/sos.types'

export const triggerSOS   = (payload: SOSPayload) => api.post<SOSResponse>('/sos', payload)
export const resolveSOS   = (id: string)           => api.patch(`/sos/${id}/resolve`)
export const falseAlarmSOS = (id: string)          => api.patch(`/sos/${id}/false-alarm`)
```

```tsx
// In a component — always via TanStack Query mutation
const { mutate: sendSOS, isPending } = useMutation({
  mutationFn: sosApi.triggerSOS,
  onSuccess: () => toast.success('SOS sent'),
  onError: (err) => toast.error('SOS failed — switching to offline mode'),
})
```

**Rule:** API calls are never made inside React components directly. Always through `src/api/{domain}.api.ts`.
