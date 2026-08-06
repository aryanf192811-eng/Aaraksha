// src/controllers/auth.controller.js
'use strict'

const authService = require('../services/auth.service')
const otpService  = require('../services/otp.service')
const { sendSuccess } = require('../utils/response')

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const result = await authService.registerTourist(req.validatedBody)
    sendSuccess(res, result, 'Registration successful', 201)
  } catch (err) { next(err) }
}

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const result = await authService.loginTourist(req.validatedBody)
    sendSuccess(res, result, 'Login successful')
  } catch (err) { next(err) }
}

// POST /api/auth/govt/register
const registerGovt = async (req, res, next) => {
  try {
    const result = await authService.registerGovt(req.validatedBody)
    sendSuccess(res, result, 'Government user registered', 201)
  } catch (err) { next(err) }
}

// POST /api/auth/govt/login
const loginGovt = async (req, res, next) => {
  try {
    const result = await authService.loginGovt(req.validatedBody)
    sendSuccess(res, result, 'Login successful')
  } catch (err) { next(err) }
}

// POST /api/auth/forgot-password
// Step 1: Request OTP
const forgotPassword = async (req, res, next) => {
  try {
    const { phone } = req.validatedBody
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown'
    const result = await otpService.requestPasswordReset(phone, ipAddress)
    // Always return 200 — never reveal if phone is registered
    sendSuccess(res, null, result.message)
  } catch (err) { next(err) }
}

// POST /api/auth/verify-otp
// Step 2: Verify OTP → get resetToken
const verifyOTP = async (req, res, next) => {
  try {
    const { phone, otp, purpose } = req.validatedBody
    const result = await otpService.verifyOTP(phone, otp, purpose)
    sendSuccess(res, result, 'OTP verified successfully')
  } catch (err) { next(err) }
}

// POST /api/auth/reset-password
// Step 3: Use resetToken to set new password
const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.validatedBody
    const result = await otpService.resetPassword(resetToken, newPassword)
    sendSuccess(res, null, result.message)
  } catch (err) { next(err) }
}

// POST /api/auth/resend-otp
const resendOTP = async (req, res, next) => {
  try {
    const { phone, purpose } = req.validatedBody
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown'
    const result = await otpService.resendOTP(phone, purpose, ipAddress)
    sendSuccess(res, null, result.message)
  } catch (err) { next(err) }
}

// POST /api/auth/send-verification-otp (requires auth)
const sendVerificationOTP = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown'
    const result = await otpService.requestPhoneVerification(req.tourist.id, req.tourist.phone, ipAddress)
    sendSuccess(res, null, result.message)
  } catch (err) { next(err) }
}

module.exports = {
  register, login, registerGovt, loginGovt,
  forgotPassword, verifyOTP, resetPassword, resendOTP, sendVerificationOTP,
}
