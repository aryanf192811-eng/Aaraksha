// src/api/trip.api.ts
// FIELD NAMES: verified against backend src/validators/trip.validator.js
// and src/routes/trip.routes.js
import api from './client'
import type { APIResponse, PaginatedResponse, Trip, PackingItem, TripMember } from '../types/api.types'

export interface ActivityInput {
  name: string
  type?: string
  cost?: number
  duration?: string
  notes?: string
}

export interface StopInput {
  city: string
  state: string
  destinationId?: string | null
  lat?: number | null
  lng?: number | null
  days: number
  arrivalDate?: string | null
  departureDate?: string | null
  activities?: ActivityInput[]
  notes?: string
  connectivity?: string
  difficulty?: string
  altitude_m?: number
  zone_type?: string
  hospital_km?: number
  eta_minutes?: number | null
}

export interface CreateTripPayload {
  title: string
  description?: string
  travelType?: string         // SOLO|FAMILY|FRIENDS|ADVENTURE|PILGRIMAGE|BUSINESS
  startDate: string           // YYYY-MM-DD
  endDate: string             // YYYY-MM-DD — must be after startDate (backend .refine())
  stops?: StopInput[]
  budgetInr?: number | null
  coverImageUrl?: string | null
  isPublic?: boolean
}

export interface UpdateTripStatusPayload {
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
}

const tripApi = {
  getMyTrips: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Trip>>('/trips', { params }),

  createTrip: (data: CreateTripPayload) =>
    api.post<APIResponse<Trip>>('/trips', data),

  getTripById: (id: string) =>
    api.get<APIResponse<Trip>>(`/trips/${id}`),

  updateTrip: (id: string, data: Partial<CreateTripPayload>) =>
    api.put<APIResponse<Trip>>(`/trips/${id}`, data),

  updateTripStatus: (id: string, data: UpdateTripStatusPayload) =>
    api.patch<APIResponse<Pick<Trip, 'id' | 'status'>>>(`/trips/${id}/status`, data),

  updateChecklist: (id: string, packingChecklist: PackingItem[]) =>
    api.patch<APIResponse<Trip>>(`/trips/${id}/checklist`, { packingChecklist }),

  deleteTrip: (id: string) =>
    api.delete(`/trips/${id}`),

  getPublicTrip: (token: string) =>
    api.get<APIResponse<Trip>>(`/trips/public/${token}`),

  getInviteCode: (id: string) =>
    api.post<APIResponse<{ inviteCode: string }>>(`/trips/${id}/invite`),

  joinTrip: (inviteCode: string) =>
    api.post<APIResponse<Trip>>('/trips/join', { inviteCode }),

  getTripMembers: (id: string) =>
    api.get<APIResponse<{ ownerId: string; members: TripMember[] }>>(`/trips/${id}/members`),

  leaveTrip: (id: string) =>
    api.delete(`/trips/${id}/leave`),

  getSafetyAdvisory: (id: string) =>
    api.get<APIResponse<{ advisory: string; source: 'GEMINI_AI' | 'OFFLINE_FALLBACK' }>>(`/trips/${id}/safety-advisory`),
}

export default tripApi
