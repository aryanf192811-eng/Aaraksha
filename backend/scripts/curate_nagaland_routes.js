'use strict'
// Data curation script — adds intra-state typical_routes for:
//   Nagaland: Dzukou Valley <-> Longwa Village
//
// These two destinations are already in the DB and are ILP_REQUIRED.
// The journey spans the length of Nagaland (South to North).
//
// Sources:
//   - Distance: ~420 km verifiable via OpenStreetMap (Dzukou access via Zakhama/
//     Viswema -> Kohima -> Dimapur -> Assam plains via Jorhat/Sonari -> Mon -> Longwa).
//     Internal Nagaland roads (via Mokokchung) exist but are slower; Assam transit
//     is standard for this route.
//   - Travel time: 14-16 hours of driving time. Usually broken over 2 days. 
//     Using 960 mins (16h) as a realistic estimate.
//   - Mode & Cost: Shared Sumo (Tata Sumo) is the standard transport lifeline 
//     in Nagaland. A multi-leg shared Sumo journey (Kohima-Dimapur-Mon-Longwa)
//     costs roughly Rs 1500-2500 per seat. Private taxis run Rs 15,000+.
//     Using SHARED_TAXI as the mode.
//
// Run from backend/ with:
//   node scripts/curate_nagaland_routes.js

const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const NAGALAND_SOURCE = [
  'Distance ~420km verifiable via OpenStreetMap (Zakhama/Viswema -> Kohima -> Dimapur -> Sonari -> Mon -> Longwa).',
  'Shared Sumo is the standard Nagaland transport mode. Multi-leg journey required.',
  'Driving time 14-16h (often split over 2 days, transiting via Assam plains). Using 960 mins (16h).',
  'Cost Rs 1500-2500 based on standard shared Sumo fares across these distances in NE India.',
].join(' ')

;(async () => {
  const { rows } = await pool.query(
    "SELECT id, name, state FROM destinations WHERE name IN ('Dzukou Valley', 'Longwa Village')"
  )
  const byName = Object.fromEntries(rows.map(r => [r.name, r.id]))
  console.log('IDs found:', JSON.stringify(Object.keys(byName)))

  const missing = ['Dzukou Valley', 'Longwa Village'].filter(n => !byName[n])
  if (missing.length) {
    console.error('Missing destination IDs:', missing)
    await pool.end()
    process.exit(1)
  }

  // Check for existing routes (idempotency)
  const existing = await pool.query(
    'SELECT from_destination_id, to_destination_id FROM typical_routes WHERE from_destination_id IN ($1,$2) AND to_destination_id IN ($1,$2)',
    [byName['Dzukou Valley'], byName['Longwa Village']]
  )
  if (existing.rows.length > 0) {
    console.log('Routes already exist for these destinations, skipping.')
    await pool.end()
    return
  }

  // Dzukou Valley -> Longwa Village
  const r1 = await pool.query(
    `INSERT INTO typical_routes
       (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
     VALUES ($1,$2,'SHARED_TAXI',960,1500,2500,
       'Multi-leg shared Sumo journey. From Dzukou base (Zakhama/Viswema) to Kohima, then Dimapur, through Assam plains (Sonari), up to Mon town, and finally to Longwa. The ~420km journey takes 14-16 hours driving and is typically split over 2 days.',
       $3)
     RETURNING id`,
    [byName['Dzukou Valley'], byName['Longwa Village'], NAGALAND_SOURCE]
  )
  console.log('Inserted Dzukou Valley->Longwa Village:', r1.rows[0].id)

  // Longwa Village -> Dzukou Valley (return)
  const r2 = await pool.query(
    `INSERT INTO typical_routes
       (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
     VALUES ($1,$2,'SHARED_TAXI',960,1500,2500,
       'Return leg. Shared Sumo hops from Longwa back to Mon, through Assam to Dimapur/Kohima. Same estimated multi-day driving time and fare.',
       $3)
     RETURNING id`,
    [byName['Longwa Village'], byName['Dzukou Valley'], NAGALAND_SOURCE]
  )
  console.log('Inserted Longwa Village->Dzukou Valley:', r2.rows[0].id)

  const all = await pool.query(
    `SELECT d1.name AS from_name, d2.name AS to_name, tr.mode, tr.duration_minutes, tr.cost_min_inr, tr.cost_max_inr
     FROM typical_routes tr
     JOIN destinations d1 ON tr.from_destination_id = d1.id
     JOIN destinations d2 ON tr.to_destination_id = d2.id
     WHERE d1.state = 'Nagaland'`
  )
  console.log('\\nNagaland typical_routes:')
  all.rows.forEach(r => {
    console.log(` ${r.from_name} -> ${r.to_name}: ${r.mode}, ${r.duration_minutes}min, Rs${r.cost_min_inr}-${r.cost_max_inr}`)
  })

  await pool.end()
  console.log('Done.')
})()
