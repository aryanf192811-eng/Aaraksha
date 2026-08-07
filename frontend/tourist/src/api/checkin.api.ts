// src/api/checkin.api.ts
// FIELD NAMES: verified against backend src/validators/checkin.validator.js
import api from './client'
import type { APIResponse, Checkin } from '../types/api.types'

export interface CreateCheckinPayload {
  latitude: number
  longitude: number
  batteryPct?: number | null
  message?: string | null
  tripId?: string | null
  dmsId?: string | null
  accuracyM?: number | null
}

const checkinApi = {
  createCheckin: (data: CreateCheckinPayload) =>
    api.post<APIResponse<{ checkin: Checkin; dmsReset: boolean }>>('/checkins', data),

  getRecentCheckins: (params?: { tripId?: string; limit?: number }) =>
    api.get<APIResponse<Checkin[]>>('/checkins/recent', { params }),
}

export default checkinApi
