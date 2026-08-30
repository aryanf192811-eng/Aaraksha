// src/types/api.types.ts
// TypeScript types for ALL backend API responses.
// Field names verified against backend response envelope (utils/response.js)
// and repository/service layer field shapes — snake_case from DB columns,
// camelCase from computed/service-layer fields.

export interface APIResponse<T> {
  success: boolean
  message: string
  data: T
  timestamp: string
}

export interface PaginatedResponse<T> {
  success: boolean
  message: string
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  timestamp: string
}

export interface APIError {
  success: false
  message: string
  errors?: Array<{ field: string; message: string; code: string }>
  timestamp: string
}

// ── Tourist ────────────────────────────────────────────────────────────────
export interface EmergencyContact {
  id?: string
  name: string
  phone: string
  relation: string
  tier: 1 | 2
  notifyOnSOS: boolean
}

export interface Tourist {
  id: string
  full_name: string
  phone: string
  email: string | null
  blood_group: string | null
  medical_info: string | null
  emergency_contacts: EmergencyContact[]
  govt_id_type: string
  govt_id_suffix: string
  guardian_token: string
  guardian_token_expires: string
  rescue_readiness_score: number
  profile_photo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  tourist: Tourist
  token: string
}

export interface GovtUser {
  id: string
  name: string
  email: string
  role: string
  district: string | null
  state: string | null
  is_active: boolean
}

export interface GovtAuthResponse {
  user: GovtUser
  token: string
}

// ── Trip ───────────────────────────────────────────────────────────────────
export interface Activity {
  name: string
  type: string
  cost: number
  duration?: string
  notes?: string
}

export interface Stop {
  city: string
  state: string
  destinationId: string | null
  lat: number | null
  lng: number | null
  days: number
  arrivalDate: string | null
  departureDate: string | null
  activities: Activity[]
  notes: string | null
  connectivity: string
  difficulty: string
  altitude_m: number
  zone_type: string
  hospital_km: number
  eta_minutes: number | null
}

export interface PackingItem {
  id: string
  item: string
  category: string
  essential: boolean
  packed: boolean
}

export interface Trip {
  id: string
  tourist_id: string
  title: string
  description: string | null
  travel_type: string
  start_date: string          // YYYY-MM-DD
  end_date: string            // YYYY-MM-DD
  status: string
  stops: Stop[]
  budget_inr: number | null
  cover_image_url: string | null
  packing_checklist: PackingItem[]
  trip_notes: string | null
  is_public: boolean
  public_token: string | null
  tsi_score: number | null
  tsi_label: string | null
  tsi_factors: Record<string, number>
  tsi_recommendations: string[]
  tsi_updated_at: string | null
  rescue_readiness: Record<string, boolean>
  rescue_readiness_score: number
  created_at: string
  updated_at: string
  // Computed fields from backend joins:
  stop_count?: number
  author_name?: string
}

// ── SOS ────────────────────────────────────────────────────────────────────
export interface SOSEvent {
  id: string
  tourist_id: string
  trip_id: string | null
  latitude: number
  longitude: number
  location_accuracy_m: number | null
  is_stale_location: boolean
  category: string
  message: string | null
  trigger_type: string
  status: string
  battery_pct: number | null
  contacts_notified: Array<{ phone: string; tier: number; method: string; notifiedAt: string }>
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  // LEFT JOIN fields (findByTouristId / findActive) — SQL LEFT JOIN yields
  // null when unmatched, not undefined, so these are optional-and-nullable.
  assignment_status?: string | null
  rescue_team_name?: string | null
}

// ── DMS ────────────────────────────────────────────────────────────────────
export interface DMS {
  id: string
  tourist_id: string
  trip_id: string | null
  interval_minutes: number
  last_reset_at: string
  next_trigger_at: string
  warning_sent_at: string | null
  status: string
  sos_event_id: string | null
  created_at: string
  // Computed via SQL EXTRACT(EPOCH...) — only present on the response from
  // GET /dms/active (findActiveByTouristId). create()/reset() return the
  // plain row without these, since they don't run that same query.
  seconds_remaining?: number
  seconds_to_warning?: number
}

// ── Checkin ────────────────────────────────────────────────────────────────
export interface Checkin {
  id: string
  tourist_id: string
  trip_id: string | null
  dms_id: string | null
  latitude: number | null
  longitude: number | null
  battery_pct: number | null
  message: string | null
  type: string
  created_at: string
}

