'use strict'
const scamService = require('../services/scam.service')
const { sendSuccess } = require('../utils/response')

const createReport = async (req, res, next) => {
  try { sendSuccess(res, await scamService.createReport(req.tourist.id, req.validatedBody), 'Report submitted', 201) }
  catch (err) { next(err) }
}
const getByDestination = async (req, res, next) => {
  try { sendSuccess(res, await scamService.getByDestination(req.params.destinationId)) }
  catch (err) { next(err) }
}
const getRecent = async (req, res, next) => {
  try { sendSuccess(res, await scamService.getRecent()) }
  catch (err) { next(err) }
}
const getHotspots = async (req, res, next) => {
  try { sendSuccess(res, await scamService.getHotspots()) }
  catch (err) { next(err) }
}
module.exports = { createReport, getByDestination, getRecent, getHotspots }
