// src/controllers/ntn.controller.js
'use strict'

const ntnService = require('../services/ntn.service')
const { sendSuccess } = require('../utils/response')

const getStatus = async (req, res, next) => {
  try {
    const channel = ntnService.getChannelStatus(req.validatedQuery.scenario)
    sendSuccess(res, channel)
  } catch (err) { next(err) }
}

const uplink = async (req, res, next) => {
  try {
    const { scenario, ...sosData } = req.validatedBody
    const result = await ntnService.sendViaNTN(req.tourist.id, sosData, scenario)
    if (result.delivered) {
      sendSuccess(res, result, 'SOS delivered via simulated NTN uplink. Emergency contacts notified.', 201)
    } else {
      sendSuccess(res, result, 'NTN uplink failed — no satellite visibility or packet lost.')
    }
  } catch (err) { next(err) }
}

module.exports = { getStatus, uplink }
