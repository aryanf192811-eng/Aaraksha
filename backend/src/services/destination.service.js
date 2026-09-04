// src/services/destination.service.js
'use strict'

const { DestinationRepository } = require('../repositories/destination.repository')
const { ScamRepository }         = require('../repositories/scam.repository')
const { LocalOperatorRepository } = require('../repositories/localOperator.repository')
const { LocalOperatorReviewRepository } = require('../repositories/localOperatorReview.repository')
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
  const [scamReports, scamAggregate, localOperators] = await Promise.all([
    scamRepo.findByDestination(id, 20),
    scamRepo.countByDestination(id),
    new LocalOperatorRepository().findByDestinationId(id),
  ])

  // Attach each provider's rating aggregate (Trust Economy loop — see
  // migration 029) in one batched query rather than the repository doing
  // it per-row, so findByDestinationId itself stays a clean read of
  // local_operators alone.
  const ratingsByOperatorId = await new LocalOperatorReviewRepository()
    .getAggregatesByOperatorIds(localOperators.map((op) => op.id))
  const localOperatorsWithRatings = localOperators.map((op) => ({
    ...op,
    ...(ratingsByOperatorId.get(op.id) || { reviewCount: 0, avgRating: null }),
  }))

  return { ...dest, scamReports, scamAggregate, localOperators: localOperatorsWithRatings }
}

module.exports = { getAllDestinations, getDestinationById }