// ── Destination ────────────────────────────────────────────────────────────
export interface Destination {
  id: string
  name: string
  state: string
  latitude: number | null
  longitude: number | null
  connectivity: string
  difficulty: string
  altitude_m: number
  zone_type: string
  ilp_required: boolean
  nearest_hospital_name: string | null
  nearest_hospital_km: number | null
  nearest_hospital_phone: string | null
  nearest_police_km: number | null
  govt_advisory: string | null
  popularity_index: number
  description: string | null
  best_months: string | null
  created_at: string
  // Weather cache joined fields (destination.repository.js LEFT JOINs
  // weather_cache; findAll() omits humidity_pct/wind_kmh/tsi_weather_delta,
  // findById() includes them — treat all as optional).
  weather_condition?: string
  weather_risk?: string
  temp_celsius?: number
  humidity_pct?: number
  wind_kmh?: number
  weather_desc?: string
  risk_reason?: string
  tsi_weather_delta?: number
  weather_updated_at?: string
  scam_count?: number
}

// ── Scam report ────────────────────────────────────────────────────────────
// scam.repository.js#findByDestination() selects a narrower column list than
// create()'s RETURNING * — destination_id/tourist_id are absent from list
// responses, present only right after creating a report.
export interface ScamReport {
  id: string
  destination_id?: string | null
  tourist_id?: string | null
  category: string
  description: string
  incident_date: string | null
  verified: boolean
  created_at: string
}

// ── Guardian view (public, privacy-safe subset — tourist.service.js#getGuardianView) ──
export interface GuardianView {
  firstName: string
  bloodGroup: string | null
  medicalInfo: string | null
  location: {
    latitude: number
    longitude: number
    batteryPct: number | null
    updatedAt: string
  } | null
  activeSOS: {
    id: string
    category: string
    status: string
    createdAt: string
    handoffVerifiedAt: string | null
    rescueTeam: {
      name: string
      type: string
      etaMinutes: number | null
    } | null
    // Live rescuer marker — see tourist.service.js#getGuardianView. isLive
    // distinguishes a volunteer's real GPS fix from a still-at-base guess
    // (official teams have no live feed, so theirs is always false).
    rescuer: {
      kind: 'TEAM' | 'VOLUNTEER'
      name: string
      latitude: number
      longitude: number
      isLive: boolean
    } | null
  } | null
  activeTripCity: string | null
  tsiScore: number | null
  tsiLabel: string | null
}

// ── Govt types ─────────────────────────────────────────────────────────────
export interface GovtDashboard {
  activeSOS: number
  assignedSOS: number
  resolvedToday: number
  activeTourists: number
  availableTeams: number
  deployedTeams: number
  activeDMS: number
  recentSOS: Array<{
    id: string
    category: string
    status: string
    created_at: string
    full_name: string
    phone: string
  }>
}

export interface SOSWithDetails extends SOSEvent {
  full_name: string
  phone: string
  blood_group: string | null
  emergency_contacts: EmergencyContact[]
  govt_id_suffix: string
  last_battery: number | null
  last_location_update: string | null
  assignment_id: string | null
  rescue_team_name: string | null
  rescue_team_type: string | null
  team_phone: string | null
}

export interface RescueTeam {
  id: string
  name: string
  type: string
  district: string
  state: string
  contact_phone: string
  status: string
  latitude: number | null
  longitude: number | null
  capacity: number
  created_at: string
  active_assignments?: number
}

export interface RescueAssignment {
  id: string
  sos_event_id: string
  team_id: string
  assigned_by: string | null
  status: string
  notes: string | null
  assigned_at: string
  resolved_at: string | null
}

// location.repository.js#findLive() — joins tourist_locations + tourists +
// active trip, plus two count subqueries. `id` here is the tourist's id
// (selected as t.id), not a separate location row id.
export interface LiveTourist {
  id: string
  full_name: string
  phone: string
  blood_group: string | null
  latitude: number
  longitude: number
  battery_pct: number | null
  updated_at: string
  active_sos_count: number
  active_dms_count: number
  active_trip_title: string | null
  tsi_score: number | null
  tsi_label: string | null
}

// Chat message — Tourist<->Guardian (sos_event_id null) or Tourist<->Rescuer
// (sos_event_id set), see backend/src/repositories/message.repository.js.
export interface Message {
  id: string
  conversation_type: "TOURIST_GUARDIAN" | "TOURIST_RESCUER"
  tourist_id: string
  sos_event_id: string | null
  sender_kind: "TOURIST" | "GUARDIAN" | "VOLUNTEER" | "TEAM"
  sender_id: string | null
  body: string
  read_at: string | null
  created_at: string
}
