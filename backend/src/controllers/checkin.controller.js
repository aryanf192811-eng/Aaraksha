// src/controllers/checkin.controller.js
'use strict'

const checkinService = require('../services/checkin.service')
const { sendSuccess } = require('../utils/response')

const createCheckin = async (req, res, next) => {
  try {
    const result = await checkinService.createCheckin(req.tourist.id, req.validatedBody)
    sendSuccess(res, result, 'Checked in successfully', 201)
  } catch (err) { next(err) }
}
const getRecentCheckins = async (req, res, next) => {
  try {
    const checkins = await checkinService.getRecentCheckins(req.tourist.id, req.query)
    sendSuccess(res, checkins)
  } catch (err) { next(err) }
}

module.exports = { createCheckin, getRecentCheckins }
