// src/api/auth.api.ts
// FIELD NAMES: verified against backend src/validators/auth.validator.js
import api from './client'
import type { APIResponse, AuthResponse, GovtAuthResponse } from '../types/api.types'

export interface EmergencyContactInput {
  name: string
  phone: string
  relation: string
  tier?: 1 | 2
  notifyOnSOS?: boolean
}

export interface RegisterPayload {
  fullName: string
  phone: string
  email?: string
  bloodGroup?: string
  medicalInfo?: string
  emergencyContacts: EmergencyContactInput[]
  govtIdType: string        // AADHAAR | PASSPORT | VOTER_ID | DRIVING_LICENSE
  govtIdNumber: string      // format validated per govtIdType
  password: string          // min 8 chars
}

export interface LoginPayload {
  phone: string
  password: string
}

export interface ForgotPasswordPayload {
  phone: string
}

export interface VerifyOTPPayload {
  phone: string
  otp: string               // exactly 6 digits
  purpose?: 'PASSWORD_RESET' | 'PHONE_VERIFY'
}

export interface ResetPasswordPayload {
  resetToken: string        // 64-128 hex chars from verifyOTP response
  newPassword: string       // min 8 chars
}

// Only ever populated in a dev environment, and only when Twilio didn't
// actually deliver the SMS (see backend otp.service.js) — a Twilio trial
// account rejects free-form OTP message bodies, so this keeps the flow
// demoable without a paid plan. Never present in production regardless of
// SMS delivery outcome.
export interface DebugOtpFields {
  debugOtp?: string
  debugReason?: string
}

const authApi = {
  register: (data: RegisterPayload) =>
    api.post<APIResponse<AuthResponse>>('/auth/register', data),

  login: (data: LoginPayload) =>
    api.post<APIResponse<AuthResponse>>('/auth/login', data),

  forgotPassword: (data: ForgotPasswordPayload) =>
    api.post<APIResponse<DebugOtpFields | null>>('/auth/forgot-password', data),

  verifyOTP: (data: VerifyOTPPayload) =>
    api.post<APIResponse<{ resetToken: string; expiresIn: string }>>('/auth/verify-otp', data),

  resetPassword: (data: ResetPasswordPayload) =>
    api.post<APIResponse<null>>('/auth/reset-password', data),

  resendOTP: (data: { phone: string; purpose?: string }) =>
    api.post<APIResponse<DebugOtpFields | null>>('/auth/resend-otp', data),

  sendVerificationOTP: () =>
    api.post<APIResponse<DebugOtpFields | null>>('/auth/send-verification-otp'),

  loginGovt: (data: { email: string; password: string }) =>
    api.post<APIResponse<GovtAuthResponse>>('/auth/govt/login', data),
}

export default authApi
