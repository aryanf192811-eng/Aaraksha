// src/services/incidentReport.service.js
// Auto-generated E-FIR-style record of a closed SOS event, for a govt
// officer to file or hand to a physically-present agency. Only generated
// once an incident is closed (RESOLVED / FALSE_ALARM) — an open SOS has no
// resolution to report on, and govt.controller.js gates on that before
// calling here. Visual conventions (header band, section/field/statRow
// helpers, INK/MUTED/ACCENT palette) are copied from passport.service.js
// deliberately, so the two PDFs this platform hands to a human read as one
// family rather than two unrelated one-off exports.
'use strict'

const PDFDocument = require('pdfkit')
const { SOSRepository }     = require('../repositories/sos.repository')
const { CheckinRepository } = require('../repositories/checkin.repository')
const { ERRORS } = require('../constants/errors')

const INK    = '#0f172a'
const MUTED  = '#64748b'
const ACCENT = '#1a5276'
const RULE   = '#e2e8f0'

const STATUS_COLORS = {
  RESOLVED:     { bg: '#dcfce7', fg: '#15803d' },
  FALSE_ALARM:  { bg: '#f1f5f9', fg: '#475569' },
  ASSIGNED:     { bg: '#fef9c3', fg: '#a16207' },
  ACTIVE:       { bg: '#fee2e2', fg: '#b91c1c' },
}
const TSI_COLORS = {
  'Low Risk':      { bg: '#dcfce7', fg: '#15803d' },
  'Moderate Risk': { bg: '#fef9c3', fg: '#a16207' },
  'High Risk':     { bg: '#ffedd5', fg: '#c2410c' },
  'Extreme Risk':  { bg: '#fee2e2', fg: '#b91c1c' },
}
const CLOSED_STATUSES = new Set(['RESOLVED', 'FALSE_ALARM'])

