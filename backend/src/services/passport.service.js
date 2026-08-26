// src/services/passport.service.js
'use strict'

const PDFDocument = require('pdfkit')
const { TripRepository }    = require('../repositories/trip.repository')
const { CheckinRepository } = require('../repositories/checkin.repository')
const { SOSRepository }     = require('../repositories/sos.repository')
const { TouristRepository } = require('../repositories/tourist.repository')
const { ERRORS } = require('../constants/errors')
const { sha256Hex } = require('../utils/crypto')

const INK       = '#0f172a'
const MUTED     = '#64748b'
const ACCENT    = '#1a5276'
const RULE      = '#e2e8f0'
const SAFE      = '#15803d'

const TSI_COLORS = {
  'Low Risk':      { bg: '#dcfce7', fg: '#15803d' },
  'Moderate Risk': { bg: '#fef9c3', fg: '#a16207' },
  'High Risk':     { bg: '#ffedd5', fg: '#c2410c' },
  'Extreme Risk':  { bg: '#fee2e2', fg: '#b91c1c' },
}

// Shared by generate() and getIntegrityHash() so the PDF's printed hash and
// the standalone API always fetch (and therefore hash) identical data —
// duplicating the fetch would risk the two drifting out of sync silently.
async function fetchJourneyRecords(tripId, touristId) {
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
  return { trip, tourist, checkins, sosEvents, stops }
}

// ── Journey Integrity Hash ──────────────────────────────────────────────
// A SHA-256 hash chain over the trip's deterministic record — itinerary,
// then every check-in and SOS event in true chronological order (checkins
// and SOS events are fetched pre-sorted but in OPPOSITE directions and from
// separate tables, so they're re-merged by timestamp here rather than
// trusted as already-interleaved). Genesis block is the trip's own
// unchanging facts; each event folds the previous hash in, so altering,
// removing, or reordering a single check-in or SOS record anywhere in the
// trip's history changes the final hash. Deliberately excludes the PDF's
// own "Generated <now>" render timestamp and the tourist's name — those
// aren't part of the journey record, just presentation.
function canonicalStops(stops) {
  return (stops || []).map(s => ({
    city: s.city, state: s.state, days: s.days,
    activities: (s.activities || []).map(a => ({ name: a.name, cost: a.cost || 0 })),
  }))
}

function tripCoreRecord(trip, stops) {
  return {
    tripId: trip.id,
    title: trip.title,
    startDate: trip.start_date,
    endDate: trip.end_date,
    travelType: trip.travel_type,
    budgetInr: trip.budget_inr,
    tsiScore: trip.tsi_score,
    tsiLabel: trip.tsi_label,
    stops: canonicalStops(stops),
  }
}

