'use strict'
const destinationService = require('../services/destination.service')
// Reuses the exact same aggregation govt.service.js's dashboard uses — one
// source of truth for "how risky is this zone right now", rather than a
// parallel tourist-facing copy that could silently drift from it.
const govtService = require('../services/govt.service')
const newsService = require('../services/news.service')
const { sendSuccess } = require('../utils/response')

const getAllDestinations = async (req, res, next) => {
  try { sendSuccess(res, await destinationService.getAllDestinations(req.query)) }
  catch (err) { next(err) }
}
const getDestinationById = async (req, res, next) => {
  try { sendSuccess(res, await destinationService.getDestinationById(req.params.id)) }
  catch (err) { next(err) }
}
const getRiskOverview = async (req, res, next) => {
  try { sendSuccess(res, await govtService.getRiskOverview()) }
  catch (err) { next(err) }
}
const getDestinationNews = async (req, res, next) => {
  try { sendSuccess(res, await newsService.getNewsForDestination(req.params.id)) }
  catch (err) { next(err) }
}
module.exports = { getAllDestinations, getDestinationById, getRiskOverview, getDestinationNews }
