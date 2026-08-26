// src/services/efirReport.service.js
// Printable record of a filed E-FIR, for an officer to hand to a tourist or
// file alongside a physical station record. Visual conventions (header
// band, section/field helpers, INK/MUTED/ACCENT palette) are deliberately
// copied from incidentReport.service.js rather than shared, matching that
// file's own precedent — see its header comment.
'use strict'

const PDFDocument = require('pdfkit')
const { IncidentRepository } = require('../repositories/incident.repository')
const { ERRORS } = require('../constants/errors')

const INK    = '#0f172a'
const MUTED  = '#64748b'
const ACCENT = '#1a5276'
const RULE   = '#e2e8f0'

const STATUS_COLORS = {
  FILED:                { bg: '#fee2e2', fg: '#b91c1c' },
  ASSIGNED:              { bg: '#fef9c3', fg: '#a16207' },
  UNDER_INVESTIGATION:   { bg: '#dbeafe', fg: '#1d4ed8' },
  RESOLVED:              { bg: '#dcfce7', fg: '#15803d' },
  CLOSED:                { bg: '#f1f5f9', fg: '#475569' },
}
const PRIORITY_COLORS = {
  HIGH:   { bg: '#fee2e2', fg: '#b91c1c' },
  MEDIUM: { bg: '#fef9c3', fg: '#a16207' },
  LOW:    { bg: '#f1f5f9', fg: '#475569' },
}

async function generate(incidentId) {
  const incident = await new IncidentRepository().findById(incidentId)
  if (!incident) throw Object.assign(new Error(ERRORS.INCIDENT_NOT_FOUND), { statusCode: 404 })

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
    Title: `E-FIR — ${incident.case_number}`,
    Author: 'Aaraksha Command Center',
  }})
  const left  = doc.page.margins.left
  const right = doc.page.width - doc.page.margins.right
  const contentWidth = right - left

  // ── Header band ────────────────────────────────────────────────────
  const bandHeight = 92
  doc.rect(0, 0, doc.page.width, bandHeight).fill(INK)
  doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('AARAKSHA', left, 26, { width: contentWidth, align: 'center' })
  doc.fontSize(12).font('Helvetica').fillColor('#cbd5e1').text('Government Command Center — Electronic First Information Report', { width: contentWidth, align: 'center' })
  doc.fontSize(8).fillColor('#94a3b8').text(`${incident.case_number}  ·  Generated ${new Date().toLocaleString('en-IN')}`, { width: contentWidth, align: 'center' })
  doc.fillColor(INK).x = left
  doc.y = bandHeight + 24

  // ── Title strip: category + status + priority badges ──────────────
  doc.fontSize(18).font('Helvetica-Bold').fillColor(INK).text(categoryLabel(incident.category), left, doc.y, { width: contentWidth })
  const badgeY = doc.y + 4
  let x = left
  x = badge(doc, x, badgeY, incident.status.replace(/_/g, ' '), STATUS_COLORS[incident.status] || { bg: '#f1f5f9', fg: MUTED })
  badge(doc, x + 8, badgeY, `${incident.priority} PRIORITY`, PRIORITY_COLORS[incident.priority] || { bg: '#f1f5f9', fg: MUTED })
  doc.fillColor(INK).x = left
  doc.y = badgeY + 30

  // ── Section 1: Complainant ──────────────────────────────────────────
  section(doc, left, contentWidth, '1. Complainant Details')
  field(doc, left, 'Name', incident.full_name || 'Not linked to a tourist account')
  field(doc, left, 'Phone', incident.phone)
  field(doc, left, 'Govt ID', incident.govt_id_suffix ? `•••• ${incident.govt_id_suffix}` : '—')
  if (incident.trip_title) field(doc, left, 'Trip', incident.trip_title)
  doc.moveDown(0.6)

  // ── Section 2: Incident Details ─────────────────────────────────────
  section(doc, left, contentWidth, '2. Incident Details')
  field(doc, left, 'Filed', formatPDFDateTime(incident.filed_at))
  field(doc, left, 'Occurred', incident.incident_occurred_at ? formatPDFDateTime(incident.incident_occurred_at) : 'Not specified')
  field(doc, left, 'Location', incident.location_text || (incident.latitude ? `${Number(incident.latitude).toFixed(5)}, ${Number(incident.longitude).toFixed(5)}` : 'Not specified'))
  doc.fontSize(9).font('Helvetica-Bold').fillColor(MUTED).text('Description:', left, doc.y)
  doc.moveDown(0.15)
  doc.fontSize(9).font('Helvetica').fillColor(INK).text(incident.description, left, doc.y, { width: contentWidth })
  doc.fillColor(INK).x = left
  doc.moveDown(0.6)

  // ── Section 3: Investigation ────────────────────────────────────────
  section(doc, left, contentWidth, '3. Investigation')
  field(doc, left, 'Assigned Officer', incident.assigned_officer_name ? `${incident.assigned_officer_name} (${incident.assigned_officer_role})` : 'Unassigned')
  field(doc, left, 'Assigned', incident.assigned_at ? formatPDFDateTime(incident.assigned_at) : '—')
  field(doc, left, 'Resolution Notes', incident.resolution_notes || 'No notes recorded.')
  field(doc, left, 'Closed', incident.resolved_at ? formatPDFDateTime(incident.resolved_at) : '—')

  // ── Footer ─────────────────────────────────────────────────────────
  doc.moveDown(1.5)
  doc.fontSize(7).fillColor('#94a3b8')
     .text('System-generated from Aaraksha platform records. Not a substitute for a First Information Report filed at a physical police station.', left, doc.y, { width: contentWidth, align: 'center' })
  doc.text('Aaraksha — Smart Tourism, Safe Journey  |  Government Command Center', left, doc.y + 4, { width: contentWidth, align: 'center' })

  doc.end()
  return doc
}

function categoryLabel(category) {
  return (category || 'OTHER').replace(/_/g, ' ')
}

function badge(doc, x, y, text, color) {
  doc.font('Helvetica-Bold').fontSize(10)
  const w = doc.widthOfString(text) + 20
  doc.roundedRect(x, y, w, 20, 10).fill(color.bg)
  doc.fillColor(color.fg).text(text, x + 10, y + 5)
  return x + w
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

function formatPDFDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

module.exports = { generate }
