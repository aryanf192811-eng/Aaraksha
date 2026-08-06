'use strict'
const destinationService = require('../services/destination.service')
const { sendSuccess } = require('../utils/response')

const getAllDestinations = async (req, res, next) => {
  try { sendSuccess(res, await destinationService.getAllDestinations(req.query)) }
  catch (err) { next(err) }
}
const getDestinationById = async (req, res, next) => {
  try { sendSuccess(res, await destinationService.getDestinationById(req.params.id)) }
  catch (err) { next(err) }
}
module.exports = { getAllDestinations, getDestinationById }
