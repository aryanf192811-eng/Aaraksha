// src/controllers/tourist.controller.js
'use strict'

const touristService = require('../services/tourist.service')
const otpService = require('../services/otp.service')
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

const sendEmergencyContactOTP = async (req, res, next) => {
  try {
    const ipAddress = req.ip
    const result = await otpService.requestEmergencyContactVerification(req.tourist.id, req.validatedBody.phone, ipAddress)
    sendSuccess(res, result, result.message)
  } catch (err) { next(err) }
}

const verifyEmergencyContactOTP = async (req, res, next) => {
  try {
    const { phone, otp } = req.validatedBody
    const tourist = await otpService.verifyEmergencyContactOTP(req.tourist.id, phone, otp)
    sendSuccess(res, tourist, 'Emergency contact verified')
  } catch (err) { next(err) }
}

module.exports = { getMe, updateMe, getGuardianView, sendEmergencyContactOTP, verifyEmergencyContactOTP }
