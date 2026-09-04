'use strict'
const govtService = require('../services/govt.service')
const govtReportService = require('../services/govtReport.service')
const incidentReportService = require('../services/incidentReport.service')
const checkpointService = require('../services/checkpoint.service')
const newsService = require('../services/news.service')
const anomalyService = require('../services/anomaly.service')
const incidentService = require('../services/incident.service')
const efirReportService = require('../services/efirReport.service')
const handoffService = require('../services/handoff.service')
const trustScoreService = require('../services/trustScore.service')
const sosClusterService = require('../services/sosCluster.service')
const ntnService = require('../services/ntn.service')
const { sendSuccess, sendPaginated } = require('../utils/response')
const { parsePaginationParams } = require('../utils/pagination')
const logger = require('../utils/logger')

const getDashboard    = async (req, res, next) => { try { sendSuccess(res, await govtService.getDashboard()) } catch (err) { next(err) } }
const getLiveTourists = async (req, res, next) => { try { sendSuccess(res, await govtService.getLiveTourists()) } catch (err) { next(err) } }
const getRiskOverview = async (req, res, next) => { try { sendSuccess(res, await govtService.getRiskOverview()) } catch (err) { next(err) } }
const getRiskModelInfo = async (req, res, next) => {
  try {
    const info = govtService.getRiskModelInfo()
    if (!info) return sendSuccess(res, null, 'Risk model not trained yet — run scripts/trainRiskModel.js')
    sendSuccess(res, info)
  } catch (err) { next(err) }
}
const getRescueTeams  = async (req, res, next) => { try { sendSuccess(res, await govtService.getRescueTeams()) } catch (err) { next(err) } }
const getAnalytics    = async (req, res, next) => { try { sendSuccess(res, await govtService.getAnalytics(req.query.period)) } catch (err) { next(err) } }

const exportAnalyticsReport = async (req, res, next) => {
  try {
    const period = req.query.period || '30d'
    const pdfStream = await govtReportService.generateAnalyticsReport(period)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="aaraksha-report-${period}-${Date.now()}.pdf"`)
    pdfStream.pipe(res)
    pdfStream.on('error', err => { logger.error({ err: err.message }, 'Analytics report PDF stream error'); next(err) })
  } catch (err) { next(err) }
}

const downloadIncidentReport = async (req, res, next) => {
  try {
    const pdfStream = await incidentReportService.generate(req.params.id)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="aaraksha-incident-${req.params.id.slice(0, 8)}.pdf"`)
    pdfStream.pipe(res)
    pdfStream.on('error', err => { logger.error({ err: err.message }, 'Incident report PDF stream error'); next(err) })
  } catch (err) { next(err) }
}

const getActiveSOS = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query)
    const { rows, total } = await govtService.getActiveSOS({ ...req.query, limit, offset })
    sendPaginated(res, rows, total, page, limit)
  } catch (err) { next(err) }
}

const assignRescue = async (req, res, next) => {
  try {
    const { teamId, volunteerId, notes } = req.validatedBody
    const result = await govtService.assignRescue(req.params.id, req.govtUser.id, { teamId, volunteerId }, notes)
    sendSuccess(res, result, volunteerId ? 'Volunteer assigned' : 'Rescue team assigned')
  } catch (err) { next(err) }
}

const getNearbyRescuers = async (req, res, next) => {
  try { sendSuccess(res, await govtService.getNearbyRescuers(req.params.id)) } catch (err) { next(err) }
}

const getActiveRescuers = async (req, res, next) => {
  try { sendSuccess(res, await govtService.getActiveRescuers()) } catch (err) { next(err) }
}

const resolveSOS = async (req, res, next) => {
  try {
    const { resolutionNotes, overrideReason } = req.validatedBody
    const sos = await govtService.resolveSOS(req.params.id, resolutionNotes, req.govtUser.id, overrideReason)
    sendSuccess(res, sos, 'SOS resolved')
  } catch (err) { next(err) }
}

const confirmFraudulentSOS = async (req, res, next) => {
  try {
    const result = await govtService.confirmFraudulentSOS(req.params.id, req.govtUser.id, req.validatedBody.reason)
    sendSuccess(res, result, 'Confirmed fraudulent — trust score updated')
  } catch (err) { next(err) }
}

