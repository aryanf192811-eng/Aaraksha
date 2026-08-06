// scripts/seed.js
'use strict'

require('dotenv').config()
const { getPool } = require('../src/database/pool')
const { hashPassword, hashGovtId, generateGuardianToken, normalizePhone } = require('../src/utils/crypto')
const { calculateTSI } = require('../src/services/tsi.service')
const { v4: uuid } = require('uuid')

const RESET = process.argv.includes('--reset')

async function seed() {
  const pool = getPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    if (RESET) {
      console.log('⚠️  --reset flag detected — clearing all tables...')
      await client.query(`
        TRUNCATE TABLE inbound_sos_sms, scam_reports, weather_cache, rescue_assignments,
          rescue_teams, govt_users, tourist_locations, checkins, dead_mans_switches,
          sos_events, trips, tourists, destinations, otp_verifications CASCADE
      `)
      console.log('✅ Tables cleared')
    } else {
      // Idempotent: check if already seeded
      const { rows } = await client.query('SELECT COUNT(*) FROM destinations')
      if (parseInt(rows[0].count) > 0) {
        console.log('✅ Database already seeded — skipping (use --reset to reseed)')
        await client.query('ROLLBACK')
        return
      }
    }

    // ── DESTINATIONS ──────────────────────────────────────────────────
    console.log('Seeding destinations...')

    const destinations = [
      {
        name: 'Tawang', state: 'Arunachal Pradesh',
        latitude: 27.5859, longitude: 91.8530,
        connectivity: 'POOR', difficulty: 'HARD', altitude_m: 3048,
        zone_type: 'ILP_REQUIRED', ilp_required: true,
        nearest_hospital_name: 'Tawang District Hospital',
        nearest_hospital_km: 3.2, nearest_hospital_phone: '03794-222456',
        nearest_police_km: 0.5,
        govt_advisory: 'Inner Line Permit mandatory for all non-Arunachal residents. High altitude — acclimatize at lower altitudes first. Weather changes rapidly.',
        popularity_index: 85,
        description: 'Home to the largest Buddhist monastery in India, Tawang Monastery. Breathtaking Himalayan landscapes.',
        best_months: 'March–June, September–November',
      },
      {
        name: 'Shillong', state: 'Meghalaya',
        latitude: 25.5788, longitude: 91.8933,
        connectivity: 'GOOD', difficulty: 'EASY', altitude_m: 1496,
        zone_type: 'SAFE', ilp_required: false,
        nearest_hospital_name: 'Bethany Hospital', nearest_hospital_km: 2.1, nearest_hospital_phone: '0364-2521111',
        nearest_police_km: 0.8, govt_advisory: null, popularity_index: 90,
        description: 'The Scotland of the East — rolling hills, waterfalls, and vibrant music culture.',
        best_months: 'October–May',
      },
      {
        name: 'Cherrapunji (Sohra)', state: 'Meghalaya',
        latitude: 25.2697, longitude: 91.7324,
        connectivity: 'MODERATE', difficulty: 'MODERATE', altitude_m: 1484,
        zone_type: 'CAUTION', ilp_required: false,
        nearest_hospital_name: 'Sohra PHC', nearest_hospital_km: 8.5, nearest_hospital_phone: '03637-265001',
        nearest_police_km: 5.2,
        govt_advisory: 'Extremely heavy rainfall June–September. Roads may be impassable. Travel with local guide.',
        popularity_index: 75,
        description: 'One of the wettest places on Earth. Living root bridges and stunning canyon views.',
        best_months: 'October–April',
      },
      {
        name: 'Kaziranga', state: 'Assam',
        latitude: 26.5775, longitude: 93.1705,
        connectivity: 'MODERATE', difficulty: 'EASY', altitude_m: 80,
        zone_type: 'SAFE', ilp_required: false,
        nearest_hospital_name: 'Kohora PHC', nearest_hospital_km: 12.0, nearest_hospital_phone: '03776-268103',
        nearest_police_km: 2.0,
        govt_advisory: 'Safari timings: 7–9:30 AM and 2–4 PM. Follow ranger instructions. Do not exit vehicle.',
        popularity_index: 88,
        description: 'UNESCO World Heritage Site. Home to two-thirds of the world\'s one-horned rhinoceros.',
        best_months: 'November–April',
      },
      {
        name: 'Dzukou Valley', state: 'Nagaland',
        latitude: 25.5000, longitude: 94.1167,
        connectivity: 'NONE', difficulty: 'EXTREME', altitude_m: 2452,
        zone_type: 'HIGH_RISK', ilp_required: false,
        nearest_hospital_name: 'Viswema PHC', nearest_hospital_km: 28.0, nearest_hospital_phone: '0370-2290001',
        nearest_police_km: 15.0,
        govt_advisory: 'No mobile connectivity. Inform forest department before trekking. Guided trek mandatory. Carry 3 days emergency rations.',
        popularity_index: 65,
        description: 'Valley of flowers — spectacular trekking destination with absolute zero connectivity.',
        best_months: 'June–September (flowers), October–November (mist)',
      },
      {
        name: 'Ziro Valley', state: 'Arunachal Pradesh',
        latitude: 27.5333, longitude: 93.8333,
        connectivity: 'MODERATE', difficulty: 'EASY', altitude_m: 1524,
        zone_type: 'ILP_REQUIRED', ilp_required: true,
        nearest_hospital_name: 'Ziro District Hospital', nearest_hospital_km: 5.0, nearest_hospital_phone: '03788-224201',
        nearest_police_km: 2.0,
        govt_advisory: 'ILP required. Home to Apatani tribe — respect local customs and traditions.',
        popularity_index: 70,
        description: 'UNESCO tentative heritage site. Famous for Ziro Music Festival and Apatani culture.',
        best_months: 'September–October (festival), March–May',
      },
      {
        name: 'Loktak Lake', state: 'Manipur',
        latitude: 24.4700, longitude: 93.7800,
        connectivity: 'MODERATE', difficulty: 'EASY', altitude_m: 768,
        zone_type: 'ILP_REQUIRED', ilp_required: true,
        nearest_hospital_name: 'Bishnupur District Hospital', nearest_hospital_km: 15.0, nearest_hospital_phone: '03875-240228',
        nearest_police_km: 8.0,
        govt_advisory: 'ILP required for non-Manipur residents. Register with local police on arrival.',
        popularity_index: 60,
        description: 'Largest freshwater lake in Northeast India. Famous for phumdis — floating islands.',
        best_months: 'October–March',
      },
      {
        name: 'Pelling', state: 'Sikkim',
        latitude: 27.2952, longitude: 88.1190,
        connectivity: 'MODERATE', difficulty: 'MODERATE', altitude_m: 2150,
        zone_type: 'SAFE', ilp_required: false,
        nearest_hospital_name: 'Gyalshing District Hospital', nearest_hospital_km: 14.0, nearest_hospital_phone: '03595-250274',
        nearest_police_km: 5.0,
        govt_advisory: 'Road conditions deteriorate in monsoon. Permits required for Kanchenjunga area.',
        popularity_index: 78,
        description: 'Gateway to Kanchenjunga with panoramic Himalayan views and ancient monasteries.',
        best_months: 'March–May, October–December',
      },
      {
        name: 'Majuli Island', state: 'Assam',
        latitude: 26.9500, longitude: 94.1667,
        connectivity: 'POOR', difficulty: 'EASY', altitude_m: 95,
        zone_type: 'CAUTION', ilp_required: false,
        nearest_hospital_name: 'Majuli District Hospital', nearest_hospital_km: 8.0, nearest_hospital_phone: '03775-274001',
        nearest_police_km: 3.0,
        govt_advisory: 'River ferry crossings can be disrupted in floods July–September.',
        popularity_index: 72,
        description: 'World\'s largest river island. Cultural hub of Assamese Vaishnava heritage.',
        best_months: 'October–March',
      },
      {
        name: 'Longwa Village', state: 'Nagaland',
        latitude: 26.3833, longitude: 95.1500,
        connectivity: 'NONE', difficulty: 'HARD', altitude_m: 1210,
        zone_type: 'RESTRICTED', ilp_required: true,
        nearest_hospital_name: 'Mon District Hospital', nearest_hospital_km: 62.0, nearest_hospital_phone: '03833-222201',
        nearest_police_km: 45.0,
        govt_advisory: 'Special border area permit required. Konyak Naga headhunter heritage area. Only visit with registered guide.',
        popularity_index: 45,
        description: 'Remote border village where the international boundary runs through the chief\'s house.',
        best_months: 'November–February',
      },
    ]

    const destIds = {}
    for (const d of destinations) {
      const { rows } = await client.query(`
        INSERT INTO destinations (name, state, latitude, longitude, connectivity, difficulty, altitude_m, zone_type,
          ilp_required, nearest_hospital_name, nearest_hospital_km, nearest_hospital_phone, nearest_police_km,
          govt_advisory, popularity_index, description, best_months)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING id`,
        [d.name, d.state, d.latitude, d.longitude, d.connectivity, d.difficulty, d.altitude_m,
         d.zone_type, d.ilp_required, d.nearest_hospital_name, d.nearest_hospital_km,
         d.nearest_hospital_phone, d.nearest_police_km, d.govt_advisory,
         d.popularity_index, d.description, d.best_months]
      )
      destIds[d.name] = rows[0].id
    }
    console.log(`  ✅ ${destinations.length} destinations seeded`)

    // ── RESCUE TEAMS ──────────────────────────────────────────────────
    const teams = [
      { name: 'Tawang Mountain Rescue Unit', type: 'MOUNTAIN', district: 'Tawang', state: 'Arunachal Pradesh', contact_phone: '+913794222456', latitude: 27.5859, longitude: 91.8530 },
      { name: 'Meghalaya SDRF Alpha Team', type: 'SDRF', district: 'East Khasi Hills', state: 'Meghalaya', contact_phone: '+917641222234', latitude: 25.5788, longitude: 91.8933 },
      { name: 'Assam Police Emergency Response', type: 'POLICE', district: 'Kamrup Metropolitan', state: 'Assam', contact_phone: '100', latitude: 26.1445, longitude: 91.7362 },
      { name: 'Sikkim Mountain Rescue', type: 'MOUNTAIN', district: 'East Sikkim', state: 'Sikkim', contact_phone: '+9103592202033', latitude: 27.3389, longitude: 88.6065 },
      { name: 'NE Emergency Medical Services', type: 'MEDICAL', district: 'Kamrup Metropolitan', state: 'Assam', contact_phone: '108', latitude: 26.1445, longitude: 91.7362 },
    ]
    for (const t of teams) {
      await client.query(`
        INSERT INTO rescue_teams (name, type, district, state, contact_phone, status, latitude, longitude, capacity)
        VALUES ($1,$2,$3,$4,$5,'AVAILABLE',$6,$7,15)`,
        [t.name, t.type, t.district, t.state, t.contact_phone, t.latitude, t.longitude]
      )
    }
    console.log(`  ✅ ${teams.length} rescue teams seeded`)

    // ── GOVT ADMIN ────────────────────────────────────────────────────
    const govtPasswordHash = await hashPassword('Admin@123')
    await client.query(`
      INSERT INTO govt_users (name, email, password_hash, role, district, state)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      ['Aaraksha Administrator', 'admin@aaraksha.gov.in', govtPasswordHash,
       'SUPER_ADMIN', 'Kamrup Metropolitan', 'Assam']
    )
    console.log('  ✅ Govt admin seeded: admin@aaraksha.gov.in / Admin@123')

    // ── DEMO TOURIST ──────────────────────────────────────────────────
    const demoPhone    = '9999999999'
    const passwordHash = await hashPassword('Demo@123')
    const govtIdNum    = '123456789012'
    const govtIdHash   = hashGovtId(govtIdNum)
    const guardianToken = generateGuardianToken()
    const guardianExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

    const emergencyContacts = JSON.stringify([
      { id: uuid(), name: 'Demo Parent',  phone: '9876543210', relation: 'Parent',  tier: 1, notifyOnSOS: true },
      { id: uuid(), name: 'Demo Sibling', phone: '9876543211', relation: 'Sibling', tier: 2, notifyOnSOS: true },
    ])

    const { rows: [tourist] } = await client.query(`
      INSERT INTO tourists (full_name, phone, email, blood_group, medical_info, emergency_contacts,
        govt_id_type, govt_id_hash, govt_id_suffix, guardian_token, guardian_token_expires, password_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id`,
      ['Aryan Demo', demoPhone, 'demo@aaraksha.in', 'O+', 'No known allergies',
       emergencyContacts, 'AADHAAR', govtIdHash, '9012',
       guardianToken, guardianExpires, passwordHash]
    )
    console.log('  ✅ Demo tourist seeded: demo@aaraksha.in (phone: 9999999999) / Demo@123')

    // ── DEMO TRIP (ACTIVE) ─────────────────────────────────────────────
    const stops = [
      {
        city: 'Kaziranga', state: 'Assam', destinationId: destIds['Kaziranga'],
        lat: 26.5775, lng: 93.1705, days: 2,
        connectivity: 'MODERATE', difficulty: 'EASY', altitude_m: 80, zone_type: 'SAFE', hospital_km: 12,
        activities: [{ name: 'Elephant Safari', type: 'ACTIVITY', cost: 2000 }, { name: 'Jeep Safari', type: 'ACTIVITY', cost: 1500 }],
      },
      {
        city: 'Shillong', state: 'Meghalaya', destinationId: destIds['Shillong'],
        lat: 25.5788, lng: 91.8933, days: 2,
        connectivity: 'GOOD', difficulty: 'EASY', altitude_m: 1496, zone_type: 'SAFE', hospital_km: 2.1,
        activities: [{ name: 'Ward Lake Visit', type: 'ACTIVITY', cost: 50 }, { name: 'Local food tour', type: 'MEAL', cost: 500 }],
      },
      {
        city: 'Cherrapunji', state: 'Meghalaya', destinationId: destIds['Cherrapunji (Sohra)'],
        lat: 25.2697, lng: 91.7324, days: 3,
        connectivity: 'MODERATE', difficulty: 'MODERATE', altitude_m: 1484, zone_type: 'CAUTION', hospital_km: 8.5,
        activities: [{ name: 'Living Root Bridges Trek', type: 'ACTIVITY', cost: 800 }, { name: 'Nohkalikai Falls', type: 'ACTIVITY', cost: 100 }],
      },
    ]

    const tsiResult = calculateTSI({
      travel_type: 'SOLO',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      stops,
    }, {})

    const rescueReadiness = {
      emergencyContacts: true, medicalInfo: true, govtIdComplete: true,
      dmsEnabled: false, tsiReviewed: true, offlineMaps: false,
    }
    const readinessScore = Math.round(Object.values(rescueReadiness).filter(Boolean).length / 6 * 100)

    const { rows: [trip] } = await client.query(`
      INSERT INTO trips (tourist_id, title, description, travel_type, start_date, end_date, status,
        stops, budget_inr, is_public, public_token, tsi_score, tsi_label, tsi_factors,
        tsi_recommendations, tsi_updated_at, rescue_readiness, rescue_readiness_score)
      VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8,true,$9,$10,$11,$12,$13,NOW(),$14,$15)
      RETURNING id`,
      [
        tourist.id,
        'NE India Discovery — Assam to Meghalaya',
        'Exploring the best of Northeast India: wildlife, waterfalls, and culture.',
        'SOLO',
        new Date().toISOString().split('T')[0],
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        JSON.stringify(stops), 20000,
        require('../src/utils/crypto').generatePublicToken(),
        tsiResult.score, tsiResult.label,
        JSON.stringify(tsiResult.factors), JSON.stringify(tsiResult.recommendations),
        JSON.stringify(rescueReadiness), readinessScore,
      ]
    )
    console.log(`  ✅ Demo trip seeded (TSI: ${tsiResult.score} — ${tsiResult.label})`)

    // ── DEMO CHECK-IN ─────────────────────────────────────────────────
    const checkinTime = new Date(Date.now() - 2 * 60 * 60 * 1000)  // 2 hours ago
    await client.query(`
      INSERT INTO checkins (tourist_id, trip_id, latitude, longitude, battery_pct, message, type, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,'MANUAL',$7)`,
      [tourist.id, trip.id, 26.5775, 93.1705, 78, 'Arrived at Kaziranga! Ready for safari tomorrow.', checkinTime]
    )
    await client.query(`
      INSERT INTO tourist_locations (tourist_id, latitude, longitude, battery_pct, updated_at)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (tourist_id) DO UPDATE SET latitude=$2, longitude=$3, battery_pct=$4, updated_at=$5`,
      [tourist.id, 26.5775, 93.1705, 78, checkinTime]
    )
    console.log('  ✅ Demo check-in and location seeded')

    // ── DEMO RESOLVED SOS (for analytics) ─────────────────────────────
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await client.query(`
      INSERT INTO sos_events (tourist_id, trip_id, latitude, longitude, category, trigger_type, status,
        battery_pct, message, resolved_at, resolution_notes, created_at)
      VALUES ($1,$2,$3,$4,'MEDICAL','MANUAL','RESOLVED',$5,$6,$7,$8,$9)`,
      [tourist.id, trip.id, 26.5775, 93.1705, 65,
       'Demo SOS for testing — not a real emergency',
       new Date(yesterday.getTime() + 15 * 60 * 1000),
       'Demo SOS resolved — no action required',
       yesterday]
    )
    console.log('  ✅ Demo resolved SOS seeded (for analytics demo)')

    await client.query('COMMIT')

    console.log('\n' + '═'.repeat(50))
    console.log('🎯 SEED COMPLETE')
    console.log('═'.repeat(50))
    console.log(`  Destinations:    ${destinations.length}`)
    console.log(`  Rescue teams:    ${teams.length}`)
    console.log(`  Govt admin:      admin@aaraksha.gov.in / Admin@123`)
    console.log(`  Demo tourist:    demo@aaraksha.in (phone: 9999999999) / Demo@123`)
    console.log(`  Demo trip TSI:   ${tsiResult.score}/100 — ${tsiResult.label}`)
    console.log(`  Guardian link:   /track/${guardianToken.slice(0, 16)}...`)
    console.log('═'.repeat(50) + '\n')

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Seed failed:', err.message)
    throw err
  } finally {
    client.release()
    await getPool().end()
  }
}

seed().catch(err => {
  console.error('Seed script crashed:', err)
  process.exit(1)
})