// Postgres timestamps can collide at the millisecond an app-server clock
// resolves to, so `id` (a UUID, stable and unique) breaks ties rather than
// leaving merge order to sort() implementation details.
function mergeEventsChronologically(checkins, sosEvents) {
  const checkinEvents = (checkins || []).map(c => ({
    kind: 'CHECKIN', id: c.id, at: new Date(c.created_at).toISOString(),
    type: c.type,
    lat: c.latitude != null ? Number(c.latitude) : null,
    lng: c.longitude != null ? Number(c.longitude) : null,
    message: c.message || null,
  }))
  const sosEventsCanon = (sosEvents || []).map(s => ({
    kind: 'SOS', id: s.id, at: new Date(s.created_at).toISOString(),
    category: s.category, status: s.status, triggerType: s.trigger_type,
  }))
  return [...checkinEvents, ...sosEventsCanon].sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

function computeIntegrityChain(trip, stops, checkins, sosEvents) {
  const genesisHash = sha256Hex(JSON.stringify(tripCoreRecord(trip, stops)))
  const events = mergeEventsChronologically(checkins, sosEvents)
  const finalHash = events.reduce((hash, ev) => sha256Hex(`${hash}|${JSON.stringify(ev)}`), genesisHash)
  return { genesisHash, finalHash, eventCount: events.length }
}

// Groups of 8 hex chars, matching how the analytics/incident-report PDFs
// already break up long identifiers for on-page readability.
function formatHashDisplay(hash) {
  return hash.match(/.{1,8}/g).join('  ')
}

async function getIntegrityHash(tripId, touristId) {
  const { trip, checkins, sosEvents, stops } = await fetchJourneyRecords(tripId, touristId)
  const chain = computeIntegrityChain(trip, stops, checkins, sosEvents)
  return { tripId, ...chain }
}

async function generate(tripId, touristId) {
  const { trip, tourist, checkins, sosEvents, stops } = await fetchJourneyRecords(tripId, touristId)
  const integrity = computeIntegrityChain(trip, stops, checkins, sosEvents)

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
    Title: `Journey Passport — ${trip.title}`,
    Author: 'Aaraksha Platform',
  }})
  const left  = doc.page.margins.left
  const right = doc.page.width - doc.page.margins.right
  const contentWidth = right - left

  // ── Header band ────────────────────────────────────────────────────
  const bandHeight = 92
  doc.rect(0, 0, doc.page.width, bandHeight).fill(INK)
  doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('AARAKSHA', left, 26, { width: contentWidth, align: 'center' })
  doc.fontSize(12).font('Helvetica').fillColor('#cbd5e1').text('Digital Journey Passport', { width: contentWidth, align: 'center' })
  doc.fontSize(8).fillColor('#94a3b8').text(`Generated ${new Date().toLocaleString('en-IN')}`, { width: contentWidth, align: 'center' })
  doc.fillColor(INK).x = left
  doc.y = bandHeight + 24

  // ── Trip title strip ──────────────────────────────────────────────
  doc.fontSize(18).font('Helvetica-Bold').fillColor(INK).text(trip.title, left, doc.y, { width: contentWidth })
  doc.fontSize(10).font('Helvetica').fillColor(MUTED)
     .text(`${formatPDFDate(trip.start_date)} — ${formatPDFDate(trip.end_date)}  ·  ${trip.travel_type}  ·  ${stops.length} destination${stops.length === 1 ? '' : 's'}`)
  doc.moveDown(1)

  // ── Section 1: Travel Safety Index (TSI) — badge front and center ─
  section(doc, left, contentWidth, 'Travel Safety Index')
  const tsiColor = TSI_COLORS[trip.tsi_label] || { bg: '#f1f5f9', fg: MUTED }
  const scoreY = doc.y
  doc.fontSize(28).font('Helvetica-Bold').fillColor(INK).text(trip.tsi_score != null ? `${trip.tsi_score}` : '—', left, scoreY, { continued: true })
  doc.fontSize(12).font('Helvetica').fillColor(MUTED).text('/100')
  // The score line's own height already advanced doc.y past it — start the
  // badge on a fresh line below rather than at a fixed offset from scoreY,
  // which previously overlapped the two when the score text ran tall.
  const badgeY = doc.y + 6
  if (trip.tsi_label) {
    // widthOfString ignores a {font, size} options override (measures using
    // whatever font/size is currently set on the doc) — set them first,
    // then measure, rather than trusting the option to do it.
    doc.font('Helvetica-Bold').fontSize(10)
    const labelWidth = doc.widthOfString(trip.tsi_label) + 20
    doc.roundedRect(left, badgeY, labelWidth, 20, 10).fill(tsiColor.bg)
    doc.fillColor(tsiColor.fg).text(trip.tsi_label, left + 10, badgeY + 5)
  }
  doc.fillColor(INK).x = left
  doc.y = badgeY + 30
  if (trip.tsi_recommendations) {
    const recs = Array.isArray(trip.tsi_recommendations) ? trip.tsi_recommendations : JSON.parse(trip.tsi_recommendations || '[]')
    if (recs.length > 0) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor(INK).text('Recommendations')
      recs.forEach(r => bullet(doc, left, r))
    }
  }
  doc.moveDown()

  // ── Section 2: Itinerary ───────────────────────────────────────────
  section(doc, left, contentWidth, 'Itinerary')
  stops.forEach((stop, i) => {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(INK).text(`${i + 1}.  ${stop.city}, ${stop.state}`, left, doc.y, { continued: true })
    doc.font('Helvetica').fillColor(MUTED).text(`   ${stop.days} day${stop.days === 1 ? '' : 's'}`)
    if (stop.activities && stop.activities.length > 0) {
      stop.activities.forEach(a => bullet(doc, left + 14, `${a.name}${a.cost ? ` — Rs. ${a.cost}` : ''}`))
    }
  })
  doc.moveDown()

  // ── Section 3: Budget ─────────────────────────────────────────────
  section(doc, left, contentWidth, 'Budget Summary')
  const totalCost = stops.reduce((s, stop) =>
    s + (stop.activities || []).reduce((as, a) => as + (a.cost || 0), 0), 0)
  field(doc, left, 'Planned Budget', trip.budget_inr ? `Rs. ${Number(trip.budget_inr).toLocaleString('en-IN')}` : 'Not set')
  field(doc, left, 'Estimated from Activities', `Rs. ${totalCost.toLocaleString('en-IN')}`)
  doc.moveDown()

  // ── Section 4: Check-in Timeline ─────────────────────────────────
  section(doc, left, contentWidth, 'Check-in Timeline')
  if (checkins.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(MUTED).text('No check-ins recorded.')
  } else {
    checkins.forEach(c => {
      const dt = new Date(c.created_at).toLocaleString('en-IN')
      const loc = c.latitude ? `(${parseFloat(c.latitude).toFixed(4)}, ${parseFloat(c.longitude).toFixed(4)})` : 'Location not recorded'
      bullet(doc, left, `${dt}  —  ${c.type}  —  ${loc}${c.message ? '  — ' + c.message : ''}`)
    })
  }
  doc.moveDown()

  // ── Section 5: Safety Events ──────────────────────────────────────
  section(doc, left, contentWidth, 'Safety Events (SOS)')
  if (sosEvents.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(SAFE).text('No safety incidents recorded on this trip.')
    doc.fillColor(INK)
  } else {
    sosEvents.forEach(s => {
      const dt = new Date(s.created_at).toLocaleString('en-IN')
      bullet(doc, left, `${dt}  —  ${s.category}  —  ${s.status}  —  Trigger: ${s.trigger_type}`)
    })
  }
  doc.moveDown()

  // ── Section 6: Journey Achievements ───────────────────────────────
  section(doc, left, contentWidth, 'Journey Achievements')
  const days = Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / 86400000)
  statRow(doc, left, contentWidth, [
    ['Cities Visited', stops.length.toString()],
    ['Total Days', days.toString()],
    ['Check-ins Made', checkins.length.toString()],
    ['Activities', stops.reduce((s, stop) => s + (stop.activities?.length || 0), 0).toString()],
  ])

  // ── Section 7: Journey Integrity Hash ─────────────────────────────
  section(doc, left, contentWidth, 'Journey Integrity Hash')
  doc.fontSize(8).font('Helvetica').fillColor(MUTED)
     .text("A tamper-evident fingerprint chained from this trip's itinerary and every recorded check-in and safety event, in order. Changing, removing, or reordering any one of them changes this hash — it can be independently recomputed from Aaraksha's platform records to verify this document hasn't been altered.",
       left, doc.y, { width: contentWidth })
  doc.moveDown(0.5)
  doc.fontSize(10).font('Courier-Bold').fillColor(INK)
     .text(formatHashDisplay(integrity.finalHash), left, doc.y, { width: contentWidth })
  doc.moveDown(0.2)
  doc.fontSize(7).font('Helvetica').fillColor(MUTED)
     .text(`SHA-256 · ${integrity.eventCount} chained event${integrity.eventCount === 1 ? '' : 's'}`, left, doc.y)
  doc.fillColor(INK)

  // ── Footer ─────────────────────────────────────────────────────────
  const footerY = doc.page.height - doc.page.margins.bottom - 24
  doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor(RULE).lineWidth(1).stroke()
  doc.fontSize(8).fillColor(MUTED)
     .text(`${tourist.full_name}  ·  Trip ID ${tripId}  ·  Aaraksha — Smart Tourism, Safe Journey`,
       left, footerY + 8, { width: contentWidth, align: 'center' })

  doc.end()
  return doc
}