const getPendingAppeals = async (req, res, next) => {
  try {
    const appeals = await trustScoreService.getPendingAppeals()
    sendSuccess(res, appeals)
  } catch (err) { next(err) }
}

const decideAppeal = async (req, res, next) => {
  try {
    const { decision, resolutionNotes } = req.validatedBody
    const appeal = await trustScoreService.decideAppeal(req.params.id, decision, req.govtUser.id, resolutionNotes)
    sendSuccess(res, appeal, `Appeal ${decision === 'APPROVE' ? 'approved' : 'rejected'}`)
  } catch (err) { next(err) }
}

const getRecentNTNActivity = async (req, res, next) => {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10), 200) : 20
    const days = req.query.days ? parseInt(req.query.days, 10) : null
    const messages = await ntnService.getRecentMessages(limit, days)
    sendSuccess(res, messages)
  } catch (err) { next(err) }
}

const getRecentSOSActivity = async (req, res, next) => {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10), 200) : 5
    const days = req.query.days ? parseInt(req.query.days, 10) : null
    const events = await govtService.getRecentSOSActivity(limit, days)
    sendSuccess(res, events)
  } catch (err) { next(err) }
}

const getOpenClusters = async (req, res, next) => {
  try {
    const clusters = await sosClusterService.getOpenClusters()
    sendSuccess(res, clusters)
  } catch (err) { next(err) }
}

const resolveCluster = async (req, res, next) => {
  try {
    const { decision, resolutionNotes } = req.validatedBody
    const cluster = await sosClusterService.resolveCluster(req.params.id, decision, req.govtUser.id, resolutionNotes)
    sendSuccess(res, cluster, 'Cluster resolved')
  } catch (err) { next(err) }
}

const verifyHandoffRelay = async (req, res, next) => {
  try {
    const sos = await handoffService.verifyHandoffAsTeamRelay(req.params.id, req.validatedBody.code)
    sendSuccess(res, sos, 'Handoff verified')
  } catch (err) { next(err) }
}

const getAnomalies = async (req, res, next) => {
  try {
    sendSuccess(res, await anomalyService.getOpenAnomalies())
  } catch (err) { next(err) }
}

const resolveAnomaly = async (req, res, next) => {
  try {
    const anomaly = await anomalyService.resolveAnomaly(req.params.id, req.govtUser.id)
    sendSuccess(res, anomaly, 'Anomaly resolved')
  } catch (err) { next(err) }
}

const getIncidentQueue = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query)
    const assignedOfficerId = req.query.assignedToMe === 'true' ? req.govtUser.id : req.query.assignedOfficerId
    const { rows, total } = await incidentService.getQueue({ ...req.query, assignedOfficerId, limit, offset })
    sendPaginated(res, rows, total, page, limit)
  } catch (err) { next(err) }
}

const getIncident = async (req, res, next) => {
  try { sendSuccess(res, await incidentService.getIncident(req.params.id)) } catch (err) { next(err) }
}

const getAssignableOfficers = async (req, res, next) => {
  try { sendSuccess(res, await incidentService.getAssignableOfficers()) } catch (err) { next(err) }
}

const assignIncident = async (req, res, next) => {
  try {
    const incident = await incidentService.assignIncident(req.params.id, req.govtUser.id, req.validatedBody.officerId)
    sendSuccess(res, incident, 'Incident assigned')
  } catch (err) { next(err) }
}

const updateIncidentStatus = async (req, res, next) => {
  try {
    const { status, resolutionNotes, priority } = req.validatedBody
    const incident = await incidentService.updateStatus(req.params.id, status, resolutionNotes, priority)
    sendSuccess(res, incident, 'Incident status updated')
  } catch (err) { next(err) }
}

