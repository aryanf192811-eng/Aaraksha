// src/api/tourist.api.ts
// FIELD NAMES: verified against backend src/routes/tourist.routes.js's
// inline UpdateProfileSchema (max 3 emergency contacts).
import api from './client'
import type { APIResponse, Tourist, GuardianView, EmergencyContact } from '../types/api.types'

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
}

export default touristApi
