// scripts/seedDemoContent.js
// Fills out Community (reviews + scam reports) and Trips for every existing
// demo tourist account, so judges clicking through any of the 4 demo logins
// see rich content immediately rather than empty states. Goes through the
// real service layer (not hand-crafted SQL) so trip stops get the same
// TSI calculation and enrichment a real POST /trips would produce — this
// is genuine backing data, not a frontend mock.
'use strict'

require('dotenv').config()
const { getPool } = require('../src/database/pool')
const tripService = require('../src/services/trip.service')
const reviewService = require('../src/services/review.service')
const scamService = require('../src/services/scam.service')
const { TouristRepository } = require('../src/repositories/tourist.repository')
const { DestinationRepository } = require('../src/repositories/destination.repository')
const logger = require('../src/utils/logger')

async function main() {
  const touristRepo = new TouristRepository()
  const destRepo = new DestinationRepository()

  const destinations = await destRepo.findAll()
  const destByName = Object.fromEntries(destinations.map(d => [d.name, d]))

  const phones = ['9876500001', '9876500002', '9876500003', '9999999999']
  const tourists = {}
  for (const phone of phones) {
    tourists[phone] = await touristRepo.findByPhone(phone)
  }
  const [priya, rahul, sneha, aryan] = phones.map(p => tourists[p])

  console.log('── Seeding additional trips ──────────────────────────────')

  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
  const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

  const stop = (destName, days, notes) => {
    const d = destByName[destName]
    return {
      city: d.name, state: d.state, destinationId: d.id,
      lat: d.latitude, lng: d.longitude, days,
      arrivalDate: null, departureDate: null, activities: [], notes: notes || '',
      connectivity: d.connectivity, difficulty: d.difficulty,
      altitude_m: d.altitude_m, zone_type: d.zone_type, hospital_km: d.nearest_hospital_km,
    }
  }

  const newTrips = [
    // Priya
    { tourist: priya, title: 'Kaziranga Wildlife Safari', travelType: 'FAMILY',
      startDate: daysAgo(20), endDate: daysAgo(17), budgetInr: 18000, status: 'COMPLETED',
      stops: [stop('Kaziranga', 3, 'Jeep and elephant safari, one-horned rhino spotting')] },
    { tourist: priya, title: 'Meghalaya Waterfalls Circuit', travelType: 'FRIENDS',
      startDate: daysFromNow(25), endDate: daysFromNow(31), budgetInr: 22000, status: 'PLANNED',
      stops: [stop('Shillong', 3, 'Living root bridges, local markets'), stop('Cherrapunji (Sohra)', 3, 'Waterfalls and caves')] },

    // Rahul
    { tourist: rahul, title: 'Tawang Monastery Circuit', travelType: 'SOLO',
      startDate: daysAgo(45), endDate: daysAgo(40), budgetInr: 30000, status: 'COMPLETED',
      stops: [stop('Tawang', 5, 'Monastery visit, Sela Pass, war memorial')] },
    { tourist: rahul, title: 'Ziro Valley Music Festival', travelType: 'FRIENDS',
      startDate: daysFromNow(60), endDate: daysFromNow(64), budgetInr: 20000, status: 'PLANNED',
      stops: [stop('Ziro Valley', 4, 'Ziro Music Festival, Apatani village walk')] },

    // Sneha
    { tourist: sneha, title: 'Majuli Island Culture Tour', travelType: 'SOLO',
      startDate: daysAgo(30), endDate: daysAgo(27), budgetInr: 15000, status: 'COMPLETED',
      stops: [stop('Majuli Island', 3, 'Satra monasteries, mask-making workshop')] },
    { tourist: sneha, title: 'Pelling Himalayan Views', travelType: 'FAMILY',
      startDate: daysFromNow(15), endDate: daysFromNow(19), budgetInr: 25000, status: 'PLANNED',
      stops: [stop('Pelling', 4, 'Kanchenjunga viewpoint, Pemayangtse Monastery')] },

    // Aryan
    { tourist: aryan, title: 'Shillong & Cherrapunji Getaway', travelType: 'FRIENDS',
      startDate: daysAgo(60), endDate: daysAgo(55), budgetInr: 24000, status: 'COMPLETED',
      stops: [stop('Shillong', 3, 'Umiam Lake, cafes'), stop('Cherrapunji (Sohra)', 2, 'Nohkalikai Falls')] },
    { tourist: aryan, title: 'Longwa Village Tribal Experience', travelType: 'ADVENTURE',
      startDate: daysFromNow(40), endDate: daysFromNow(44), budgetInr: 28000, status: 'PLANNED',
      stops: [stop('Longwa Village', 4, 'Konyak tribal village, India-Myanmar border house')] },
  ]

  const createdTrips = []
  for (const t of newTrips) {
    const trip = await tripService.createTrip(t.tourist.id, {
      title: t.title, travelType: t.travelType, startDate: t.startDate, endDate: t.endDate,
      budgetInr: t.budgetInr, stops: t.stops, isPublic: false,
    }, t.tourist)
    // createTrip always makes a PLANNED trip — advance status for the ones that should read as COMPLETED
    if (t.status !== 'PLANNED') {
      const { TripRepository } = require('../src/repositories/trip.repository')
      const repo = new TripRepository()
      if (t.status === 'COMPLETED') {
        await repo.updateStatus(trip.id, t.tourist.id, 'ACTIVE')
        await repo.updateStatus(trip.id, t.tourist.id, 'COMPLETED')
      }
    }
    createdTrips.push({ ...t, id: trip.id })
    console.log(`  Trip: "${t.title}" for ${t.tourist.full_name} [${t.status}]`)
  }

  console.log('\n── Seeding destination reviews ───────────────────────────')

  const findTripId = (touristPhone, destName) => {
    const t = createdTrips.find(ct => ct.tourist.phone === touristPhone && ct.stops.some(s => s.city === destName))
    return t?.id ?? null
  }

  const reviews = [
    { tourist: priya, dest: 'Kaziranga', rating: 5,
      reviewText: 'Absolutely incredible safari experience. Saw three rhinos on the morning jeep safari alone. The park is very well managed and the guides know exactly where the animals gather.',
      actualCostInr: 3500, timeSpentHours: 6, crowdLevel: 'MEDIUM', cleanlinessRating: 4, feltSafe: 'YES',
      transportRating: 4, foodAvailabilityRating: 3, accessibilityRating: 3,
      likedText: 'Guides were extremely knowledgeable, rhino sightings guaranteed almost', dislikedText: 'Food options near the park are limited',
      tipsText: 'Book the morning jeep safari, not afternoon — animals are far more active early.', visitedDate: daysAgo(18), tripId: findTripId('9876500001', 'Kaziranga') },
    { tourist: priya, dest: 'Pelling', rating: 4,
      reviewText: 'The Kanchenjunga sunrise view from Pelling is worth waking up at 4am for. Pemayangtse Monastery is peaceful and the walk down to Rimbi waterfalls is beautiful.',
      actualCostInr: 2200, timeSpentHours: 8, crowdLevel: 'LOW', cleanlinessRating: 5, feltSafe: 'YES',
      transportRating: 3, foodAvailabilityRating: 4, accessibilityRating: 3,
      likedText: 'Incredibly peaceful, clean mountain air, great monastery architecture', dislikedText: 'Roads are winding and can cause motion sickness',
      tipsText: 'Stay overnight for the sunrise view point — day trips miss the best light.', visitedDate: daysAgo(2) },

    { tourist: rahul, dest: 'Tawang', rating: 5,
      reviewText: 'One of the most breathtaking places in India. The monastery is massive and the drive over Sela Pass is unforgettable, though the altitude hits hard.',
      actualCostInr: 4500, timeSpentHours: 10, crowdLevel: 'LOW', cleanlinessRating: 4, feltSafe: 'YES',
      transportRating: 3, foodAvailabilityRating: 3, accessibilityRating: 2,
      likedText: 'Monastery architecture, war memorial was moving, road trip scenery', dislikedText: 'Altitude sickness hit on day 2, oxygen levels are noticeably lower',
      tipsText: 'Acclimatize in Dirang for a day before pushing to Tawang. Carry warm layers even in summer.', visitedDate: daysAgo(42), tripId: findTripId('9876500002', 'Tawang') },
    { tourist: rahul, dest: 'Kaziranga', rating: 4,
      reviewText: 'Great wildlife density but the roads inside the park get bumpy. Elephant safari felt safer and got closer to the rhinos than the jeep did.',
      actualCostInr: 4000, timeSpentHours: 5, crowdLevel: 'HIGH', cleanlinessRating: 3, feltSafe: 'YES',
      transportRating: 3, foodAvailabilityRating: 3, accessibilityRating: 3,
      likedText: 'Elephant safari access to areas jeeps cannot reach', dislikedText: 'Very crowded during peak winter season, long queues for safari slots',
      tipsText: 'Book safari slots online in advance during Nov-Feb — they sell out by 6am on-site.', visitedDate: daysAgo(75) },

    { tourist: sneha, dest: 'Majuli Island', rating: 5,
      reviewText: "Majuli feels like stepping back in time. The Satra monasteries and mask-making workshops are unlike anything else in India. Ferry ride itself is scenic.",
      actualCostInr: 2800, timeSpentHours: 7, crowdLevel: 'LOW', cleanlinessRating: 4, feltSafe: 'YES',
      transportRating: 3, foodAvailabilityRating: 3, accessibilityRating: 2,
      likedText: 'Authentic culture, mask-making demo, very few tourists', dislikedText: 'Ferry schedules are limited, plan around them carefully',
      tipsText: "Check the ferry timetable a day ahead — missing the last one means staying an extra night.", visitedDate: daysAgo(28), tripId: findTripId('9876500003', 'Majuli Island') },
    { tourist: sneha, dest: 'Tawang', rating: 4,
      reviewText: 'Stunning but logistically demanding. Worth every hour of the drive from Bomdila. The monastery museum has genuinely rare artifacts.',
      actualCostInr: 5000, timeSpentHours: 9, crowdLevel: 'LOW', cleanlinessRating: 4, feltSafe: 'SOMEWHAT',
      transportRating: 2, foodAvailabilityRating: 3, accessibilityRating: 2,
      likedText: 'Monastery museum, mountain scenery on the drive', dislikedText: 'Road conditions past Bomdila are rough, network is patchy',
      tipsText: 'Download offline maps before you lose signal past Dirang.', visitedDate: daysAgo(95) },

    { tourist: aryan, dest: 'Shillong', rating: 4,
      reviewText: 'Shillong has great cafe culture and Umiam Lake is a nice half-day trip. Cleaner and more walkable than I expected for a hill town.',
      actualCostInr: 1800, timeSpentHours: 5, crowdLevel: 'MEDIUM', cleanlinessRating: 4, feltSafe: 'YES',
      transportRating: 4, foodAvailabilityRating: 5, accessibilityRating: 4,
      likedText: 'Cafes, live music scene, Umiam Lake boating', dislikedText: 'Traffic in Police Bazar area gets heavy in the evening',
      tipsText: 'Visit Umiam Lake in the morning before tour buses arrive.', visitedDate: daysAgo(57), tripId: findTripId('9999999999', 'Shillong') },
    { tourist: aryan, dest: 'Cherrapunji (Sohra)', rating: 5,
      reviewText: "Nohkalikai Falls is genuinely one of the most dramatic waterfalls I've seen. The living root bridges near Sohra require a proper trek but it's worth it.",
      actualCostInr: 2400, timeSpentHours: 6, crowdLevel: 'MEDIUM', cleanlinessRating: 4, feltSafe: 'YES',
      transportRating: 3, foodAvailabilityRating: 3, accessibilityRating: 2,
      likedText: 'Nohkalikai Falls, the root bridge trek is a real adventure', dislikedText: 'Fog can roll in fast and cut visibility to near zero',
      tipsText: 'Wear proper trekking shoes for the root bridge trail — it gets slippery even without rain.', visitedDate: daysAgo(56), tripId: findTripId('9999999999', 'Cherrapunji (Sohra)') },
    { tourist: aryan, dest: 'Dzukou Valley', rating: 5,
      reviewText: 'The seasonal flowers in Dzukou Valley in a good bloom year are unreal — rolling green hills with no network for miles. A genuinely remote trek.',
      actualCostInr: 3200, timeSpentHours: 14, crowdLevel: 'LOW', cleanlinessRating: 3, feltSafe: 'SOMEWHAT',
      transportRating: 2, foodAvailabilityRating: 2, accessibilityRating: 1,
      likedText: 'Untouched landscape, total disconnect from network/city', dislikedText: 'No connectivity at all, trek is genuinely tough on the knees',
      tipsText: "Register with a local guide before entering — there's no signal to call for help if something goes wrong.", visitedDate: daysAgo(120) },
  ]

  for (const r of reviews) {
    try {
      const destId = destByName[r.dest].id
      await reviewService.createReview(r.tourist.id, destId, {
        tripId: r.tripId || undefined,
        rating: r.rating, reviewText: r.reviewText, actualCostInr: r.actualCostInr,
        timeSpentHours: r.timeSpentHours, crowdLevel: r.crowdLevel, cleanlinessRating: r.cleanlinessRating,
        feltSafe: r.feltSafe, transportRating: r.transportRating, foodAvailabilityRating: r.foodAvailabilityRating,
        accessibilityRating: r.accessibilityRating, likedText: r.likedText, dislikedText: r.dislikedText,
        tipsText: r.tipsText, visitedDate: r.visitedDate,
      }, [])
      console.log(`  Review: ${r.tourist.full_name} -> ${r.dest} (${r.rating}★)`)
    } catch (err) {
      console.log(`  Skipped review ${r.tourist.full_name} -> ${r.dest}: ${err.message}`)
    }
  }

  console.log('\n── Refreshing scam reports ───────────────────────────────')

  const pool = getPool()
  await pool.query(`DELETE FROM scam_reports WHERE description = 'fake guide'`)

  const scamReports = [
    { tourist: rahul, dest: 'Kaziranga', category: 'OVERCHARGING',
      description: 'A safari "agent" outside the main gate quoted 3x the official jeep safari rate and claimed the ticket counter was closed. The actual counter was open and had availability.',
      incidentDate: daysAgo(74) },
    { tourist: priya, dest: 'Shillong', category: 'FAKE_GUIDE',
      description: 'Someone approached near Police Bazar claiming to be a certified guide for the living root bridges and asked for payment upfront. No ID or certification when asked.',
      incidentDate: daysAgo(58) },
    { tourist: sneha, dest: 'Tawang', category: 'OVERCHARGING',
      description: 'A homestay near the monastery quoted double the rate shown on their own listing once we arrived, citing "peak season" despite it being posted as fixed pricing.',
      incidentDate: daysAgo(96) },
    { tourist: aryan, dest: 'Dzukou Valley', category: 'UNSAFE_AREA',
      description: 'Trail markers past the second rest hut were missing or faded in several spots. Easy to lose the path in fog without a local guide — flagging for future trekkers.',
      incidentDate: daysAgo(120) },
  ]

  for (const s of scamReports) {
    try {
      await scamService.createReport(s.tourist.id, {
        destinationId: destByName[s.dest].id, category: s.category,
        description: s.description, incidentDate: s.incidentDate,
      })
      console.log(`  Scam report: ${s.tourist.full_name} -> ${s.dest} (${s.category})`)
    } catch (err) {
      console.log(`  Skipped scam report: ${err.message}`)
    }
  }

  console.log('\nDone.')
  process.exit(0)
}

main().catch(err => {
  logger.error({ err: { message: err.message, stack: err.stack } }, 'seedDemoContent failed')
  console.error(err)
  process.exit(1)
})
