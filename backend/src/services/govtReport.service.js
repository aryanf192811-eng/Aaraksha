// src/services/govtReport.service.js
'use strict'

const PDFDocument = require('pdfkit')
const { SOSRepository } = require('../repositories/sos.repository')
const { RescueRepository } = require('../repositories/rescue.repository')
const govtService = require('./govt.service')

const PERIOD_LABELS = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' }

async function generateAnalyticsReport(period = '30d') {
  const days = parseInt(period) || 30
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const sosRepo = new SOSRepository()
  const rescueRepo = new RescueRepository()

  const [analytics, recentSOS, riskOverview] = await Promise.all([
    govtService.getAnalytics(period),
    sosRepo.findRecent(15),
    govtService.getRiskOverview(),
  ])

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
    Title: `Aaraksha Incident Response Report — ${PERIOD_LABELS[period] || period}`,
    Author: 'Aaraksha Command Center',
  }})

  // ── Header ─────────────────────────────────────────────────────────
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text('AARAKSHA COMMAND CENTER', { align: 'center' })
  doc.fontSize(13).font('Helvetica').fillColor('#334155').text('Incident Response & Analytics Report', { align: 'center' })
  doc.fontSize(9).fillColor('#64748b')
     .text(`${PERIOD_LABELS[period] || period}  ·  Generated ${new Date().toLocaleString('en-IN')}`, { align: 'center' })
  doc.moveDown(1.5).fillColor('#000')

  // ── Section 1: Summary ────────────────────────────────────────────
  section(doc, '1. Summary')
  const totals = analytics.totals || {}
  summaryRow(doc, [
    ['Total Incidents', String(totals.total ?? 0)],
    ['Resolved', String(totals.resolved ?? 0)],
    ['Still Active', String(totals.active ?? 0)],
    ['Avg Response Time', analytics.avgResponseMinutes != null ? `${analytics.avgResponseMinutes} min` : 'N/A'],
  ])
  doc.moveDown()

  // ── Section 2: Emergency Types ────────────────────────────────────
  section(doc, '2. Emergency Types')
  if (analytics.byCategory.length === 0) {
    doc.fontSize(9).font('Helvetica').text('  No incidents recorded in this period.')
  } else {
    const maxCount = Math.max(...analytics.byCategory.map(c => c.count))
    analytics.byCategory.forEach(c => barRow(doc, c.category, c.count, maxCount))
  }
  doc.moveDown()

  // ── Section 3: Daily Trend ─────────────────────────────────────────
  section(doc, '3. Incidents Per Day')
  if (analytics.perDay.length === 0) {
    doc.fontSize(9).font('Helvetica').text('  No incidents recorded in this period.')
  } else {
    const maxDay = Math.max(...analytics.perDay.map(d => d.count))
    analytics.perDay.forEach(d => barRow(doc, new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), d.count, maxDay))
  }
  doc.moveDown()

  // ── Section 4: District Risk Snapshot ─────────────────────────────
  section(doc, '4. Destination Risk Snapshot (active trips)')
  if (riskOverview.length === 0) {
    doc.fontSize(9).font('Helvetica').text('  No active trips right now.')
  } else {
    riskOverview.forEach(r => {
      doc.fontSize(9).font('Helvetica-Bold').text(`  ${r.city}, ${r.state || '—'}`, { continued: true })
        .font('Helvetica').text(`  —  ${r.total} tourist${r.total === 1 ? '' : 's'}  ·  ${r.solo} solo  ·  ${r.highRisk} high-risk`)
    })
  }
  doc.moveDown()

  // ── Section 5: Recent Incidents ────────────────────────────────────
  section(doc, '5. Recent Incidents')
  if (recentSOS.length === 0) {
    doc.fontSize(9).font('Helvetica').text('  No incidents recorded.')
  } else {
    recentSOS.forEach(s => {
      const dt = new Date(s.created_at).toLocaleString('en-IN')
      doc.fontSize(9).font('Helvetica')
        .text(`  ${dt}  —  ${s.full_name}  —  ${s.category}  —  ${s.status}`)
    })
  }

  // ── Footer ─────────────────────────────────────────────────────────
  doc.moveDown(2)
  doc.fontSize(8).fillColor('#94a3b8')
     .text('Aaraksha — Smart Tourism, Safe Journey  |  Government Command Center', { align: 'center' })

  doc.end()
  return doc
}

function section(doc, title) {
  doc.moveDown(0.5)
     .fontSize(12).font('Helvetica-Bold').fillColor('#1a5276')
     .text(title)
     .fillColor('#000').moveDown(0.3)
}

// Four-column summary stat row, evenly spaced across the content width.
// Anchored to the page's left margin rather than doc.x — after a text()
// call with an explicit x/width, pdfkit's cursor doesn't reliably land
// back at the original left margin, which previously sent the bar chart
// in barRow() drifting off the right edge of the page.
function summaryRow(doc, pairs) {
  const left = doc.page.margins.left
  const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / pairs.length
  const y = doc.y
  pairs.forEach(([label, value], i) => {
    const x = left + i * colWidth
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text(value, x, y, { width: colWidth, align: 'left' })
    doc.fontSize(8).font('Helvetica').fillColor('#64748b').text(label, x, y + 20, { width: colWidth, align: 'left' })
  })
  doc.fillColor('#000').x = left
  doc.y = y + 40
}

// A simple horizontal bar chart drawn with PDFKit primitives — no charting
// library needed for a static report.
function barRow(doc, label, count, max) {
  const left = doc.page.margins.left
  const barMaxWidth = 260
  const barWidth = max > 0 ? Math.max(2, (count / max) * barMaxWidth) : 0
  const y = doc.y
  doc.fontSize(9).font('Helvetica').fillColor('#334155').text(label, left, y, { width: 110 })
  doc.rect(left + 115, y + 1, barWidth, 9).fill('#10b981')
  doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(String(count), left + 115 + barMaxWidth + 8, y, { width: 30 })
  doc.fillColor('#000').x = left
  doc.y = y + 14
}

module.exports = { generateAnalyticsReport }
