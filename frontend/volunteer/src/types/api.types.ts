// src/types/api.types.ts
// Field names verified against backend src/controllers/volunteer.controller.js
// and src/repositories/volunteer.repository.js's SAFE_COLS (live-tested via curl).

export interface APIResponse<T> {
  success: boolean
  message: string
  data: T
  timestamp: string
}

export interface APIError {
  success: false
  message: string
  errors?: Array<{ field: string; message: string; code: string }>
  timestamp: string
}

export interface Volunteer {
  id: string
  full_name: string
  phone: string
  govt_id_type: string
  govt_id_suffix: string
  district: string
  state: string
  latitude: number | null
  longitude: number | null
  is_verified: boolean
  points: number
  status: 'AVAILABLE' | 'OFF_DUTY'
  is_active: boolean
  created_at: string
}

export interface VolunteerAuthResponse {
  volunteer: Volunteer
  token: string
}

// volunteerDispatch.repository.js#findByVolunteerId — joins sos_events, so
// every row carries both the dispatch and a read-only snapshot of the SOS.
export interface Dispatch {
  id: string
  sos_event_id: string
  volunteer_id: string
  status: 'ALERTED' | 'RESPONDED' | 'COMPLETED' | 'DECLINED'
  points_awarded: number
  assigned_at: string
  responded_at: string | null
  resolved_at: string | null
  category: string
  sos_latitude: number
  sos_longitude: number
  sos_status: string
  sos_created_at: string
}

// Socket payload for VOLUNTEER_SOS_ALERT — see backend/src/socket/emitters.js#emitVolunteerSOSAlert
export interface VolunteerSOSAlertPayload {
  sosId: string
  category: string
  latitude: number
  longitude: number
  distanceKm: number
  touristFirstName: string | null
  createdAt: string
  emittedAt: string
}
