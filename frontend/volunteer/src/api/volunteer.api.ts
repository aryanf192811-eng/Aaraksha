// src/api/volunteer.api.ts
// FIELD NAMES: verified against backend src/validators/volunteer.validator.js
// and src/routes/volunteer.routes.js
import api from './client'
import type { APIResponse, Volunteer, VolunteerAuthResponse, Dispatch, ActiveAssignment, Message } from '../types/api.types'

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

  getActiveAssignment: () =>
    api.get<APIResponse<ActiveAssignment | null>>('/volunteers/me/active-assignment'),

  updateLocation: (latitude: number, longitude: number) =>
    api.patch<APIResponse<{ assignmentId: string; latitude: number; longitude: number }>>('/volunteers/me/location', { latitude, longitude }),

  updateAssignmentStatus: (status: 'EN_ROUTE' | 'ARRIVED') =>
    api.patch<APIResponse<ActiveAssignment>>('/volunteers/me/assignment/status', { status }),

  verifyHandoff: (code: string) =>
    api.post<APIResponse<{ handoff_verified_at: string }>>('/volunteers/me/assignment/verify-handoff', { code }),

  // Backend derives DECLINED vs CANCELLED from where the assignment
  // actually was — this one endpoint covers both "backing out before
  // starting" and "can't continue mid-response".
  exitAssignment: (reason: string) =>
    api.post<APIResponse<ActiveAssignment>>('/volunteers/me/assignment/exit', { reason }),

  // Tourist <-> Rescuer messaging, scoped to the current active assignment
  // (resolved server-side — no sosId needed here).
  getAssignmentMessages: () =>
    api.get<APIResponse<Message[]>>('/volunteers/me/assignment/messages'),

  sendAssignmentMessage: (body: string) =>
    api.post<APIResponse<Message>>('/volunteers/me/assignment/messages', { body }),
}

export default volunteerApi
