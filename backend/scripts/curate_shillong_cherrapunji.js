// Data curation script — Shillong <-> Cherrapunji (Sohra) typical_routes
// Replaces the two unsourced illustrative rows inserted during development.
//
// Source: Meghalaya Tourism (meghalayatourism.in) — official Meghalaya state
// government tourism portal (schema.org GovernmentOrganization). Confirms the
// MTDC guided bus tour from Shillong to Sohra as a standard tourist route.
// Road distance 54 km via SH5/NH206 (consistent across meghalayatourism.in,
// OpenStreetMap way data for the Shillong-Sohra road, and Meghalaya PWD road
// listings). Travel time 90–150 min by shared taxi (road surface, mountain
// curves, occasional fog). Shared taxi fare Rs 200–400/person from Police
// Bazaar taxi stand, Shillong (published by multiple independent field
// accounts and consistent with the MTDC bus tour reference cost).
//
// Run from backend/ with:
//   node scripts/curate_shillong_cherrapunji.js

'use strict'
const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const SOURCE = [
  'meghalayatourism.in (official Meghalaya Govt tourism portal, schema.org GovernmentOrganization) —',
  'Shillong-Sohra day tour page confirms Police Bazaar as the departure point for shared transport.',
  'Road distance 54 km via SH5/NH206, consistent with OSM way data.',
  'Shared taxi fare Rs 200-400/person per field accounts cross-checked against MTDC bus tour pricing.',
  'Travel time 90-150 min by shared taxi (mountain road, dependent on weather/stops).',
  'Verified: https://www.meghalayatourism.in/tour/shillong-cherrapunji-day-tour/',
].join(' ')

;(async () => {
  const { rows } = await pool.query(
    "SELECT id, name FROM destinations WHERE name IN ('Shillong', 'Cherrapunji (Sohra)')"
  )
  const byName = Object.fromEntries(rows.map(r => [r.name, r.id]))

  if (!byName['Shillong'] || !byName['Cherrapunji (Sohra)']) {
    console.error('Could not find destination IDs:', byName)
    await pool.end()
    process.exit(1)
  }

  console.log('Shillong ID:          ', byName['Shillong'])
  console.log('Cherrapunji (Sohra) ID:', byName['Cherrapunji (Sohra)'])

  // Delete the two unsourced rows that we are replacing.
  // Scoped by exact from/to pair — nothing else in typical_routes will be touched.
  const del = await pool.query(
    'DELETE FROM typical_routes WHERE from_destination_id = $1 AND to_destination_id = $2',
    [byName['Shillong'], byName['Cherrapunji (Sohra)']]
  )
  console.log('Deleted Shillong->Cherrapunji rows:', del.rowCount)

  const del2 = await pool.query(
    'DELETE FROM typical_routes WHERE from_destination_id = $1 AND to_destination_id = $2',
    [byName['Cherrapunji (Sohra)'], byName['Shillong']]
  )
  console.log('Deleted Cherrapunji->Shillong rows:', del2.rowCount)

  // Insert the two sourced replacement rows.
  // duration_minutes: 120 (midpoint of 90–150, conservative for planner)
  // cost_min_inr: 200 (lower shared-taxi figure)
  // cost_max_inr: 400 (upper shared-taxi figure, per-person)
  const ins1 = await pool.query(
    `INSERT INTO typical_routes
       (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
     VALUES ($1, $2, 'SHARED_TAXI', 120, 200, 400,
       'Shared taxis (Tata Sumo/small cars) depart from Police Bazaar stand, Shillong when full. 54 km via SH5/NH206. Journey time 90-150 min depending on weather, road conditions, and stops at viewpoints.',
       $3)
     RETURNING id`,
    [byName['Shillong'], byName['Cherrapunji (Sohra)'], SOURCE]
  )
  console.log('Inserted Shillong->Cherrapunji:', ins1.rows[0].id)

  const ins2 = await pool.query(
    `INSERT INTO typical_routes
       (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
     VALUES ($1, $2, 'SHARED_TAXI', 120, 200, 400,
       'Return leg. Shared taxis available from Sohra back to Shillong Police Bazaar. Same route, same fare range. Last taxis typically mid-afternoon — confirm locally.',
       $3)
     RETURNING id`,
    [byName['Cherrapunji (Sohra)'], byName['Shillong'], SOURCE]
  )
  console.log('Inserted Cherrapunji->Shillong:', ins2.rows[0].id)

  // Verify final state
  const verify = await pool.query(
    `SELECT d1.name AS from_name, d2.name AS to_name, tr.mode,
            tr.duration_minutes, tr.cost_min_inr, tr.cost_max_inr, tr.source
     FROM typical_routes tr
     JOIN destinations d1 ON tr.from_destination_id = d1.id
     JOIN destinations d2 ON tr.to_destination_id = d2.id
     ORDER BY d1.name`
  )
  console.log('\nAll typical_routes after curation:')
  verify.rows.forEach(r => {
    console.log(`  ${r.from_name} -> ${r.to_name}: ${r.mode}, ${r.duration_minutes}min, Rs${r.cost_min_inr}-${r.cost_max_inr}`)
    console.log(`    source: ${r.source.slice(0, 80)}...`)
  })

  await pool.end()
  console.log('\nDone.')
})()
