// src/services/destination.service.js
'use strict'

const { DestinationRepository } = require('../repositories/destination.repository')
const { ScamRepository }         = require('../repositories/scam.repository')
const { ERRORS } = require('../constants/errors')

async function getAllDestinations(filters) {
  return new DestinationRepository().findAll({
    state:    filters.state,
    zoneType: filters.zoneType,
    search:   filters.search,
  })
}

async function getDestinationById(id) {
  const destRepo  = new DestinationRepository()
  const scamRepo  = new ScamRepository()
  const dest = await destRepo.findById(id)
  if (!dest) throw Object.assign(new Error(ERRORS.DESTINATION_NOT_FOUND), { statusCode: 404 })
  const [scamReports, scamAggregate] = await Promise.all([
    scamRepo.findByDestination(id, 20),
    scamRepo.countByDestination(id),
  ])
  return { ...dest, scamReports, scamAggregate }
}

module.exports = { getAllDestinations, getDestinationById }
