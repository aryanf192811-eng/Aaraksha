// src/routes/auth.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/auth.controller')
const { validate }  = require('../middleware/validate')
const { authenticateTourist } = require('../middleware/auth')
const {
  RegisterTouristSchema, LoginTouristSchema, RegisterGovtSchema, LoginGovtSchema,
  ForgotPasswordSchema, VerifyOTPSchema, ResetPasswordSchema, ResendOTPSchema,
} = require('../validators/auth.validator')

// ── Tourist auth ──────────────────────────────────────────────────────
router.post('/register',      validate(RegisterTouristSchema), ctrl.register)
router.post('/login',         validate(LoginTouristSchema),    ctrl.login)

// ── Forgot password 3-step flow ───────────────────────────────────────
// Step 1: Request OTP (no auth — this is for forgotten passwords)
router.post('/forgot-password', validate(ForgotPasswordSchema), ctrl.forgotPassword)
// Step 2: Verify OTP → receive resetToken
router.post('/verify-otp',      validate(VerifyOTPSchema),      ctrl.verifyOTP)
// Step 3: Reset password using resetToken
router.post('/reset-password',  validate(ResetPasswordSchema),  ctrl.resetPassword)
// Resend OTP (same rate limits apply)
router.post('/resend-otp',      validate(ResendOTPSchema),      ctrl.resendOTP)

// ── Phone verification (requires login — optional post-signup step) ────
router.post('/send-verification-otp', authenticateTourist, ctrl.sendVerificationOTP)

// ── Government auth ────────────────────────────────────────────────────
router.post('/govt/register',  validate(RegisterGovtSchema),  ctrl.registerGovt)
router.post('/govt/login',     validate(LoginGovtSchema),     ctrl.loginGovt)

module.exports = router
