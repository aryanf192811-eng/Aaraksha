// src/api/dms.api.ts
// FIELD NAMES: verified against backend src/validators/dms.validator.js
import api from './client'
import type { APIResponse, DMS, Checkin } from '../types/api.types'

export interface CreateDMSPayload {
  intervalMinutes?: number    // 15 to 480 — omit when demoSeconds is set
  demoSeconds?: number        // 5 to 120 — judge-demo escape hatch, see backend validator
  tripId?: string | null
}

export interface ResetDMSPayload {
  latitude?: number | null
  longitude?: number | null
  batteryPct?: number | null
  message?: string | null
}

// create()/reset() return the plain row (INSERT/UPDATE RETURNING *), which
// has no seconds_remaining — that's only computed by GET /dms/active's own
// query. Callers that cache a create/reset response directly (to update the
// UI instantly instead of waiting on a refetch) need this filled in
// themselves, or the countdown reads "0:00" until the next poll.
export function withSecondsRemaining(dms: DMS): DMS {
  const remaining = Math.round((new Date(dms.next_trigger_at).getTime() - Date.now()) / 1000)
  return { ...dms, seconds_remaining: remaining }
}

const dmsApi = {
  createDMS: (data: CreateDMSPayload) =>
    api.post<APIResponse<DMS>>('/dms', data),

  getActiveDMS: () =>
    api.get<APIResponse<DMS | null>>('/dms/active'),

  resetDMS: (id: string, data: ResetDMSPayload) =>
    api.post<APIResponse<{ dms: DMS; checkin: Checkin }>>(`/dms/${id}/reset`, data),

  // Backend only allows transitioning to PAUSED or RESOLVED via this route
  // (ACTIVE is set at creation, TRIGGERED only by the cron job).
  updateDMSStatus: (id: string, status: 'PAUSED' | 'RESOLVED') =>
    api.patch<APIResponse<DMS>>(`/dms/${id}/status`, { status }),
}

export default dmsApi
