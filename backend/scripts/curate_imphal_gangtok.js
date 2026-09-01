'use strict'
// Data curation script — adds Imphal (Manipur) and Gangtok (Sikkim) as
// second destinations for their respective states, enabling intra-state 
// route pairs to be written for both states.
//
// Sources:
//
// Imphal (Manipur):
//   - imphalwest.nic.in / imphaleast.nic.in (Govt of Manipur) confirm JNIMS
//     (Jawaharlal Nehru Institute of Medical Sciences) in Porompat.
//   - Altitude 786m: standard Imphal Valley elevation (wikipedia/IMD).
//   - Connectivity GOOD: Imphal International Airport, NH2, NH37.
//   - ILP Required: YES (manipurilponline.mn.gov.in - mandatory for Indians).
//   - zone_type ILP_REQUIRED, difficulty EASY.
//
// Gangtok (Sikkim):
//   - sikkim.gov.in (Govt of Sikkim portal) confirms Sir Thutob Namgyal 
//     Memorial (STNM) Hospital as premier referral hospital.
//   - Altitude 1,676m (5,500 feet): explicitly cited on sikkim.gov.in.
//   - Connectivity GOOD: NH10, Pakyong Airport nearby, Bagdogra 124km.
//   - ILP Required: NO for Indian tourists visiting Gangtok town itself 
//     (foreigners need RAP, and Indians need PAP for high-altitude areas 
//     like Nathula, but Gangtok itself is open).
//   - zone_type SAFE, difficulty EASY.
//
// Run from backend/ with:
//   node scripts/curate_imphal_gangtok.js

const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const IMPHAL_SOURCE = [
  'Altitude 786m: standard Imphal Valley elevation.',
  'Hospital: JNIMS Porompat (imphaleast.nic.in).',
  'Connectivity GOOD: Imphal International Airport, NH2.',
  'ILP Required: manipurilponline.mn.gov.in confirms mandatory for Indian citizens.',
].join(' ')

const GANGTOK_SOURCE = [
  'Altitude 1676m: explicit on sikkim.gov.in.',
  'Hospital: Sir Thutob Namgyal Memorial (STNM) Hospital (sikkim.gov.in).',
  'Connectivity GOOD: NH10, Pakyong Airport.',
  'ILP Required: False for Gangtok town for Indian nationals (sikkim.gov.in).',
].join(' ')

;(async () => {
  const existing = await pool.query(
    "SELECT name FROM destinations WHERE name IN ('Imphal', 'Gangtok')"
  )
  if (existing.rows.length > 0) {
    console.log('Already exists, skipping:', existing.rows.map(r => r.name).join(', '))
    await pool.end()
    return
  }

  // INSERT Imphal (Manipur)
  const imphal = await pool.query(
    `INSERT INTO destinations
       (name, state, latitude, longitude, altitude_m, connectivity, difficulty,
        zone_type, ilp_required, nearest_hospital_name, nearest_hospital_km,
        nearest_police_km, popularity_index, description, best_months, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, name`,
    [
      'Imphal',
      'Manipur',
      24.8170,               // latitude OSM
      93.9368,               // longitude OSM
      786,                   // altitude_m
      'GOOD',                // airport in town
      'EASY',                // plains
      'ILP_REQUIRED',        // ILP mandatory
      true,                  // ilp_required
      'JNIMS Hospital, Porompat',
      3,                     // km from centre
      1,                     // nearest_police_km
      65,                    // popularity_index
      'Capital of Manipur, situated in the Imphal Valley. Known for the Kangla Fort, Ima Keithel (all-women market), and rich cultural heritage. Inner Line Permit (ILP) is required for entry. The city has an international airport and acts as the transit hub for Loktak Lake and the Myanmar border at Moreh.',
      'Oct–Apr',
      IMPHAL_SOURCE,
    ]
  )
  console.log('Inserted:', imphal.rows[0].name, imphal.rows[0].id)

  // INSERT Gangtok (Sikkim)
  const gangtok = await pool.query(
    `INSERT INTO destinations
       (name, state, latitude, longitude, altitude_m, connectivity, difficulty,
        zone_type, ilp_required, nearest_hospital_name, nearest_hospital_km,
        nearest_police_km, popularity_index, description, best_months, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, name`,
    [
      'Gangtok',
      'Sikkim',
      27.3314,               // latitude OSM
      88.6138,               // longitude OSM
      1676,                  // altitude_m (sikkim.gov.in)
      'GOOD',                // NH10, Pakyong airport
      'EASY',                // developed capital city
      'SAFE',                // open to Indians
      false,                 // ilp_required (only needed for higher altitudes)
      'STNM Hospital',
      1,                     // km from centre
      1,                     // nearest_police_km
      85,                    // popularity_index (very popular)
      'The vibrant capital of Sikkim, perched on a ridge at 1,676m. A major hub for tourism in the Himalayas, featuring views of Mt. Khangchendzonga, Buddhist monasteries like Rumtek, and the pedestrian-only MG Marg. No ILP required for Indians for the city itself.',
      'Oct–May',
      GANGTOK_SOURCE,
    ]
  )
  console.log('Inserted:', gangtok.rows[0].name, gangtok.rows[0].id)

  const verify = await pool.query(
    "SELECT name, state, altitude_m, connectivity, difficulty, zone_type, ilp_required FROM destinations WHERE state IN ('Manipur', 'Sikkim') ORDER BY state, name"
  )
  console.log('\nManipur + Sikkim destinations now:')
  verify.rows.forEach(r => {
    console.log(` ${r.state} | ${r.name}: ${r.altitude_m}m, ${r.connectivity}, ${r.difficulty}, zone=${r.zone_type}, ILP=${r.ilp_required}`)
  })

  await pool.end()
  console.log('Done.')
})()
