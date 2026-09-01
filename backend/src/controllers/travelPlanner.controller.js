// src/controllers/travelPlanner.controller.js
'use strict'

const travelPlannerService = require('../services/travelPlanner.service')
const { sendSuccess } = require('../utils/response')

const buildJourney = async (req, res, next) => {
  try {
    const result = await travelPlannerService.buildJourney(req.validatedBody)
    sendSuccess(res, result, 'Journey built')
  } catch (err) { next(err) }
}

const askFollowUp = async (req, res, next) => {
  try {
    const result = await travelPlannerService.askFollowUp({
      freeText: req.validatedBody.question,
      currentContext: req.validatedBody.currentContext,
    })
    sendSuccess(res, result, result.understood ? 'Journey updated' : "Didn't understand that")
  } catch (err) { next(err) }
}

const commitJourney = async (req, res, next) => {
  try {
    const trip = await travelPlannerService.commitJourney({
      touristId: req.tourist.id,
      tourist: req.tourist,
      ...req.validatedBody,
    })
    sendSuccess(res, trip, 'Journey started as a trip', 201)
  } catch (err) { next(err) }
}

module.exports = { buildJourney, askFollowUp, commitJourney }
