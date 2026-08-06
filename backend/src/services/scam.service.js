'use strict'
const { ScamRepository }        = require('../repositories/scam.repository')
const { DestinationRepository } = require('../repositories/destination.repository')
const { ERRORS } = require('../constants/errors')

async function createReport(touristId, data) {
  const dest = await new DestinationRepository().findById(data.destinationId)
  if (!dest) throw Object.assign(new Error(ERRORS.DESTINATION_NOT_FOUND), { statusCode: 404 })
  return new ScamRepository().create({ touristId, ...data })
}

async function getByDestination(destinationId) {
  const [reports, aggregate] = await Promise.all([
    new ScamRepository().findByDestination(destinationId),
    new ScamRepository().countByDestination(destinationId),
  ])
  return { reports, aggregate }
}

module.exports = { createReport, getByDestination }
