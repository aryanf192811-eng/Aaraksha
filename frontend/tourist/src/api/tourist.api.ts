// src/api/tourist.api.ts
// FIELD NAMES: verified against backend src/routes/tourist.routes.js's
// inline UpdateProfileSchema (max 3 emergency contacts).
import api from './client'
import type { APIResponse, Tourist, GuardianView, EmergencyContact, Message } from '../types/api.types'

export interface UpdateProfilePayload {
  fullName?: string
  email?: string
  bloodGroup?: string
  medicalInfo?: string
  emergencyContacts?: EmergencyContact[]  // max 3
  profilePhotoUrl?: string | null
}

const touristApi = {
  getMe: () =>
    api.get<APIResponse<Tourist>>('/tourists/me'),

  updateMe: (data: UpdateProfilePayload) =>
    api.patch<APIResponse<Tourist>>('/tourists/me', data),

  // Public — no auth required, used by the Guardian Portal.
  getGuardianView: (token: string) =>
    api.get<APIResponse<GuardianView>>(`/tourists/guardian/${token}`),

  sendEmergencyContactOTP: (phone: string) =>
    api.post<APIResponse<{ message: string; debugOtp?: string; debugReason?: string }>>(
      '/tourists/emergency-contacts/send-otp', { phone }
    ),

  verifyEmergencyContactOTP: (phone: string, otp: string) =>
    api.post<APIResponse<Tourist>>('/tourists/emergency-contacts/verify-otp', { phone, otp }),

  // Tourist <-> Guardian messaging — always available, not gated on an
  // active SOS.
  getGuardianMessages: () =>
    api.get<APIResponse<Message[]>>('/tourists/me/guardian-messages'),

  sendGuardianMessage: (body: string) =>
    api.post<APIResponse<Message>>('/tourists/me/guardian-messages', { body }),

  // Trust score never gates this -- always reachable, restricted or not.
  getTrustStatus: () =>
    api.get<APIResponse<TrustStatus>>('/tourists/me/trust-status'),

  submitTrustAppeal: (message: string) =>
    api.post<APIResponse<{ id: string; status: string }>>('/tourists/me/trust-appeal', { message }),
}

export interface TrustStatus {
  trustScore: number
  restricted: boolean
  restrictedAt: string | null
}

export default touristApi
