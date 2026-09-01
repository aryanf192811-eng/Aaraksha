'use strict'
// Data curation script — adds Aizawl (Mizoram) and Agartala (Tripura) to
// the destinations table. These are the first entries for their states,
// unblocking buildJourney() for Mizoram and Tripura (currently returns
// 422 per benchmark test #6 in chatbot.md).
//
// Sources (all Tier A — government portals):
//
// Aizawl:
//   - Altitude 1,132 m: aizawl.nic.in (Govt of India NIC district portal)
//   - ILP required for Indian tourists: ilp.mizoram.gov.in (official Mizoram
//     Govt ILP portal, enforced at all entry points including Lengpui Airport)
//   - Hospital: Civil Hospital Aizawl (state's largest govt hospital),
//     located within the city centre — nearest_hospital_km set to 2
//   - Connectivity MODERATE: Lengpui Airport 32 km, NH-54 road link,
//     Bairabi–Sairang rail inaugurated 2025; mountain roads are slow
//   - zone_type ILP_REQUIRED: consistent with existing Arunachal/Manipur rows
//   - Coordinates: aizawl.nic.in / OSM node for Aizawl city centre
//
// Agartala:
//   - Altitude 13 m: imd.gov.in (India Meteorological Department)
//   - No ILP for Indian tourists: confirmed by Tripura Tourism
//     (tourism.tripura.gov.in) — one of the few NE states with open access
//   - Hospital: Agartala Government Medical College & GBP Hospital (premier
//     state hospital), westtripura.nic.in — within city, ~3 km from centre
//   - Connectivity GOOD: MBB Airport + broad-gauge railway (Guwahati link) +
//     NH-44 and NH-44A road network; state capital, reliable connectivity
//   - zone_type SAFE: no permit, no restriction, no advisory, flat terrain
//   - Coordinates: imd.gov.in / OSM node for Agartala city centre
//
// Run from backend/ with:
//   node scripts/curate_mizoram_tripura.js

const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const AIZAWL_SOURCE = [
  'aizawl.nic.in (NIC district portal, Govt of India) — altitude 1,132 m, city connectivity.',
  'ilp.mizoram.gov.in (official Mizoram Govt ILP portal) — ILP mandatory for all Indian tourists',
  'entering via Lengpui Airport, Vairengte, Bairabi, or Kanhmun.',
  'Civil Hospital Aizawl (nearest_hospital_km ~2): state premier govt hospital, within city.',
  'NH-54 road connectivity; Lengpui Airport 32 km; Bairabi-Sairang rail link (inaugurated 2025).',
  'Coordinates 23.7272N 92.7176E consistent with OSM node for Aizawl city centre.',
].join(' ')

const AGARTALA_SOURCE = [
  'imd.gov.in (India Meteorological Department) — altitude 13 m above MSL.',
  'tourism.tripura.gov.in (Tripura Tourism Dept, Govt of Tripura) — Tripura requires no ILP for Indian tourists.',
  'westtripura.nic.in (West Tripura District, NIC) — AGMC & GBP Hospital is premier state hospital ~3 km from centre.',
  'MBB Airport + broad-gauge rail (Guwahati link) + NH-44/NH-44A road network; reliable state-capital connectivity.',
  'Coordinates 23.8315N 91.2868E consistent with OSM node for Agartala city centre.',
].join(' ')

;(async () => {
  // Check if these destinations already exist (idempotency guard)
  const existing = await pool.query(
    "SELECT name FROM destinations WHERE name IN ('Aizawl', 'Agartala')"
  )
  if (existing.rows.length > 0) {
    console.log('Already exists, skipping:', existing.rows.map(r => r.name).join(', '))
    await pool.end()
    return
  }

  // INSERT Aizawl (Mizoram)
  const aizawl = await pool.query(
    `INSERT INTO destinations
       (name, state, latitude, longitude, altitude_m, connectivity, difficulty,
        zone_type, ilp_required, nearest_hospital_name, nearest_hospital_km,
        nearest_police_km, popularity_index, description, best_months, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, name`,
    [
      'Aizawl',
      'Mizoram',
      23.7272,               // latitude — OSM / aizawl.nic.in
      92.7176,               // longitude
      1132,                  // altitude_m — aizawl.nic.in
      'MODERATE',            // GOOD road/air; mountain roads slow, new rail link
      'MODERATE',            // hill city with steep terrain but standard tourist access
      'ILP_REQUIRED',        // ilp.mizoram.gov.in — mandatory for all Indian tourists
      true,                  // ilp_required
      'Civil Hospital Aizawl',
      2,                     // km — within city centre
      1,                     // nearest_police_km — city police HQ
      60,                    // popularity_index — state capital, moderate tourist traffic
      'Capital of Mizoram, perched on a series of ridges at 1,132 m. Known for its terraced hillside architecture, vibrant Mizo culture, and proximity to natural attractions including Hmuifang and the Phawngpui Blue Mountain National Park. An Inner Line Permit is required for all visitors.',
      'Oct–Mar',             // best months (post-monsoon, dry and clear)
      AIZAWL_SOURCE,
    ]
  )
  console.log('Inserted:', aizawl.rows[0].name, aizawl.rows[0].id)

  // INSERT Agartala (Tripura)
  const agartala = await pool.query(
    `INSERT INTO destinations
       (name, state, latitude, longitude, altitude_m, connectivity, difficulty,
        zone_type, ilp_required, nearest_hospital_name, nearest_hospital_km,
        nearest_police_km, popularity_index, description, best_months, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, name`,
    [
      'Agartala',
      'Tripura',
      23.8315,               // latitude — OSM / imd.gov.in
      91.2868,               // longitude
      13,                    // altitude_m — imd.gov.in
      'GOOD',                // MBB Airport + broad-gauge rail + NH-44; state capital
      'EASY',                // flat terrain, well-connected, urban
      'SAFE',                // no ILP, no advisory, no restricted area
      false,                 // ilp_required — Tripura is ILP-free for Indian tourists
      'Agartala Government Medical College & GBP Hospital',
      3,                     // km — within city
      1,                     // nearest_police_km
      65,                    // popularity_index — capital with Ujjayanta Palace, Neermahal
      'Capital of Tripura and a key gateway into Northeast India. Home to the iconic Ujjayanta Palace (now State Museum), Neermahal lake palace, Sepahijala Wildlife Sanctuary, and the Fourteen Goddess Temple. No Inner Line Permit required for Indian tourists — one of the most accessible states in the Northeast.',
      'Oct–Mar',             // best months
      AGARTALA_SOURCE,
    ]
  )
  console.log('Inserted:', agartala.rows[0].name, agartala.rows[0].id)

  // Verify
  const verify = await pool.query(
    "SELECT name, state, altitude_m, connectivity, difficulty, zone_type, ilp_required, nearest_hospital_km FROM destinations WHERE name IN ('Aizawl', 'Agartala')"
  )
  console.log('\nVerification:')
  verify.rows.forEach(r => {
    console.log(` ${r.name} (${r.state}): ${r.altitude_m}m, ${r.connectivity}, ${r.difficulty}, zone=${r.zone_type}, ILP=${r.ilp_required}, hosp=${r.nearest_hospital_km}km`)
  })

  // Count total destinations now
  const total = await pool.query('SELECT COUNT(*) FROM destinations')
  console.log('\nTotal destinations in DB:', total.rows[0].count)

  await pool.end()
  console.log('Done.')
})()
