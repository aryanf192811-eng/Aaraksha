// src/api/sos.api.ts
// FIELD NAMES: verified against backend src/validators/sos.validator.js
import api from './client'
import type { APIResponse, PaginatedResponse, SOSEvent } from '../types/api.types'

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

const sosApi = {
  createSOS: (data: CreateSOSPayload) =>
    api.post<APIResponse<SOSEvent>>('/sos', data),

  getMySOSHistory: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<SOSEvent>>('/sos/mine', { params }),

  // No request body — backend's FalseAlarmSchema is an empty object schema.
  markFalseAlarm: (id: string) =>
    api.patch<APIResponse<SOSEvent>>(`/sos/${id}/false-alarm`),
}

export default sosApi
