# AARAKSHA — Smart Tourism · Safe Journey
> SIH 2025 · Travel & Tourism · Internal Hackathon  
> Three portals: Tourist PWA · Guardian Portal · Government Command Center

---

## READ THIS FIRST (every session)

You are working on Aaraksha. Before writing any code:
1. Identify which portal and which module the task belongs to
2. Read the relevant existing file with `@file` before editing it
3. Ask only when the requested task conflicts with the architecture or lacks essential information
4. Do the task. Return what changed and what needs wiring next.

> Reference docs before starting any significant work:
> - Architecture, stack, security, naming → [`Architecture.md`](./Architecture.md)
> - HTTP verbs, error codes, response patterns → [`API_GUIDE.md`](./API_GUIDE.md)
> - Tables, relationships, query rules → [`DB_GUIDE.md`](./DB_GUIDE.md)
> - Design tokens, components, state, offline → [`UI_GUIDE.md`](./UI_GUIDE.md)

---

## PRODUCT CONTEXT

Aaraksha solves tourist safety in Northeast India. Three pillars:
- **Planning:** itinerary, budget, smart packing (Gemini AI), notes
- **Safety:** SOS, Dead Man's Switch (DMS), smart check-ins, Travel Safety Index (TSI)
- **Government:** live ops map, rescue assignment, district risk overview, analytics

**Key terms:**
- `TSI` = Travel Safety Index (0–100, rule-based JS, updated hourly via OWM)
- `DMS` = Dead Man's Switch (node-cron checks every minute, auto-fires SOS on timeout)
- `Guardian Portal` = family/friend tracking page, token in URL, no auth needed
- `Govt Command Center` = ops dashboard for authorities, dark slate theme
- `Offline SOS` = GPS satellite coords (no internet) + SMS URI → Twilio INBOUND webhook

---

## BUILD SESSION TRACKER

Update before each session.

```
CURRENT SESSION: [ ]
COMPLETED:       [ ]
NEXT UP:         [ ]
BLOCKERS:        [ ]
```

**Session roadmap:**
1. Backend foundation (Express + pg + JWT + Socket.IO + 13-table schema)
2. Auth + Tourist profile APIs (Govt ID hash, guardian token)
3. Trip + Itinerary APIs + TSI engine (rule-based score)
4. Safety Engine (SOS + DMS + check-ins + escalation)
5. Offline SOS (Twilio INBOUND webhook + structured SMS parser)
6. Weather cron + dynamic TSI updates (node-cron + OWM)
7. Government Command Center APIs (risk overview + rescue + analytics)
8. Tourist PWA frontend (12 screens)
9. Government Command Center frontend (dark ops dashboard + Leaflet)
10. Guardian Portal + Digital Journey Passport (PDFKit, 9 sections)
11. Seed data + PWA service worker + demo prep

---

## DEFINITION OF DONE

A feature is **complete** only when ALL of the following are true:

| # | Criterion | Notes |
|---|-----------|-------|
| 1 | ✅ API implemented | Route → Controller → Service |
| 2 | ✅ SQL complete | Parameterized, named columns, no SELECT * |
| 3 | ✅ Input validation | Schema-level + controller-level |
| 4 | ✅ Error handling | try/catch → next(err) → errorHandler |
| 5 | ✅ TypeScript types | Interfaces/types in `src/types/` |
| 6 | ✅ Postman tested | Happy path + at least 2 error cases |
| 7 | ✅ Loading state | Skeleton or spinner in UI |
| 8 | ✅ Empty state | Meaningful message, not a blank screen |
| 9 | ✅ Responsive | Mobile-first (tourist), desktop-first (govt) |
| 10 | ✅ Offline tested | IndexedDB sync verified (tourist portal only) |
| 11 | ✅ Logged | pino info on success, pino error on failure |

Do **not** mark a session as complete if any row above is unchecked.

---

## TESTING STRATEGY

| Layer | Tool | When |
|-------|------|------|
| Backend routes | Postman collection | After every controller is written |
| Integration | Postman runner (full flow) | After each session |
| E2E (demo) | Playwright | Session 11 (demo prep) |
| Manual regression | Checklist in session notes | Before each demo/presentation |
| Offline SOS | Real device + airplane mode | Session 5 + Session 11 |

Generate Postman collection entries alongside every new route. Export to `backend/postman/`.

---

## TOKEN EFFICIENCY — THE 5 RULES

**Rule 1 — Reference, don't paste.**  
Bad: `Here is my sos.routes.js: [200 lines]`  
Good: `Update @backend/src/routes/sos.routes.js — add POST /api/sos/false-alarm`

**Rule 2 — Batch related changes.**  
Bad: Four separate messages for route / controller / service / socket.  
Good: `Implement full SOS false-alarm flow: @routes/sos, @controllers/sos, emit SOS_CANCELLED in @socket/index.js`

**Rule 3 — /clear between sessions, not within.**  
Use `/clear` only when moving to a completely unrelated module.

**Rule 4 — Sonnet for routine, Opus for hard problems.**  
Switch to Opus for: TSI algorithm, Socket.IO room design, DMS timing, complex joins, system-level decisions.  
Switch back to Sonnet immediately after.

**Rule 5 — Start every session by loading context.**
```
Read CLAUDE.md + Architecture.md. Current session: [N — goal]. Start with @backend/src/[file].
```

---

## ENVIRONMENT VARIABLES

```bash
# backend/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/aaraksha
JWT_SECRET=your-secret-min-32-chars
PORT=5000
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
TWILIO_EMERGENCY_NUMBER=+91xxxxxxxxxx
GEMINI_API_KEY=AIzaSy...
OWM_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:5173

# frontend/tourist/.env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000

# frontend/govt/.env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## ONE-SHOT SESSION 1 PROMPT

```
Read CLAUDE.md + Architecture.md + DB_GUIDE.md carefully.

This is Session 1 — Backend Foundation. Set up the complete backend:

1. Initialize Node.js project in backend/ with these exact dependencies:
   express pg dotenv bcryptjs jsonwebtoken socket.io node-cron twilio
   @google/generative-ai pdfkit multer pino pino-pretty uuid

2. Create the full directory structure from Architecture.md exactly as specified

3. Create all foundation files:
   - backend/src/app.js        (Express setup, CORS, JSON body parser, route stubs, errorHandler)
   - backend/src/server.js     (HTTP server + Socket.IO init with JWT auth for govt room)
   - backend/database/pool.js  (pg Pool from DATABASE_URL)
   - backend/utils/response.js (sendSuccess, sendError, sendPaginated)
   - backend/utils/logger.js   (pino instance — export as logger)
   - backend/middleware/auth.js (authenticateTourist + authenticateGovt)
   - backend/middleware/errorHandler.js (global Express error handler)
   - backend/socket/index.js   (initSocket, all 6 event emitters)
   - backend/sql/schema.sql    (full 13-table schema from DB_GUIDE.md)
   - backend/.env.example
   - backend/.gitignore

4. After creating files run:
   npm install
   psql $DATABASE_URL < sql/schema.sql
   node -e "require('./src/app.js'); console.log('App loads cleanly')"

Report: files created, any dependency issues, confirm GET /health returns {status:'ok'}.
```
## Git Rules

- Never change git user.name or user.email.
- Always use the repository's existing Git identity.
- Do not create commits unless explicitly asked.
- When committing, use conventional commit messages:
  feat:
  fix:
  refactor:
  docs:
  chore: