'use strict'
// Data curation script — adds Champhai (Mizoram) and Unakoti (Tripura) as
// second destinations for their states, enabling intra-state route pairs
// for both Mizoram and Tripura.
//
// Sources:
//
// Champhai (Mizoram):
//   - champhai.nic.in (NIC district portal, Govt of Mizoram) confirms:
//     District HQ, "Rice Bowl of Mizoram" title, 192 km from Aizawl via road.
//     Title: "Champhai District, Government of Mizoram"
//   - Altitude 1,678 m: consistently cited in reference to champhai.nic.in;
//     high-altitude border town near Myanmar. Multiple sources consistent.
//   - ILP required: ilp.mizoram.gov.in (same as all of Mizoram — mandatory).
//   - District Hospital Champhai: primary govt healthcare facility in town.
//   - Connectivity POOR: 192km from Aizawl by mountain road (5-7h), nearest
//     airport Lengpui ~186km, no direct rail access to Champhai town.
//   - zone_type ILP_REQUIRED: consistent with Mizoram-wide ILP enforcement.
//   - difficulty HARD: high altitude (1,678m), remote, long mountain-road access.
//   - Coordinates 23.4571N 93.3189E: consistent with OSM node for Champhai town.
//
// Unakoti (Tripura):
//   - unakoti.nic.in (NIC district portal, Govt of Tripura) confirms:
//     District exists, Kailashahar is the subdivisional HQ, ~8km from site.
//     URL cited in search results as the authoritative district portal.
//   - No ILP: Tripura-wide open access (tourism.tripura.gov.in, same source
//     as Agartala session).
//   - altitude_m 120: conservative estimate for the approach terrain (Unakoti
//     district is low-lying plains; the Raghunandan Hills site rises higher
//     but the district base/approach is ~100-120m). No specific govt altitude
//     figure for the site could be directly confirmed — this is a conservative
//     approach figure, noted in the description.
//   - Connectivity MODERATE: 178km from Agartala by road (4-5h), Dharmanagar
//     railway station ~12km from site (broad-gauge connection via unakoti.nic.in
//     and search results confirming the rail link).
//   - Nearest hospital: District Hospital Kailashahar, ~8km (unakoti.nic.in
//     confirms Kailashahar as subdivisional HQ and administrative centre).
//   - zone_type SAFE: no ILP, no advisory, accessible site.
//   - difficulty MODERATE: stairs and hill terrain at the site, accessible
//     for most visitors but requires moderate fitness.
//   - Coordinates 24.3167N 92.0833E: Unakoti site coordinates, consistent
//     with OSM and standard geographic references.
//
// Run from backend/ with:
//   node scripts/curate_champhai_unakoti.js

const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const CHAMPHAI_SOURCE = [
  'champhai.nic.in (NIC district portal, Govt of Mizoram) — confirms district HQ, road distance 192km from Aizawl.',
  'Altitude 1,678m: cited consistently in reference to champhai.nic.in; high-altitude Myanmar border town.',
  'ILP mandatory: ilp.mizoram.gov.in (official Mizoram Govt ILP portal, applies state-wide).',
  'District Hospital Champhai: primary govt healthcare facility in town.',
  'Connectivity: 192km mountain road from Aizawl (5-7h), nearest airport Lengpui 186km, no direct rail to Champhai.',
  'Coordinates 23.4571N 93.3189E consistent with OSM node for Champhai town.',
].join(' ')

const UNAKOTI_SOURCE = [
  'unakoti.nic.in (NIC district portal, Govt of Tripura) — confirms Kailashahar as subdivisional HQ ~8km from site.',
  'No ILP: tourism.tripura.gov.in (Tripura Tourism Dept) — Tripura open access for Indian tourists.',
  'Altitude 120m: conservative approach-terrain figure; Unakoti district is low-lying plains (Tripura plains ~15-120m).',
  'The Raghunandan Hills site rises higher but no govt altitude figure for the specific site confirmed.',
  'Connectivity: 178km from Agartala by road (4-5h); Dharmanagar railway station ~12km (broad-gauge).',
  'Nearest hospital: District Hospital Kailashahar ~8km (unakoti.nic.in confirms Kailashahar as admin centre).',
  'Coordinates 24.3167N 92.0833E consistent with OSM reference for Unakoti site.',
].join(' ')

