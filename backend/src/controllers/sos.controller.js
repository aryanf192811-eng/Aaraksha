// src/controllers/sos.controller.js
'use strict'

const sosService = require('../services/sos.service')
const { sendSuccess, sendPaginated } = require('../utils/response')
const { parsePaginationParams } = require('../utils/pagination')

const createSOS = async (req, res, next) => {
  try {
    const sos = await sosService.createSOS(req.tourist.id, req.validatedBody)
    sendSuccess(res, sos, 'SOS triggered. Emergency contacts notified.', 201)
  } catch (err) { next(err) }
}

const getMySOSHistory = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query)
    const { rows, total } = await sosService.getSOSHistory(req.tourist.id, { ...req.query, limit, offset })
    sendPaginated(res, rows, total, page, limit)
  } catch (err) { next(err) }
}

const markFalseAlarm = async (req, res, next) => {
  try {
    const sos = await sosService.markFalseAlarm(req.params.id, req.tourist.id)
    sendSuccess(res, sos, 'SOS marked as false alarm')
  } catch (err) { next(err) }
}

const getActiveRescueInfo = async (req, res, next) => {
  try {
    const info = await sosService.getActiveRescueInfo(req.tourist.id)
    sendSuccess(res, info)
  } catch (err) { next(err) }
}

module.exports = { createSOS, getMySOSHistory, markFalseAlarm, getActiveRescueInfo }