const downloadEfirReport = async (req, res, next) => {
  try {
    const pdfStream = await efirReportService.generate(req.params.id)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="aaraksha-efir-${req.params.id.slice(0, 8)}.pdf"`)
    pdfStream.pipe(res)
    pdfStream.on('error', err => { logger.error({ err: err.message }, 'E-FIR PDF stream error'); next(err) })
  } catch (err) { next(err) }
}

const updateTeamStatus = async (req, res, next) => {
  try {
    const team = await govtService.updateTeamStatus(req.params.id, req.validatedBody.status)
    sendSuccess(res, team, 'Team status updated')
  } catch (err) { next(err) }
}

const scanCheckpoint = async (req, res, next) => {
  try {
    const { token, checkpointName, district, latitude, longitude } = req.validatedBody
    const result = await checkpointService.scanCheckpoint(token, req.govtUser.id, checkpointName, district, latitude, longitude)
    sendSuccess(res, result, 'Checkpoint scan recorded')
  } catch (err) { next(err) }
}

const getRecentCheckpointScans = async (req, res, next) => {
  try {
    const scans = await checkpointService.getRecentScans(parseInt(req.query.limit, 10) || 20)
    sendSuccess(res, scans)
  } catch (err) { next(err) }
}

const postDestinationNews = async (req, res, next) => {
  try {
    const news = await newsService.postNews(req.params.id, req.validatedBody, req.govtUser.id)
    sendSuccess(res, news, 'News posted', 201)
  } catch (err) { next(err) }
}

const getPendingVolunteers = async (req, res, next) => {
  try { sendSuccess(res, await govtService.getPendingVolunteers()) } catch (err) { next(err) }
}

const getAllVolunteers = async (req, res, next) => {
  try { sendSuccess(res, await govtService.getAllVolunteers()) } catch (err) { next(err) }
}

const createVolunteer = async (req, res, next) => {
  try {
    const result = await govtService.createVolunteer(req.validatedBody)
    sendSuccess(res, result, 'Volunteer account created', 201)
  } catch (err) { next(err) }
}

const verifyVolunteer = async (req, res, next) => {
  try {
    const volunteer = await govtService.verifyVolunteer(req.params.id)
    sendSuccess(res, volunteer, 'Volunteer verified')
  } catch (err) { next(err) }
}

const rejectVolunteer = async (req, res, next) => {
  try {
    const volunteer = await govtService.rejectVolunteer(req.params.id)
    sendSuccess(res, volunteer, 'Volunteer application rejected')
  } catch (err) { next(err) }
}

const getPendingLocalOperators = async (req, res, next) => {
  try { sendSuccess(res, await govtService.getPendingLocalOperators()) } catch (err) { next(err) }
}

const getAllLocalOperators = async (req, res, next) => {
  try { sendSuccess(res, await govtService.getAllLocalOperators()) } catch (err) { next(err) }
}

const verifyLocalOperator = async (req, res, next) => {
  try {
    const operator = await govtService.verifyLocalOperator(req.params.id, req.govtUser.id)
    sendSuccess(res, operator, 'Local tourism provider verified')
  } catch (err) { next(err) }
}

const rejectLocalOperator = async (req, res, next) => {
  try {
    const operator = await govtService.rejectLocalOperator(req.params.id)
    sendSuccess(res, operator, 'Local tourism provider rejected')
  } catch (err) { next(err) }
}

module.exports = { getDashboard, getLiveTourists, getRiskOverview, getRiskModelInfo, getRescueTeams,
  getAnalytics, exportAnalyticsReport, getActiveSOS, assignRescue, getNearbyRescuers, getActiveRescuers,
  resolveSOS, verifyHandoffRelay, updateTeamStatus, downloadIncidentReport,
  scanCheckpoint, getRecentCheckpointScans, postDestinationNews,
  getPendingVolunteers, getAllVolunteers, createVolunteer, verifyVolunteer, rejectVolunteer,
  getPendingLocalOperators, getAllLocalOperators, verifyLocalOperator, rejectLocalOperator,
  getAnomalies, resolveAnomaly,
  getIncidentQueue, getIncident, getAssignableOfficers, assignIncident, updateIncidentStatus, downloadEfirReport,
  confirmFraudulentSOS, getPendingAppeals, decideAppeal, getOpenClusters, resolveCluster,
  getRecentNTNActivity, getRecentSOSActivity }
