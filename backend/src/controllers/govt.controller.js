'use strict'
const govtService = require('../services/govt.service')
const govtReportService = require('../services/govtReport.service')
const checkpointService = require('../services/checkpoint.service')
const newsService = require('../services/news.service')
const { sendSuccess, sendPaginated } = require('../utils/response')
const { parsePaginationParams } = require('../utils/pagination')
const logger = require('../utils/logger')

const getDashboard    = async (req, res, next) => { try { sendSuccess(res, await govtService.getDashboard()) } catch (err) { next(err) } }
const getLiveTourists = async (req, res, next) => { try { sendSuccess(res, await govtService.getLiveTourists()) } catch (err) { next(err) } }
const getRiskOverview = async (req, res, next) => { try { sendSuccess(res, await govtService.getRiskOverview()) } catch (err) { next(err) } }
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

const getActiveSOS = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query)
    const { rows, total } = await govtService.getActiveSOS({ ...req.query, limit, offset })
    sendPaginated(res, rows, total, page, limit)
  } catch (err) { next(err) }
}

const assignRescue = async (req, res, next) => {
  try {
    const result = await govtService.assignRescue(req.params.id, req.govtUser.id, req.validatedBody.teamId, req.validatedBody.notes)
    sendSuccess(res, result, 'Rescue team assigned')
  } catch (err) { next(err) }
}

const resolveSOS = async (req, res, next) => {
  try {
    const sos = await govtService.resolveSOS(req.params.id, req.validatedBody.resolutionNotes)
    sendSuccess(res, sos, 'SOS resolved')
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

const verifyVolunteer = async (req, res, next) => {
  try {
    const volunteer = await govtService.verifyVolunteer(req.params.id)
    sendSuccess(res, volunteer, 'Volunteer verified')
  } catch (err) { next(err) }
}

module.exports = { getDashboard, getLiveTourists, getRiskOverview, getRescueTeams,
  getAnalytics, exportAnalyticsReport, getActiveSOS, assignRescue, resolveSOS, updateTeamStatus,
  scanCheckpoint, getRecentCheckpointScans, postDestinationNews,
  getPendingVolunteers, verifyVolunteer }
