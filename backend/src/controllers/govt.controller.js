'use strict'
const govtService = require('../services/govt.service')
const { sendSuccess, sendPaginated } = require('../utils/response')
const { parsePaginationParams } = require('../utils/pagination')

const getDashboard    = async (req, res, next) => { try { sendSuccess(res, await govtService.getDashboard()) } catch (err) { next(err) } }
const getLiveTourists = async (req, res, next) => { try { sendSuccess(res, await govtService.getLiveTourists()) } catch (err) { next(err) } }
const getRiskOverview = async (req, res, next) => { try { sendSuccess(res, await govtService.getRiskOverview()) } catch (err) { next(err) } }
const getRescueTeams  = async (req, res, next) => { try { sendSuccess(res, await govtService.getRescueTeams()) } catch (err) { next(err) } }
const getAnalytics    = async (req, res, next) => { try { sendSuccess(res, await govtService.getAnalytics(req.query.period)) } catch (err) { next(err) } }

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

module.exports = { getDashboard, getLiveTourists, getRiskOverview, getRescueTeams,
  getAnalytics, getActiveSOS, assignRescue, resolveSOS, updateTeamStatus }