function section(doc, left, contentWidth, title) {
  doc.moveDown(0.4)
  const y = doc.y
  doc.rect(left, y + 2, 3, 12).fill(ACCENT)
  doc.fontSize(12).font('Helvetica-Bold').fillColor(INK).text(title, left + 10, y)
  doc.moveDown(0.3)
  doc.moveTo(left, doc.y).lineTo(left + contentWidth, doc.y).strokeColor(RULE).lineWidth(1).stroke()
  doc.moveDown(0.4)
  doc.fillColor(INK).x = left
}

function field(doc, left, label, value) {
  doc.fontSize(9)
     .font('Helvetica-Bold').fillColor(MUTED).text(`${label}:`, left, doc.y, { continued: true })
     .font('Helvetica').fillColor(INK).text(` ${value || '—'}`)
  doc.x = left
}

function bullet(doc, x, text) {
  doc.fontSize(9).font('Helvetica').fillColor('#334155').text(`•  ${text}`, x, doc.y, { width: doc.page.width - doc.page.margins.right - x })
  doc.x = doc.page.margins.left
}

// Four-column stat row, evenly spaced across the content width.
function statRow(doc, left, contentWidth, pairs) {
  const colWidth = contentWidth / pairs.length
  const y = doc.y
  pairs.forEach(([label, value], i) => {
    const x = left + i * colWidth
    doc.fontSize(18).font('Helvetica-Bold').fillColor(INK).text(value, x, y, { width: colWidth })
    doc.fontSize(8).font('Helvetica').fillColor(MUTED).text(label, x, y + 22, { width: colWidth })
  })
  doc.fillColor(INK).x = left
  doc.y = y + 44
}

function formatPDFDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

module.exports = { generate, getIntegrityHash }
