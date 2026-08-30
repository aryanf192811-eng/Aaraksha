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

  // Tourist <-> Guardian messaging — same token-in-URL model as
  // getGuardianView, no separate auth. Every send re-validates the token
  // server-side (guardian_token_expires), same as every other guardian call.
  getGuardianMessages: (token: string) =>
    api.get<APIResponse<Message[]>>(`/tourists/guardian/${token}/messages`),

  sendGuardianMessage: (token: string, body: string) =>
    api.post<APIResponse<Message>>(`/tourists/guardian/${token}/messages`, { body }),
}

export default touristApi
