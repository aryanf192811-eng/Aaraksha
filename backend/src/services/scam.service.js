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

// Same shape as getByDestination — the "All destinations" view in the
// community tab, not filtered to one place.
async function getRecent() {
  const [reports, aggregate] = await Promise.all([
    new ScamRepository().findRecent(),
    new ScamRepository().countAll(),
  ])
  return { reports, aggregate }
}

// "Community Safety Intelligence" — the existing scam-report data, reframed
// as a cross-destination ranking instead of something you can only see once
// you already know to check one specific place.
async function getHotspots() {
  return new ScamRepository().getHotspots()
}

module.exports = { createReport, getByDestination, getRecent, getHotspots }
