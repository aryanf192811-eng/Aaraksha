// scripts/seedAnalyticsHistory.js
// Populates a realistic 30-day history of RESOLVED sos_events so the govt
// Analytics dashboard (SOS Incidents Over Time, Emergency Types, avg
// response) has enough volume to render meaningfully. Direct SQL insert —
// same pattern seed.js already uses for its "DEMO RESOLVED SOS" row —
// deliberately bypassing the live sos.service trigger path so these
// backdated historical rows don't fire real push notifications or socket
// events for something that "happened" weeks ago.
'use strict'

require('dotenv').config()
const { getPool } = require('../src/database/pool')

// Weighted so MEDICAL dominates and CRIME/DISASTER stay rare — matches
// real-world incident distribution better than a flat random pick.
const CATEGORY_WEIGHTS = [
  ['MEDICAL', 8], ['LOST', 5], ['TRAPPED', 4], ['OTHER', 3],
  ['MISSING', 2], ['DISASTER', 1], ['CRIME', 1],
]
const CATEGORY_POOL = CATEGORY_WEIGHTS.flatMap(([cat, w]) => Array(w).fill(cat))

const MESSAGES = {
  MEDICAL: ['Twisted ankle on the trail, need assistance walking back.', 'Altitude sickness — dizziness and nausea.', 'Minor cut needing first aid.'],
  LOST: ['Took a wrong turn off the marked trail.', 'Separated from the group in fog.'],
  TRAPPED: ['Stuck on a narrow ledge, can\'t safely climb down.', 'Vehicle stuck in mud on the approach road.'],
  OTHER: ['Ran out of drinking water.', 'Guide is unreachable, unsure how to proceed.'],
  MISSING: ['Travel companion has not returned to camp as planned.'],
  DISASTER: ['Landslide blocked the return path after heavy rain.'],
  CRIME: ['Reported attempted theft near the parking area.'],
}
const RESOLUTIONS = [
  'Local guide reached the tourist, resolved on-site — no rescue team dispatch needed.',
  'Tourist self-resolved after regaining phone signal, confirmed safe by follow-up call.',
  'Nearby rescue team reached the location, assisted, and confirmed tourist safe.',
  'Resolved after contact — false alarm, tourist was safe and had simply lost signal.',
]

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randomBetween(min, max) { return min + Math.random() * (max - min) }

async function seedAnalyticsHistory() {
  const pool = getPool()

  const { rows: tourists } = await pool.query(`
    SELECT t.id, t.full_name, tr.id as trip_id, tr.stops
    FROM tourists t
    JOIN trips tr ON tr.tourist_id = t.id
    WHERE tr.stops IS NOT NULL AND tr.stops::text != '[]'
  `)
  if (tourists.length === 0) throw new Error('No tourists with stops found — run scripts/seed.js first')

  const COUNT = 22
  let inserted = 0

  for (let i = 0; i < COUNT; i++) {
    const person = pick(tourists)
    const stops = Array.isArray(person.stops) ? person.stops : JSON.parse(person.stops || '[]')
    const stop = stops[0]
    if (!stop?.city) continue

    const category = pick(CATEGORY_POOL)
    const daysAgo = randomBetween(0.5, 29.5)
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    const responseMinutes = randomBetween(12, 75)
    const resolvedAt = new Date(createdAt.getTime() + responseMinutes * 60 * 1000)

    // Small jitter around the destination's approximate coords keeps pins
    // from stacking exactly on top of each other on any future map view.
    const lat = parseFloat(stop.lat ?? 26.2) + randomBetween(-0.05, 0.05)
    const lng = parseFloat(stop.lng ?? 92.9) + randomBetween(-0.05, 0.05)

    await pool.query(
      `INSERT INTO sos_events (tourist_id, trip_id, latitude, longitude, category, trigger_type, status,
        battery_pct, message, resolved_at, resolution_notes, created_at)
       VALUES ($1,$2,$3,$4,$5,'MANUAL','RESOLVED',$6,$7,$8,$9,$10)`,
      [
        person.id, person.trip_id, lat, lng, category,
        Math.round(randomBetween(15, 95)),
        pick(MESSAGES[category]),
        resolvedAt,
        pick(RESOLUTIONS),
        createdAt,
      ]
    )
    inserted++
  }

  console.log(`Seeded ${inserted} historical resolved SOS events across the last 30 days`)
}

seedAnalyticsHistory()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1) })
