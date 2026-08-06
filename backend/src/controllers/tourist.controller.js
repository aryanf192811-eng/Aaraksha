// src/controllers/tourist.controller.js
'use strict'

const touristService = require('../services/tourist.service')
const { sendSuccess } = require('../utils/response')

const getMe = async (req, res, next) => {
  try {
    const tourist = await touristService.getProfile(req.tourist.id)
    sendSuccess(res, tourist)
  } catch (err) { next(err) }
}

const updateMe = async (req, res, next) => {
  try {
    const updated = await touristService.updateProfile(req.tourist.id, req.validatedBody)
    sendSuccess(res, updated, 'Profile updated')
  } catch (err) { next(err) }
}

const getGuardianView = async (req, res, next) => {
  try {
    const view = await touristService.getGuardianView(req.params.token)
    sendSuccess(res, view)
  } catch (err) { next(err) }
}

module.exports = { getMe, updateMe, getGuardianView }
