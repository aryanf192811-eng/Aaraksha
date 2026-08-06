'use strict'
const packingService = require('../services/packing.service')
const { sendSuccess } = require('../utils/response')

const generatePackingList = async (req, res, next) => {
  try { sendSuccess(res, await packingService.generateForTrip(req.tourist.id, req.validatedBody.tripId), 'Packing list generated') }
  catch (err) { next(err) }
}
module.exports = { generatePackingList }
