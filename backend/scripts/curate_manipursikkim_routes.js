'use strict'
// Data curation script — adds intra-state typical_routes for:
//   1. Imphal <-> Loktak Lake (Manipur): ~45km road, 1-1.5h, bus/shared taxi
//   2. Gangtok <-> Pelling (Sikkim): ~115km mountain road, 4.5-5.5h, shared taxi
//
// Run from backend/ with:
//   node scripts/curate_manipursikkim_routes.js

const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const MANIPUR_SOURCE = [
  'Distance ~45km (Imphal to Moirang/Loktak Lake).',
  'Travel time 1-1.5h by road (mostly plains in the valley). Using 75 mins.',
  'Standard state bus and shared taxi service from Imphal to Moirang.',
  'Cost Rs 100-200 for shared public transit on this short valley route.',
].join(' ')

const SIKKIM_SOURCE = [
  'Distance ~115km (Gangtok to Pelling via Ravangla/Legship).',
  'Travel time 4.5-5.5h (mountain roads, frequent traffic/delays). Using 300 mins.',
  'Shared Sumo/Maxx is the standard intercity transport in Sikkim.',
  'Cost Rs 350-500/seat consistent with Sikkim transport norms for this distance.',
].join(' ')

;(async () => {
  const { rows } = await pool.query(
    "SELECT id, name, state FROM destinations WHERE name IN ('Imphal', 'Loktak Lake', 'Gangtok', 'Pelling')"
  )
  const byName = Object.fromEntries(rows.map(r => [r.name, r.id]))
  console.log('IDs found:', JSON.stringify(Object.keys(byName)))

  const missing = ['Imphal', 'Loktak Lake', 'Gangtok', 'Pelling'].filter(n => !byName[n])
  if (missing.length) {
    console.error('Missing destination IDs:', missing)
    await pool.end()
    process.exit(1)
  }

  // Check for existing routes (idempotency)
  const existing = await pool.query(
    'SELECT from_destination_id, to_destination_id FROM typical_routes WHERE from_destination_id IN ($1,$2,$3,$4)',
    [byName['Imphal'], byName['Loktak Lake'], byName['Gangtok'], byName['Pelling']]
  )
  if (existing.rows.length > 0) {
    console.log('Routes already exist for these destinations, skipping.')
    await pool.end()
    return
  }

  // Imphal -> Loktak Lake (Manipur)
  const r1 = await pool.query(
    `INSERT INTO typical_routes
       (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
     VALUES ($1,$2,'SHARED_TAXI',75,100,200,
       'Shared taxi or local bus from Imphal to Moirang (the gateway to Loktak Lake). It is a ~45km drive across the Imphal Valley, taking a little over an hour.',
       $3)
     RETURNING id`,
    [byName['Imphal'], byName['Loktak Lake'], MANIPUR_SOURCE]
  )
  console.log('Inserted Imphal->Loktak Lake:', r1.rows[0].id)

  // Loktak Lake -> Imphal (return)
  const r2 = await pool.query(
    `INSERT INTO typical_routes
       (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
     VALUES ($1,$2,'SHARED_TAXI',75,100,200,
       'Return leg. Shared taxi/bus from Moirang/Loktak back to Imphal.',
       $3)
     RETURNING id`,
    [byName['Loktak Lake'], byName['Imphal'], MANIPUR_SOURCE]
  )
  console.log('Inserted Loktak Lake->Imphal:', r2.rows[0].id)

  // Gangtok -> Pelling (Sikkim)
  const r3 = await pool.query(
    `INSERT INTO typical_routes
       (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
     VALUES ($1,$2,'SHARED_TAXI',300,350,500,
       'Shared taxi (Sumo or Maxx) from Gangtok to Pelling. The ~115km drive takes about 5 hours through winding mountain roads, usually routed via Ravangla and Legship.',
       $3)
     RETURNING id`,
    [byName['Gangtok'], byName['Pelling'], SIKKIM_SOURCE]
  )
  console.log('Inserted Gangtok->Pelling:', r3.rows[0].id)

  // Pelling -> Gangtok (return)
  const r4 = await pool.query(
    `INSERT INTO typical_routes
       (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
     VALUES ($1,$2,'SHARED_TAXI',300,350,500,
       'Return leg. Shared taxi from Pelling back to Gangtok. Same route and fare range.',
       $3)
     RETURNING id`,
    [byName['Pelling'], byName['Gangtok'], SIKKIM_SOURCE]
  )
  console.log('Inserted Pelling->Gangtok:', r4.rows[0].id)

  const all = await pool.query(
    `SELECT d1.name AS from_name, d2.name AS to_name, tr.mode, tr.duration_minutes, tr.cost_min_inr, tr.cost_max_inr
     FROM typical_routes tr
     JOIN destinations d1 ON tr.from_destination_id = d1.id
     JOIN destinations d2 ON tr.to_destination_id = d2.id
     WHERE d1.state IN ('Manipur', 'Sikkim')`
  )
  console.log('\\nManipur & Sikkim typical_routes:')
  all.rows.forEach(r => {
    console.log(` ${r.from_name} -> ${r.to_name}: ${r.mode}, ${r.duration_minutes}min, Rs${r.cost_min_inr}-${r.cost_max_inr}`)
  })

  await pool.end()
  console.log('Done.')
})()
