'use strict'
// Data curation script — adds Jorhat as a transit hub for Assam, and writes
// the typical_routes to connect Kaziranga ↔ Jorhat ↔ Majuli Island.
//
// Background: Worklist item #2 (Assam routes) was blocked because Majuli
// is an island accessible only by ferry, while Kaziranga requires road
// transport. The existing schema supports only a single mode per route leg.
// By inserting Jorhat (the major city and ferry gateway for Majuli) as a
// distinct destination, we can write a road leg to Jorhat and a ferry leg
// to Majuli.
//
// Sources:
//
// Jorhat (Assam):
//   - jorhat.assam.gov.in (Govt of Assam portal) confirms JMCH (Jorhat Medical
//     College & Hospital) and Jorhat Airport (JRH).
//   - Altitude 116m: standard plains elevation.
//   - Connectivity GOOD: Airport, NH37, Mariani rail junction.
//   - ILP Required: NO (Assam is open access).
//   - zone_type SAFE, difficulty EASY.
//
// Routes:
//   - Kaziranga (Kohora) to Jorhat: ~110km via NH37. Travel time 2.5-3h.
//     Shared taxi/bus fare Rs 200-300.
//   - Jorhat to Majuli: Jorhat town to Nimati Ghat (15km, 30m) + Ferry to
//     Kamalabari Ghat (1.5h). Total ~2 hours. Ferry tickets Rs 30-50 per
//     person + local transit Rs 50. Total cost Rs 100-150.
//
// Run from backend/ with:
//   node scripts/curate_jorhat_assam.js

const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const JORHAT_SOURCE = [
  'Altitude 116m: standard Brahmaputra valley elevation.',
  'Hospital: JMCH (Jorhat Medical College & Hospital) confirmed via jorhat.assam.gov.in.',
  'Connectivity GOOD: Jorhat Airport, NH37.',
  'ILP Required: False (Assam is open access).',
].join(' ')

const KAZIRANGA_JORHAT_SOURCE = [
  'Distance ~110km via NH37 (Kaziranga Kohora range to Jorhat).',
  'Travel time 2.5-3h (150 mins).',
  'Cost Rs 200-300 for shared taxi or ASTC bus.',
].join(' ')

const JORHAT_MAJULI_SOURCE = [
  'Distance ~15km to Nimati Ghat, then river crossing to Majuli.',
  'Travel time ~2h (120 mins) including road transfer and ferry.',
  'Mode: FERRY. Cost Rs 100-150 covering shared auto to ghat + Govt ferry ticket.',
].join(' ')

;(async () => {
  const existingJ = await pool.query("SELECT id FROM destinations WHERE name = 'Jorhat'")
  let jorhatId
  
  if (existingJ.rows.length === 0) {
    const jorhat = await pool.query(
      `INSERT INTO destinations
         (name, state, latitude, longitude, altitude_m, connectivity, difficulty,
          zone_type, ilp_required, nearest_hospital_name, nearest_hospital_km,
          nearest_police_km, popularity_index, description, best_months, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id, name`,
      [
        'Jorhat',
        'Assam',
        26.7509,               // latitude OSM
        94.2037,               // longitude OSM
        116,                   // altitude_m
        'GOOD',                // airport, rail, NH37
        'EASY',                // plains
        'SAFE',                // open
        false,                 // ilp_required
        'Jorhat Medical College & Hospital',
        2,                     // km from centre
        1,                     // nearest_police_km
        70,                    // popularity_index
        'A major urban centre in Upper Assam, known as the cultural capital of the state and a hub for tea estates. It serves as the primary transit point for ferries to Majuli Island from Nimati Ghat. Features an airport and extensive road/rail connectivity.',
        'Oct–Apr',
        JORHAT_SOURCE,
      ]
    )
    console.log('Inserted:', jorhat.rows[0].name, jorhat.rows[0].id)
    jorhatId = jorhat.rows[0].id
  } else {
    jorhatId = existingJ.rows[0].id
    console.log('Jorhat already exists.')
  }

  const { rows } = await pool.query(
    "SELECT id, name FROM destinations WHERE name IN ('Kaziranga', 'Majuli Island')"
  )
  const byName = Object.fromEntries(rows.map(r => [r.name, r.id]))
  byName['Jorhat'] = jorhatId

  const missing = ['Kaziranga', 'Majuli Island', 'Jorhat'].filter(n => !byName[n])
  if (missing.length) {
    console.error('Missing destination IDs:', missing)
    await pool.end()
    process.exit(1)
  }

  // Check for existing routes
  const existingR = await pool.query(
    'SELECT id FROM typical_routes WHERE from_destination_id = $1 AND to_destination_id = $2',
    [byName['Kaziranga'], byName['Jorhat']]
  )
  
  if (existingR.rows.length === 0) {
    // Kaziranga -> Jorhat
    await pool.query(
      `INSERT INTO typical_routes
         (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
       VALUES ($1,$2,'SHARED_TAXI',150,200,300,
         'Shared taxi, bus, or private transport via NH37. Smooth highway drive through tea gardens.',
         $3)`,
      [byName['Kaziranga'], byName['Jorhat'], KAZIRANGA_JORHAT_SOURCE]
    )
    console.log('Inserted Kaziranga->Jorhat')

    // Jorhat -> Kaziranga
    await pool.query(
      `INSERT INTO typical_routes
         (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
       VALUES ($1,$2,'SHARED_TAXI',150,200,300,
         'Return leg via NH37. ASTC buses and shared sumos widely available.',
         $3)`,
      [byName['Jorhat'], byName['Kaziranga'], KAZIRANGA_JORHAT_SOURCE]
    )
    console.log('Inserted Jorhat->Kaziranga')
  }

  const existingRM = await pool.query(
    'SELECT id FROM typical_routes WHERE from_destination_id = $1 AND to_destination_id = $2',
    [byName['Jorhat'], byName['Majuli Island']]
  )

  if (existingRM.rows.length === 0) {
    // Jorhat -> Majuli
    await pool.query(
      `INSERT INTO typical_routes
         (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
       VALUES ($1,$2,'FERRY',120,100,150,
         'Take a shared auto/taxi from Jorhat town to Nimati Ghat (~15km), then the Ro-Ro or passenger ferry across the Brahmaputra to Kamalabari Ghat on Majuli.',
         $3)`,
      [byName['Jorhat'], byName['Majuli Island'], JORHAT_MAJULI_SOURCE]
    )
    console.log('Inserted Jorhat->Majuli')

    // Majuli -> Jorhat
    await pool.query(
      `INSERT INTO typical_routes
         (from_destination_id, to_destination_id, mode, duration_minutes, cost_min_inr, cost_max_inr, notes, source)
       VALUES ($1,$2,'FERRY',120,100,150,
         'Return leg via ferry from Kamalabari Ghat to Nimati Ghat, then road transport to Jorhat town.',
         $3)`,
      [byName['Majuli Island'], byName['Jorhat'], JORHAT_MAJULI_SOURCE]
    )
    console.log('Inserted Majuli->Jorhat')
  }

  const all = await pool.query(
    `SELECT d1.name AS from_name, d2.name AS to_name, tr.mode, tr.duration_minutes
     FROM typical_routes tr
     JOIN destinations d1 ON tr.from_destination_id = d1.id
     JOIN destinations d2 ON tr.to_destination_id = d2.id
     WHERE d1.state = 'Assam'`
  )
  console.log('\\nAssam typical_routes:')
  all.rows.forEach(r => console.log(` ${r.from_name} -> ${r.to_name}: ${r.mode}, ${r.duration_minutes}min`))

  await pool.end()
  console.log('Done.')
})()
