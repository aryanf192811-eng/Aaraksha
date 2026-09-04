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

  // Public — no auth beyond the link's own token + a PIN the traveler
  // shares over a separate channel (see migration 028) — the link alone no
  // longer opens tracking.
  getGuardianView: (token: string, pin: string) =>
    api.get<APIResponse<GuardianView>>(`/tourists/guardian/${token}`, { params: { pin } }),

  // Tourist <-> Guardian messaging — same token+PIN model as
  // getGuardianView. Every call re-validates both server-side, same as
  // every other guardian call.
  getGuardianMessages: (token: string, pin: string) =>
    api.get<APIResponse<Message[]>>(`/tourists/guardian/${token}/messages`, { params: { pin } }),

  sendGuardianMessage: (token: string, pin: string, body: string) =>
    api.post<APIResponse<Message>>(`/tourists/guardian/${token}/messages`, { body }, { params: { pin } }),
}

export default touristApi
