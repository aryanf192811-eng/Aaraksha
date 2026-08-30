// src/api/sos.api.ts
// FIELD NAMES: verified against backend src/validators/sos.validator.js
import api from './client'
import type { APIResponse, PaginatedResponse, SOSEvent, Message } from '../types/api.types'

export interface CreateSOSPayload {
  latitude: number            // -90 to 90
  longitude: number           // -180 to 180
  category?: string           // MEDICAL|LOST|TRAPPED|DISASTER|MISSING|CRIME|OTHER — defaults OTHER
  message?: string | null
  batteryPct?: number | null
  tripId?: string | null
  locationAccuracyM?: number | null
  isStaleLocation?: boolean
}

// Unifies an official rescue team and a govt-assigned volunteer into one
// shape — see backend/src/services/sos.service.js#getActiveRescueInfo.
// `latitude`/`longitude` is the rescuer's last-known position: their live
// GPS fix once they've sent one (isLive: true), their registered base
// until then. Official teams have no live feed, so isLive is always false.
export interface ActiveRescuer {
  kind: 'TEAM' | 'VOLUNTEER'
  id: string
  name: string
  type: string
  phone: string
  latitude: string
  longitude: string
  isLive: boolean
  liveUpdatedAt: string | null
  status: string
  assignedAt: string
  distanceKm: number | null
  etaMinutes: number | null
}

export interface ActiveRescueInfo {
  sosId: string
  category: string
  status: string
  createdAt: string
  latitude: string
  longitude: string
  handoffVerifiedAt: string | null
  handoffVerifiedByKind: 'VOLUNTEER' | 'TEAM' | null
  rescuer: ActiveRescuer | null
}

export interface HandoffCodeResponse {
  alreadyIssued: boolean
  code?: string
  expiresAt: string
}

const sosApi = {
  createSOS: (data: CreateSOSPayload) =>
    api.post<APIResponse<SOSEvent>>('/sos', data),

  getMySOSHistory: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<SOSEvent>>('/sos/mine', { params }),

  // No request body — backend's FalseAlarmSchema is an empty object schema.
  markFalseAlarm: (id: string) =>
    api.patch<APIResponse<SOSEvent>>(`/sos/${id}/false-alarm`),

  getActiveRescue: () =>
    api.get<APIResponse<ActiveRescueInfo | null>>('/sos/active-rescue'),

  getHandoffCode: (sosId: string) =>
    api.get<APIResponse<HandoffCodeResponse>>(`/sos/${sosId}/handoff-code`),

  regenerateHandoffCode: (sosId: string) =>
    api.post<APIResponse<HandoffCodeResponse>>(`/sos/${sosId}/handoff-code/regenerate`),

  // Tourist <-> Rescuer messaging, scoped to this one active assignment.
  getRescueMessages: (sosId: string) =>
    api.get<APIResponse<Message[]>>(`/sos/${sosId}/messages`),

  sendRescueMessage: (sosId: string, body: string) =>
    api.post<APIResponse<Message>>(`/sos/${sosId}/messages`, { body }),
}

export default sosApi
