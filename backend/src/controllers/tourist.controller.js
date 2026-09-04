// src/controllers/tourist.controller.js
'use strict'

const touristService = require('../services/tourist.service')
const otpService = require('../services/otp.service')
const checkpointService = require('../services/checkpoint.service')
const trustScoreService = require('../services/trustScore.service')
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
    const view = await touristService.getGuardianView(req.params.token, req.query.pin)
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

const getCheckpointQR = async (req, res, next) => {
  try {
    const result = await checkpointService.getCheckpointQR(req.tourist.id)
    sendSuccess(res, result)
  } catch (err) { next(err) }
}

const getMyTrustStatus = async (req, res, next) => {
  try {
    const status = await trustScoreService.getMyTrustStatus(req.tourist.id)
    sendSuccess(res, status)
  } catch (err) { next(err) }
}

const submitTrustAppeal = async (req, res, next) => {
  try {
    const appeal = await trustScoreService.submitAppeal(req.tourist.id, req.validatedBody.message)
    sendSuccess(res, appeal, 'Appeal submitted — a district officer will review it')
  } catch (err) { next(err) }
}

module.exports = {
  getMe, updateMe, getGuardianView, sendEmergencyContactOTP, verifyEmergencyContactOTP,
  getCheckpointQR, getMyTrustStatus, submitTrustAppeal,
}