async function generate(sosId) {
  const sosRepo = new SOSRepository()
  const sos = await sosRepo.findByIdWithFullDetail(sosId)
  if (!sos) throw Object.assign(new Error(ERRORS.SOS_NOT_FOUND), { statusCode: 404 })
  if (!CLOSED_STATUSES.has(sos.status)) {
    throw Object.assign(new Error('Incident report is available once this SOS is resolved or marked a false alarm'), { statusCode: 400 })
  }

  const checkins = sos.trip_id
    ? await new CheckinRepository().findByTripId(sos.trip_id)
    : []

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
    Title: `Incident Report — ${caseId(sos.id)}`,
    Author: 'Aaraksha Command Center',
  }})
  const left  = doc.page.margins.left
  const right = doc.page.width - doc.page.margins.right
  const contentWidth = right - left

  // ── Header band ────────────────────────────────────────────────────
  const bandHeight = 92
  doc.rect(0, 0, doc.page.width, bandHeight).fill(INK)
  doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('AARAKSHA', left, 26, { width: contentWidth, align: 'center' })
  doc.fontSize(12).font('Helvetica').fillColor('#cbd5e1').text('Government Command Center — Incident Report', { width: contentWidth, align: 'center' })
  doc.fontSize(8).fillColor('#94a3b8').text(`Case ${caseId(sos.id)}  ·  Generated ${new Date().toLocaleString('en-IN')}`, { width: contentWidth, align: 'center' })
  doc.fillColor(INK).x = left
  doc.y = bandHeight + 24

  // ── Title strip: category + status badge ──────────────────────────
  doc.fontSize(18).font('Helvetica-Bold').fillColor(INK).text(categoryLabel(sos.category), left, doc.y, { width: contentWidth })
  const statusColor = STATUS_COLORS[sos.status] || { bg: '#f1f5f9', fg: MUTED }
  const badgeY = doc.y + 4
  doc.font('Helvetica-Bold').fontSize(10)
  const labelWidth = doc.widthOfString(sos.status) + 20
  doc.roundedRect(left, badgeY, labelWidth, 20, 10).fill(statusColor.bg)
  doc.fillColor(statusColor.fg).text(sos.status, left + 10, badgeY + 5)
  doc.fillColor(INK).x = left
  doc.y = badgeY + 30

  // ── Section 1: Incident Summary ────────────────────────────────────
  section(doc, left, contentWidth, '1. Incident Summary')
  const respondedMin = sos.assigned_at ? minutesBetween(sos.created_at, sos.assigned_at) : null
  const closedMin = minutesBetween(sos.created_at, sos.resolved_at || sos.assignment_resolved_at)
  statRow(doc, left, contentWidth, [
    ['Trigger', triggerLabel(sos.trigger_type)],
    ['Response Time', respondedMin != null ? `${respondedMin} min` : 'Not dispatched'],
    ['Time to Close', closedMin != null ? `${closedMin} min` : '—'],
    ['Battery at Trigger', sos.battery_pct != null ? `${sos.battery_pct}%` : '—'],
  ])
  field(doc, left, 'Opened', formatPDFDateTime(sos.created_at))
  field(doc, left, 'Closed', sos.resolved_at ? formatPDFDateTime(sos.resolved_at) : '—')
  field(doc, left, 'Coordinates', `${Number(sos.latitude).toFixed(5)}, ${Number(sos.longitude).toFixed(5)}${sos.is_stale_location ? '  (stale fix)' : ''}`)
  if (sos.message) field(doc, left, 'Reported Message', sos.message)
  doc.moveDown(0.6)

  // ── Section 2: Tourist Details ─────────────────────────────────────
  section(doc, left, contentWidth, '2. Tourist Details')
  field(doc, left, 'Name', sos.full_name)
  field(doc, left, 'Phone', sos.phone)
  field(doc, left, 'Blood Group', sos.blood_group)
  field(doc, left, 'Govt ID', sos.govt_id_suffix ? `•••• ${sos.govt_id_suffix}` : '—')
  if (sos.medical_info) field(doc, left, 'Medical Notes', sos.medical_info)
  const contacts = Array.isArray(sos.emergency_contacts) ? sos.emergency_contacts : JSON.parse(sos.emergency_contacts || '[]')
  if (contacts.length > 0) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(MUTED).text('Emergency Contacts:', left, doc.y)
    doc.moveDown(0.15)
    contacts.forEach(c => bullet(doc, left + 10, `${c.name} (${c.relation}) — ${c.phone}`))
  }
  doc.moveDown(0.6)

  // ── Section 3: Trip & Risk Context ─────────────────────────────────
  section(doc, left, contentWidth, '3. Trip & Risk Context')
  if (sos.trip_id) {
    field(doc, left, 'Active Trip', sos.trip_title)
    const scoreY = doc.y
    doc.fontSize(9).font('Helvetica-Bold').fillColor(MUTED).text('TSI at time of incident:', left, scoreY, { continued: true })
    doc.font('Helvetica').fillColor(INK).text(sos.tsi_score != null ? ` ${sos.tsi_score}/100` : ' —')
    if (sos.tsi_label) {
      const tsiColor = TSI_COLORS[sos.tsi_label] || { bg: '#f1f5f9', fg: MUTED }
      doc.font('Helvetica-Bold').fontSize(9)
      const w = doc.widthOfString(sos.tsi_label) + 16
      const y = doc.y + 2
      doc.roundedRect(left, y, w, 16, 8).fill(tsiColor.bg)
      doc.fillColor(tsiColor.fg).fontSize(8).text(sos.tsi_label, left + 8, y + 4)
      doc.fillColor(INK).x = left
      doc.y = y + 22
    }
  } else {
    doc.fontSize(9).font('Helvetica').fillColor(MUTED).text('No active trip was linked to this SOS.', left, doc.y)
    doc.fillColor(INK).x = left
  }
  doc.moveDown(0.6)

  // ── Section 4: Response Timeline ───────────────────────────────────
  section(doc, left, contentWidth, '4. Response Timeline')
  timelineEntry(doc, left, 'SOS triggered', formatPDFDateTime(sos.created_at), triggerLabel(sos.trigger_type))
  if (sos.assigned_at) {
    const rescuerLine = sos.rescuer_name
      ? `${sos.rescuer_name} (${sos.rescuer_type === 'VOLUNTEER' ? 'Volunteer' : sos.rescuer_type})${sos.rescuer_phone ? ` · ${sos.rescuer_phone}` : ''}`
      : 'Rescuer unassigned'
    timelineEntry(doc, left, 'Rescuer dispatched', formatPDFDateTime(sos.assigned_at), rescuerLine)
    if (sos.assigned_by_name) {
      field(doc, left + 14, 'Dispatched by', `${sos.assigned_by_name} (${sos.assigned_by_role})`)
    }
  } else {
    doc.fontSize(9).font('Helvetica-Italic').fillColor(MUTED).text('  No rescuer was dispatched before this incident closed.', left, doc.y)
    doc.fillColor(INK).x = left
    doc.moveDown(0.3)
  }
  if (sos.resolved_at) {
    timelineEntry(doc, left, sos.status === 'FALSE_ALARM' ? 'Marked false alarm' : 'Incident resolved', formatPDFDateTime(sos.resolved_at), null)
  }
  doc.moveDown(0.6)

  // ── Section 5: Resolution ──────────────────────────────────────────
  section(doc, left, contentWidth, '5. Resolution')
  field(doc, left, 'Final Status', sos.status)
  field(doc, left, 'Resolution Notes', sos.resolution_notes || 'No notes recorded.')
  doc.moveDown(0.6)

  // ── Section 6: Known Location Trail ────────────────────────────────
  section(doc, left, contentWidth, '6. Known Location Trail')
  doc.fontSize(8).font('Helvetica').fillColor(MUTED)
     .text('Check-ins logged on the linked trip, not a continuous GPS track — Aaraksha does not record background location history outside of check-ins and Dead Man\'s Switch pings.', left, doc.y, { width: contentWidth })
  doc.fillColor(INK).x = left
  doc.moveDown(0.4)
  if (checkins.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(MUTED).text('  No check-ins recorded on this trip.', left, doc.y)
    doc.fillColor(INK).x = left
  } else {
    checkins.slice(-10).forEach(c => {
      doc.fontSize(9).font('Helvetica').fillColor('#334155')
        .text(`  ${formatPDFDateTime(c.created_at)}  —  ${c.type}${c.latitude ? `  —  ${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}` : ''}`, left, doc.y)
    })
    doc.fillColor(INK).x = left
  }

  // ── Footer ─────────────────────────────────────────────────────────
  doc.moveDown(1.5)
  doc.fontSize(7).fillColor('#94a3b8')
     .text('System-generated from Aaraksha platform records for internal government use. Not a substitute for a formal First Information Report.', left, doc.y, { width: contentWidth, align: 'center' })
  doc.text('Aaraksha — Smart Tourism, Safe Journey  |  Government Command Center', left, doc.y + 4, { width: contentWidth, align: 'center' })

  doc.end()
  return doc
}

