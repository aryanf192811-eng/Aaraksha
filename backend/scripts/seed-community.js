// scripts/seed-community.js
// Community's two tabs (Safety Reports, Experiences) had zero rows in
// scam_reports/destination_reviews on first inspection — not a backend
// bug, just a gap: seed.js never wrote fixtures for either table, since
// they're meant to be live user-generated content. That made Community
// look broken/empty on any freshly-seeded database (including the
// production Render backend, which is a separate database from whatever
// this script is pointed at via DATABASE_URL — running it locally does
// NOT fix the deployed app's Community page; it has to be run with that
// database's own connection string).
//
// Queries for real existing tourists/trips/destinations rather than
// hardcoding seed.js's fixture IDs, so it works whether run right after a
// fresh `npm run seed` or against a database that's since accumulated
// real trips from UI testing. Idempotent — skips entirely if either table
// already has rows, so it's safe to run more than once.
'use strict'

require('dotenv').config()
const { getPool } = require('../src/database/pool')

async function seedCommunity() {
  const pool = getPool()
  const client = await pool.connect()

  try {
    const { rows: [{ count: reviewCount }] } = await client.query('SELECT COUNT(*) FROM destination_reviews')
    const { rows: [{ count: scamCount }] } = await client.query('SELECT COUNT(*) FROM scam_reports')
    if (parseInt(reviewCount) > 0 || parseInt(scamCount) > 0) {
      console.log('✅ Community content already seeded — skipping')
      return
    }

    await client.query('BEGIN')

    const dest = {}
    const { rows: destRows } = await client.query('SELECT id, name FROM destinations')
    destRows.forEach(d => { dest[d.name] = d.id })

    const tourist = {}
    const { rows: touristRows } = await client.query(`SELECT id, phone FROM tourists WHERE phone IN ($1,$2,$3)`,
      ['9876500001', '9876500002', '9876500003'])
    touristRows.forEach(t => { tourist[t.phone] = t.id })
    const priya = tourist['9876500001']
    const rahul = tourist['9876500002']
    const sneha = tourist['9876500003']

    const { rows: tripRows } = await client.query(`SELECT id, tourist_id, title FROM trips WHERE status = 'COMPLETED'`)
    const tripByTitle = {}
    tripRows.forEach(t => { tripByTitle[t.title] = t.id })

    if (priya) {
      console.log('Seeding destination reviews...')
      const sikkimTrip = tripByTitle['Sikkim Monastery & Peaks'] ?? null
      const kazirangaTrip = tripByTitle['Kaziranga Wildlife Safari'] ?? null
      const tawangTrip = tripByTitle['Tawang Monastery Circuit'] ?? null

      const reviewRows = [
        dest['Pelling'] && [dest['Pelling'], priya, sikkimTrip, 5,
          'The monastery at sunrise was unforgettable — completely worth the early wake-up. Pelling itself is small and quiet, easy to get around on foot.',
          4200, 6, 'LOW', 5, 'YES', 4, 3, 4,
          'Kanchenjunga view from Pemayangtse Monastery, very few crowds even in peak season',
          'Limited food options after 9pm, most places close early',
          'Book the monastery visit for 6am — the light is incredible and you will have the courtyard to yourself', 9],
        dest['Kaziranga'] && [dest['Kaziranga'], priya, kazirangaTrip, 4,
          'Safari was well organized but the jeep was packed tighter than expected. Saw a rhino within 20 minutes though, so worth it.',
          3500, 4, 'HIGH', 3, 'YES', 3, 4, 3,
          'Guide knew exactly where the rhinos tend to graze in the morning',
          'Jeep was overcrowded — 7 people instead of the promised 5',
          'Book the 6am safari slot, not the 9am one — animals are far more active and it is cooler', 18],
        rahul && dest['Tawang'] && [dest['Tawang'], rahul, tawangTrip, 5,
          'Tawang Monastery is genuinely one of the most beautiful places I have been. The altitude hits hard though — take it slow the first day.',
          6000, 8, 'LOW', 5, 'SOMEWHAT', 2, 3, 2,
          'The monastery library and the 400-year-old murals inside',
          'Altitude sickness on day one — should have acclimatized at Bomdila longer',
          'Spend a night in Bomdila on the way up instead of driving straight through — makes a real difference', 25],
      ].filter(Boolean)

      for (const row of reviewRows) {
        const [destinationId, touristId, tripId, rating, reviewText, cost, hours, crowd, cleanliness,
          feltSafe, transport, food, accessibility, liked, disliked, tips, daysAgo] = row
        await client.query(`
          INSERT INTO destination_reviews
            (destination_id, tourist_id, trip_id, rating, review_text, actual_cost_inr, time_spent_hours,
             crowd_level, cleanliness_rating, felt_safe, transport_rating, food_availability_rating,
             accessibility_rating, liked_text, disliked_text, tips_text, visited_date)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, CURRENT_DATE - $17::int)
          ON CONFLICT (destination_id, tourist_id) DO NOTHING`,
          [destinationId, touristId, tripId, rating, reviewText, cost, hours, crowd, cleanliness,
           feltSafe, transport, food, accessibility, liked, disliked, tips, daysAgo]
        )
      }
    }

    console.log('Seeding safety reports...')
    const reports = [
      [dest['Kaziranga'], priya, 'OVERCHARGING', 'Safari jeep operator quoted ₹3500 then demanded ₹5000 cash at the gate, claiming a "peak season surcharge" not mentioned at booking.', 8, true],
      [dest['Kaziranga'], rahul, 'OVERCHARGING', 'Same jeep-surcharge issue near the eastern range entrance — worth confirming the total price in writing before boarding.', 15, false],
      [dest['Shillong'], rahul, 'FAKE_GUIDE', 'A man near Police Bazar claimed to be a "govt-certified guide" and charged ₹1500 for a walking tour, no ID or license shown when asked.', 20, false],
      [dest['Cherrapunji (Sohra)'], priya, 'UNSAFE_AREA', 'The trail down to Nohkalikai viewpoint has a section with no railing and loose gravel — slipped but wasn’t hurt. Worth a warning sign at minimum.', 18, true],
      [dest['Pelling'], rahul, 'OVERCHARGING', 'Local taxi quoted ₹800 for the Pemayangtse Monastery round trip (a 4km drive), settled at ₹400 after negotiating.', 10, false],
      [dest['Tawang'], sneha, 'THEFT', 'Had a phone go missing from a jacket pocket in the crowded market area near the main monastery gate — keep valuables zipped in a front pocket.', 30, false],
    ].filter(r => r[0] && r[1])

    for (const [destinationId, touristId, category, description, daysAgo, verified] of reports) {
      await client.query(
        `INSERT INTO scam_reports (destination_id, tourist_id, category, description, incident_date, verified, created_at)
         VALUES ($1,$2,$3,$4, CURRENT_DATE - $5::int, $6, NOW() - ($5::text || ' days')::interval)`,
        [destinationId, touristId, category, description, daysAgo, verified]
      )
    }

    await client.query('COMMIT')
    console.log(`✅ Seeded community content: reviews + ${reports.length} safety reports`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

seedCommunity()
  .then(() => process.exit(0))
  .catch(err => { console.error('❌ seed-community failed:', err); process.exit(1) })
