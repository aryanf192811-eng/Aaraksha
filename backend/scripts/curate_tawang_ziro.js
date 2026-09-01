'use strict'
// Data curation script — adds intra-state typical_routes for:
//   Arunachal Pradesh: Tawang <-> Ziro Valley
//
// These two destinations are already in the DB and are ILP_REQUIRED. The
// journey between them is long and multi-day, passing through the plains
// of Assam. Without a typical_routes entry, the planner falls back to a 
// haversine (straight-line) guess which is wildly inaccurate for Arunachal.
//
// Sources:
//   - Distance: ~530 km. Verifiable via OpenStreetMap routing (Tawang ->
//     Bhalukpong -> Tezpur -> North Lakhimpur -> Ziro).
//   - Travel time: 15-18 hours of driving time (typically broken over 2 days
//     with a stopover in Bomdila or Tezpur). Using 1080 mins (18 hours) as
//     a realistic conservative driving time.
//   - Mode & Cost: Direct public transport is largely absent between these two 
//     distinct circuits (Western vs Lower Subansiri). Private taxi is the 
//     standard mode for direct transit. Daily taxi hire is Rs 4000-6000 
//     (cross-checked across aggregators and field reports). For a 2-3 day 
//     one-way journey, Rs 12000 - 15000 is a standard estimate.
//
// Run from backend/ with:
//   node scripts/curate_tawang_ziro.js

const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const ARUNACHAL_SOURCE = [
  'Distance ~530km verifiable via OpenStreetMap (routing via Bhalukpong, Tezpur, North Lakhimpur).',
  'No direct public transport connects these separate circuits; Private Taxi is standard.',
  'Driving time 15-18h (often split over 2 days). Using 1080 mins (18h) as driving time.',
  'Cost Rs 12000-15000 based on standard Rs 4000-6000/day hill taxi rates for a 2.5 day transit.',
].join(' ')

;(async () => {
  const { rows } = await pool.query(
    "SELECT id, name, state FROM destinations WHERE name IN ('Tawang', 'Ziro Valley')"
  )
  const byName = Object.fromEntries(rows.map(r => [r.name, r.id]))
  console.log('IDs found:', JSON.stringify(Object.keys(byName)))

  const missing = ['Tawang', 'Ziro Valley'].filter(n => !byName[n])
  if (missing.length) {
    console.error('Missing destination IDs:', missing)
    await pool.end()
    process.exit(1)
  }

  // Check for existing routes (idempotency)
  const existing = await pool.query(
    'SELECT from_destination_id, to_destination_id FROM typical_routes WHERE from_destination_id IN ($1,$2) AND to_destination_id IN ($1,$2)',
    [byName['Tawang'], byName['Ziro Valley']]
  )
  if (existing.rows.length > 0) {
    console.log('Routes already exist for these destinations, skipping.')
    await pool.end()
    return
  }

  // Tawang -> Ziro Valley
  const r1 = await pool.query(
    `INSERT INTO typical_routes
       (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
     VALUES ($1,$2,'PRIVATE_TAXI',1080,12000,15000,
       'Private taxi hire is required for direct transit between Tawang and Ziro. The ~530km journey takes 15-18 hours of driving and is typically split over 2 days with a night halt in Tezpur or Bomdila.',
       $3)
     RETURNING id`,
    [byName['Tawang'], byName['Ziro Valley'], ARUNACHAL_SOURCE]
  )
  console.log('Inserted Tawang->Ziro Valley:', r1.rows[0].id)

  // Ziro Valley -> Tawang (return)
  const r2 = await pool.query(
    `INSERT INTO typical_routes
       (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
     VALUES ($1,$2,'PRIVATE_TAXI',1080,12000,15000,
       'Return leg. Private taxi from Ziro back to Tawang via Assam plains. Same estimated multi-day driving time and fare.',
       $3)
     RETURNING id`,
    [byName['Ziro Valley'], byName['Tawang'], ARUNACHAL_SOURCE]
  )
  console.log('Inserted Ziro Valley->Tawang:', r2.rows[0].id)

  const all = await pool.query(
    `SELECT d1.name AS from_name, d2.name AS to_name, tr.mode, tr.duration_minutes, tr.cost_min_inr, tr.cost_max_inr
     FROM typical_routes tr
     JOIN destinations d1 ON tr.from_destination_id = d1.id
     JOIN destinations d2 ON tr.to_destination_id = d2.id
     WHERE d1.state = 'Arunachal Pradesh'`
  )
  console.log('\\nArunachal Pradesh typical_routes:')
  all.rows.forEach(r => {
    console.log(` ${r.from_name} -> ${r.to_name}: ${r.mode}, ${r.duration_minutes}min, Rs${r.cost_min_inr}-${r.cost_max_inr}`)
  })

  await pool.end()
  console.log('Done.')
})()
