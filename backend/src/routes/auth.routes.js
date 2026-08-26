// src/routes/auth.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/auth.controller')
const { validate }  = require('../middleware/validate')
const { authenticateTourist, authenticateGovt, requireGovtRole } = require('../middleware/auth')
const { createAuthLimiter, createOtpLimiter } = require('../middleware/rateLimiter')
const { GOVT_ROLES } = require('../constants/enums')

// Each auth-sensitive route gets its own limiter instance/counter — see
// rateLimiter.js for why a single shared instance is wrong here. Registration
// gets a more generous budget than login: every attempt counts, including
// recoverable validation/conflict errors (typo'd Aadhaar, duplicate phone),
// so login's tight brute-force budget would lock out legitimate multi-try
// signups, not just abuse.
const registerLimiter          = createAuthLimiter(20)
const loginLimiter             = createAuthLimiter()
const resetPasswordLimiter     = createAuthLimiter()
const govtRegisterLimiter      = createAuthLimiter(20)
const govtLoginLimiter         = createAuthLimiter()
const forgotPasswordOtpLimiter = createOtpLimiter()
const verifyOtpLimiter         = createOtpLimiter()
const resendOtpLimiter         = createOtpLimiter()
const verificationOtpLimiter   = createOtpLimiter()
const {
  RegisterTouristSchema, LoginTouristSchema, RegisterGovtSchema, LoginGovtSchema,
  ForgotPasswordSchema, VerifyOTPSchema, ResetPasswordSchema, ResendOTPSchema,
} = require('../validators/auth.validator')

// ── Tourist auth ──────────────────────────────────────────────────────
router.post('/register',      registerLimiter, validate(RegisterTouristSchema), ctrl.register)
router.post('/login',         loginLimiter,    validate(LoginTouristSchema),    ctrl.login)

// ── Forgot password 3-step flow ───────────────────────────────────────
// Step 1: Request OTP (no auth — this is for forgotten passwords)
router.post('/forgot-password', forgotPasswordOtpLimiter, validate(ForgotPasswordSchema), ctrl.forgotPassword)
// Step 2: Verify OTP → receive resetToken
router.post('/verify-otp',      verifyOtpLimiter, validate(VerifyOTPSchema),      ctrl.verifyOTP)
// Step 3: Reset password using resetToken
router.post('/reset-password',  resetPasswordLimiter, validate(ResetPasswordSchema), ctrl.resetPassword)
// Resend OTP (same rate limits apply)
router.post('/resend-otp',      resendOtpLimiter, validate(ResendOTPSchema),      ctrl.resendOTP)

// ── Phone verification (requires login — optional post-signup step) ────
router.post('/send-verification-otp', authenticateTourist, verificationOtpLimiter, ctrl.sendVerificationOTP)

// ── Government auth ────────────────────────────────────────────────────
// registerGovt provisions a NEW govt account and was previously reachable
// by anyone, unauthenticated, with a caller-controlled `role` field —
// meaning any request could self-assign SUPER_ADMIN and get a valid govt
// JWT back immediately. Only an existing super admin may provision new
// govt accounts now, matching the same govt-provisions-volunteer pattern
// already used in govt.routes.js.
router.post('/govt/register',  authenticateGovt, requireGovtRole(GOVT_ROLES.SUPER_ADMIN), govtRegisterLimiter, validate(RegisterGovtSchema), ctrl.registerGovt)
router.post('/govt/login',     govtLoginLimiter,    validate(LoginGovtSchema),    ctrl.loginGovt)

module.exports = router
