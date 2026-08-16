// src/api/volunteer.api.ts
// FIELD NAMES: verified against backend src/validators/volunteer.validator.js
// and src/routes/volunteer.routes.js
import api from './client'
import type { APIResponse, Volunteer, VolunteerAuthResponse, Dispatch } from '../types/api.types'

export interface RegisterVolunteerPayload {
  fullName: string
  phone: string
  password: string
  govtIdType: 'AADHAAR' | 'PASSPORT' | 'VOTER_ID' | 'DRIVING_LICENSE'
  govtIdNumber: string
  district: string
  state: string
  latitude?: number
  longitude?: number
}

export interface LoginVolunteerPayload {
  phone: string
  password: string
}

const volunteerApi = {
  register: (data: RegisterVolunteerPayload) =>
    api.post<APIResponse<VolunteerAuthResponse>>('/volunteers/register', data),

  login: (data: LoginVolunteerPayload) =>
    api.post<APIResponse<VolunteerAuthResponse>>('/volunteers/login', data),

  getProfile: () =>
    api.get<APIResponse<Volunteer>>('/volunteers/me'),

  updateStatus: (status: 'AVAILABLE' | 'OFF_DUTY', latitude?: number, longitude?: number) =>
    api.patch<APIResponse<Volunteer>>('/volunteers/me/status', { status, latitude, longitude }),

  getMyDispatches: () =>
    api.get<APIResponse<Dispatch[]>>('/volunteers/me/dispatches'),

  updateDispatchStatus: (dispatchId: string, status: 'RESPONDED' | 'COMPLETED' | 'DECLINED') =>
    api.patch<APIResponse<Dispatch>>(`/volunteers/dispatches/${dispatchId}/status`, { status }),
}

export default volunteerApi