;(async () => {
  const existing = await pool.query(
    "SELECT name FROM destinations WHERE name IN ('Champhai', 'Unakoti')"
  )
  if (existing.rows.length > 0) {
    console.log('Already exists, skipping:', existing.rows.map(r => r.name).join(', '))
    await pool.end()
    return
  }

  // INSERT Champhai (Mizoram) — second Mizoram destination
  const champhai = await pool.query(
    `INSERT INTO destinations
       (name, state, latitude, longitude, altitude_m, connectivity, difficulty,
        zone_type, ilp_required, nearest_hospital_name, nearest_hospital_km,
        nearest_police_km, popularity_index, description, best_months, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, name`,
    [
      'Champhai',
      'Mizoram',
      23.4571,               // latitude — OSM / champhai.nic.in
      93.3189,               // longitude
      1678,                  // altitude_m — champhai.nic.in reference
      'POOR',                // 192km mountain road from Aizawl, no direct rail/airport nearby
      'HARD',                // high altitude, remote, long mountain road, border area
      'ILP_REQUIRED',        // ilp.mizoram.gov.in — mandatory state-wide
      true,                  // ilp_required
      'District Hospital Champhai',
      2,                     // km — district hospital within town
      1,                     // nearest_police_km — district police station in town
      45,                    // popularity_index — growing tourist destination but remote
      'Known as the "Rice Bowl of Mizoram," Champhai sits at 1,678 m on the Myanmar border. Famous for terraced paddy fields, the legendary Rih Dil lake (just across the border), and the Thasiama Seno Neihna adventure trail. Mizoram\'s easternmost tourist hub — remote, high, and requires an Inner Line Permit.',
      'Oct–Mar',
      CHAMPHAI_SOURCE,
    ]
  )
  console.log('Inserted:', champhai.rows[0].name, champhai.rows[0].id)

  // INSERT Unakoti (Tripura) — second Tripura destination
  const unakoti = await pool.query(
    `INSERT INTO destinations
       (name, state, latitude, longitude, altitude_m, connectivity, difficulty,
        zone_type, ilp_required, nearest_hospital_name, nearest_hospital_km,
        nearest_police_km, popularity_index, description, best_months, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, name`,
    [
      'Unakoti',
      'Tripura',
      24.3167,               // latitude — OSM reference for Unakoti site
      92.0833,               // longitude
      120,                   // altitude_m — conservative approach terrain; see source note
      'MODERATE',            // 178km from Agartala by road; Dharmanagar rail station 12km
      'MODERATE',            // hill site with stairs, accessible but requires fitness
      'SAFE',                // no ILP, no advisory, open archaeological site
      false,                 // ilp_required
      'District Hospital Kailashahar',
      8,                     // km — Kailashahar is the subdivisional HQ near the site
      5,                     // nearest_police_km
      55,                    // popularity_index — nationally significant site, growing tourism
      'One of the most significant open-air rock-cut sculpture sites in Northeast India, set in the Raghunandan Hills. Thousands of bas-reliefs and sculptures from the 7th–9th centuries, dominated by a giant Shiva head. No Inner Line Permit required. The annual Ashokastami Mela (March/April) draws large pilgrim crowds. 178 km from Agartala by road.',
      'Oct–Mar',
      UNAKOTI_SOURCE,
    ]
  )
  console.log('Inserted:', unakoti.rows[0].name, unakoti.rows[0].id)

  // Verify all destinations per state
  const verify = await pool.query(
    "SELECT name, state, altitude_m, connectivity, difficulty, zone_type, ilp_required FROM destinations WHERE state IN ('Mizoram', 'Tripura') ORDER BY state, name"
  )
  console.log('\nMizoram + Tripura destinations now:')
  verify.rows.forEach(r => {
    console.log(` ${r.state} | ${r.name}: ${r.altitude_m}m, ${r.connectivity}, ${r.difficulty}, zone=${r.zone_type}, ILP=${r.ilp_required}`)
  })

  const total = await pool.query('SELECT COUNT(*) FROM destinations')
  console.log('\nTotal destinations:', total.rows[0].count)
  await pool.end()
  console.log('Done.')
})()
