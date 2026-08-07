// src/services/passport.service.js
'use strict'

const PDFDocument = require('pdfkit')
const { TripRepository }    = require('../repositories/trip.repository')
const { CheckinRepository } = require('../repositories/checkin.repository')
const { SOSRepository }     = require('../repositories/sos.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { ERRORS } = require('../constants/errors')

async function generate(tripId, touristId) {
  const tripRepo    = new TripRepository()
  const checkinRepo = new CheckinRepository()
  const sosRepo     = new SOSRepository()
  const touristRepo = new TouristRepository()

  const [trip, tourist] = await Promise.all([
    tripRepo.findById(tripId, touristId),
    touristRepo.findById(touristId),
  ])
  if (!trip) throw Object.assign(new Error(ERRORS.TRIP_NOT_FOUND), { statusCode: 404 })

  const [checkins, { rows: sosEvents }] = await Promise.all([
    checkinRepo.findByTripId(tripId),
    sosRepo.findByTouristId(touristId, { tripId, limit: 50 }),
  ])

  const stops = Array.isArray(trip.stops) ? trip.stops : JSON.parse(trip.stops || '[]')
  const checklist = Array.isArray(trip.packing_checklist) ? trip.packing_checklist : JSON.parse(trip.packing_checklist || '[]')

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
    Title: `Journey Passport — ${trip.title}`,
    Author: 'Aaraksha Platform',
  }})

  // ── Header ─────────────────────────────────────────────────────────
  doc.fontSize(24).font('Helvetica-Bold').text('AARAKSHA', { align: 'center' })
  doc.fontSize(14).font('Helvetica').text('Digital Journey Passport', { align: 'center' })
  doc.fontSize(9).fillColor('#666').text(`Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'center' })
  doc.moveDown(2).fillColor('#000')

  // ── Section 1: Trip Summary ────────────────────────────────────────
  // PDFKit's standard Helvetica font is WinAnsi-encoded and has no glyph
  // for the ₹ (U+20B9) sign — it silently prints the wrong character
  // instead of throwing, so PDF-only money strings use "Rs." not ₹.
  section(doc, '1. Trip Summary')
  field(doc, 'Trip Name', trip.title)
  field(doc, 'Travel Type', trip.travel_type)
  field(doc, 'Dates', `${formatPDFDate(trip.start_date)} to ${formatPDFDate(trip.end_date)}`)
  field(doc, 'Status', trip.status)
  field(doc, 'Total Destinations', stops.length.toString())
  if (trip.budget_inr) field(doc, 'Budget', `Rs. ${Number(trip.budget_inr).toLocaleString('en-IN')}`)
  doc.moveDown()

  // ── Section 2: Travel Safety Index ────────────────────────────────
  section(doc, '2. Travel Safety Index (TSI)')
  field(doc, 'Score', trip.tsi_score ? `${trip.tsi_score}/100` : 'Not calculated')
  field(doc, 'Risk Level', trip.tsi_label || 'N/A')
  if (trip.tsi_recommendations) {
    const recs = Array.isArray(trip.tsi_recommendations) ? trip.tsi_recommendations : JSON.parse(trip.tsi_recommendations || '[]')
    if (recs.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').text('Recommendations:')
      recs.forEach((r, i) => doc.fontSize(9).font('Helvetica').text(`  ${i+1}. ${r}`))
    }
  }
  doc.moveDown()

  // ── Section 3: Visited Locations ──────────────────────────────────
  section(doc, '3. Itinerary')
  stops.forEach((stop, i) => {
    doc.fontSize(10).font('Helvetica-Bold').text(`  Stop ${i+1}: ${stop.city}, ${stop.state} (${stop.days} days)`)
    if (stop.activities && stop.activities.length > 0) {
      stop.activities.forEach(a => {
        doc.fontSize(9).font('Helvetica').text(`    • ${a.name}${a.cost ? ` — Rs. ${a.cost}` : ''}`)
      })
    }
  })
  doc.moveDown()

  // ── Section 4: Budget ─────────────────────────────────────────────
  section(doc, '4. Budget Summary')
  const totalCost = stops.reduce((s, stop) =>
    s + (stop.activities || []).reduce((as, a) => as + (a.cost || 0), 0), 0)
  field(doc, 'Planned Budget', trip.budget_inr ? `Rs. ${Number(trip.budget_inr).toLocaleString('en-IN')}` : 'Not set')
  field(doc, 'Estimated from Activities', `Rs. ${totalCost.toLocaleString('en-IN')}`)
  doc.moveDown()

  // ── Section 5: Check-in Timeline ─────────────────────────────────
  section(doc, '5. Check-in Timeline')
  if (checkins.length === 0) {
    doc.fontSize(9).font('Helvetica').text('  No check-ins recorded.')
  } else {
    checkins.forEach(c => {
      const dt = new Date(c.created_at).toLocaleString('en-IN')
      const loc = c.latitude ? `(${parseFloat(c.latitude).toFixed(4)}, ${parseFloat(c.longitude).toFixed(4)})` : 'Location not recorded'
      doc.fontSize(9).font('Helvetica').text(`  ${dt}  —  ${c.type}  —  ${loc}${c.message ? '  — ' + c.message : ''}`)
    })
  }
  doc.moveDown()

  // ── Section 6: Safety Events ──────────────────────────────────────
  section(doc, '6. Safety Events (SOS)')
  if (sosEvents.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor('#2d6a4f').text('  ✅ No safety incidents recorded on this trip.')
    doc.fillColor('#000')
  } else {
    sosEvents.forEach(s => {
      const dt = new Date(s.created_at).toLocaleString('en-IN')
      doc.fontSize(9).font('Helvetica')
        .text(`  ${dt}  —  ${s.category}  —  ${s.status}  —  Trigger: ${s.trigger_type}`)
    })
  }
  doc.moveDown()

  // ── Section 7: Achievements ───────────────────────────────────────
  section(doc, '7. Journey Achievements')
  const days = Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / 86400000)
  field(doc, 'Cities Visited',   stops.length.toString())
  field(doc, 'Total Days',       days.toString())
  field(doc, 'Check-ins Made',   checkins.length.toString())
  field(doc, 'Activities',       stops.reduce((s, stop) => s + (stop.activities?.length || 0), 0).toString())
  doc.moveDown()

  // ── Footer ─────────────────────────────────────────────────────────
  doc.fontSize(8).fillColor('#666')
     .text(`Tourist: ${tourist.full_name}  |  Trip ID: ${tripId}  |  Powered by Aaraksha — Smart Tourism Safety`, {
       align: 'center'
     })

  doc.end()
  return doc
}

function section(doc, title) {
  doc.moveDown(0.5)
     .fontSize(12).font('Helvetica-Bold').fillColor('#1a5276')
     .text(title)
     .fillColor('#000').moveDown(0.3)
}

function field(doc, label, value) {
  doc.fontSize(9)
     .font('Helvetica-Bold').text(`${label}: `, { continued: true })
     .font('Helvetica').text(value || '—')
}

function formatPDFDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

module.exports = { generate }
