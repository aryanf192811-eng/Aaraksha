// src/controllers/dms.controller.js
'use strict'

const dmsService = require('../services/dms.service')
const { sendSuccess } = require('../utils/response')

const createDMS    = async (req, res, next) => {
  try { sendSuccess(res, await dmsService.createDMS(req.tourist.id, req.validatedBody), 'Dead Man\'s Switch activated', 201) }
  catch (err) { next(err) }
}
const getActiveDMS = async (req, res, next) => {
  try { sendSuccess(res, await dmsService.getActiveDMS(req.tourist.id)) }
  catch (err) { next(err) }
}
const resetDMS = async (req, res, next) => {
  try { sendSuccess(res, await dmsService.resetDMS(req.params.id, req.tourist.id, req.validatedBody), 'Checked in — DMS reset') }
  catch (err) { next(err) }
}
const updateDMSStatus = async (req, res, next) => {
  try { sendSuccess(res, await dmsService.updateDMSStatus(req.params.id, req.tourist.id, req.validatedBody.status)) }
  catch (err) { next(err) }
}

module.exports = { createDMS, getActiveDMS, resetDMS, updateDMSStatus }