function caseId(uuid) {
  return `SOS-${uuid.slice(0, 8).toUpperCase()}`
}

function categoryLabel(category) {
  return (category || 'OTHER').replace(/_/g, ' ')
}

function triggerLabel(trigger) {
  return { MANUAL: 'Manual SOS', DEAD_MANS_SWITCH: "Dead Man's Switch timeout", SMS_INBOUND: 'Offline SOS (SMS)' }[trigger] || trigger
}

function minutesBetween(from, to) {
  if (!from || !to) return null
  return Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000))
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
    doc.fontSize(13).font('Helvetica-Bold').fillColor(INK).text(value, x, y, { width: colWidth })
    doc.fontSize(8).font('Helvetica').fillColor(MUTED).text(label, x, y + 18, { width: colWidth })
  })
  doc.fillColor(INK).x = left
  doc.y = y + 38
}

function timelineEntry(doc, left, label, when, detail) {
  const y = doc.y
  doc.circle(left + 3, y + 5, 3).fill(ACCENT)
  doc.fontSize(9).font('Helvetica-Bold').fillColor(INK).text(label, left + 14, y, { continued: true })
  doc.font('Helvetica').fillColor(MUTED).text(`  —  ${when}`)
  if (detail) doc.fontSize(9).font('Helvetica').fillColor('#334155').text(detail, left + 14, doc.y)
  doc.fillColor(INK).x = left
  doc.moveDown(0.3)
}

function formatPDFDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

module.exports = { generate }
