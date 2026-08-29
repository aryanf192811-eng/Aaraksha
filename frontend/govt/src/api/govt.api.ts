// src/api/govt.api.ts
// FIELD NAMES: verified against backend src/services/govt.service.js and
// src/repositories/{sos,rescue}.repository.js. getRiskOverview/getAnalytics
// are typed from the real return shapes (the original spec left these as
// `unknown` — traced the actual repository methods instead).
import api from './client'
import { useAuthStore } from '../store/auth.store'
import type {
  APIResponse, PaginatedResponse, GovtDashboard, SOSWithDetails, RescueTeam, LiveTourist, Volunteer,
} from '../types/api.types'

const API_URL = import.meta.env.VITE_API_URL

export interface RiskOverviewEntry {
  destinationId: string | null
  city: string
  state: string
  zoneType: string
  connectivity: string
  total: number
  solo: number
  highRisk: number
  weather: {
    weather_condition?: string
    weather_risk?: string
    temp_celsius?: number
  } | null
  altitudeM: number | null
  difficulty: string | null
  nearestHospitalName: string | null
  nearestHospitalKm: string | null
  govtAdvisory: string | null
  description: string | null
  ilpRequired: boolean
  latitude: number | null
  longitude: number | null
  // A genuinely distinct signal from zoneType/TSI above — a real trained
  // logistic regression (see backend/scripts/trainRiskModel.js), not a
  // rule-based score. Null until the model has been trained.
  predictedRisk: PredictedRisk | null
}

export interface PredictedRisk {
  probability: number
  percentage: number
  label: 'Low' | 'Moderate' | 'Elevated'
  topFactors: Array<{ feature: string; contribution: number }>
}

export interface RiskModelInfo {
  version: number
  trainedAt: string
  trainingSamples: number
  testSamples: number
  testMetrics: { accuracy: number; precision: number; recall: number; f1: number }
  featureWeights: Array<{ feature: string; weight: number }>
  labelSourceNote: string
}

export interface AnalyticsResponse {
  perDay: Array<{ day: string; count: number }>
  byCategory: Array<{ category: string; count: number }>
  totals: { total: number; resolved: number; active: number }
  avgResponseMinutes: number
}

export interface CheckpointScanResult {
  scan: { id: string; checkpointName: string; district: string | null; latitude: string | null; longitude: string | null; scannedAt: string }
  tourist: {
    id: string
    fullName: string
    phone: string
    bloodGroup: string | null
    medicalInfo: string | null
    govtIdType: string
    govtIdSuffix: string
    profilePhotoUrl: string | null
    emergencyContacts: Array<{ name: string; phone: string; relation: string; verified?: boolean }>
  }
  activeTrip: { id: string; city: string | null; tsiScore: number | null; tsiLabel: string | null } | null
}

export interface RecentCheckpointScan {
  id: string
  checkpoint_name: string
  district: string | null
  scanned_at: string
  tourist_name: string
  tourist_phone: string
  scanned_by: string | null
}

// Unifies official rescue teams and govt-verified volunteers into one
// distance-sorted candidate list — see rescue.repository.js#findNearbyAvailableRescuers.
export interface NearbyRescuer {
  id: string
  name: string
  kind: 'TEAM' | 'VOLUNTEER'
  type: string
  district: string
  phone: string
  latitude: string
  longitude: string
  distanceKm: number
  // Weighted dispatch ranking (see backend/src/utils/rescueScoring.js) —
  // distance + how well this rescuer's type suits the SOS category +
  // reputation, explainable via scoreBreakdown rather than a bare number.
  score: number
  scoreBreakdown: { distance: number; categoryMatch: number; reputation: number }
  isSpecialistMatch: boolean
}

// One row per in-progress assignment — powers the Live Map's rescuer
// markers. See rescue.repository.js#findActiveAssignmentsWithPositions.
// `latitude`/`longitude` prefers the rescuer's live GPS fix (is_live: true)
// and falls back to their registered base, same as the tourist/Guardian views.
export interface ActiveRescuer {
  assignment_id: string
  status: 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED'
  sos_event_id: string
  sos_latitude: string
  sos_longitude: string
  category: string
  tourist_name: string
  rescuer_kind: 'TEAM' | 'VOLUNTEER'
  rescuer_name: string
  latitude: string
  longitude: string
  is_live: boolean
}

// Rule-based, always-on safety net — see backend anomaly.service.js. Not an
// SOS: "this needs a human to check on," not "an emergency is confirmed."
export interface AnomalyEntry {
  id: string
  tourist_id: string
  trip_id: string | null
  type: 'INACTIVITY' | 'ROUTE_DEVIATION'
  last_latitude: string | null
  last_longitude: string | null
  last_location_at: string | null
  distance_from_route_km: string | null
  details: string
  status: 'OPEN' | 'RESOLVED'
  detected_at: string
  full_name: string
  phone: string
  blood_group: string | null
  trip_title: string | null
  tsi_score: number | null
  tsi_label: string | null
}

export interface CreateVolunteerPayload {
  fullName: string
  phone: string
  govtIdType: 'AADHAAR' | 'PASSPORT' | 'VOTER_ID' | 'DRIVING_LICENSE'
  govtIdNumber: string
  district: string
  state: string
  latitude?: number
  longitude?: number
}

export interface PostNewsPayload {
  category: 'WEATHER' | 'ROAD_CLOSURE' | 'EVENT' | 'ADVISORY' | 'FESTIVAL' | 'OTHER'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  headline: string
  body?: string
  source?: string
}

// E-FIR-style triage workflow — see backend migration
// 012_incident_reports. An after-the-fact report a tourist files (theft,
// harassment...), routed to an officer for investigation. Distinct from an
// SOS (a live emergency) and from a scam report (a crowd-sourced warning
// with no officer or case number attached).
export type IncidentCategory = 'THEFT' | 'HARASSMENT' | 'ASSAULT' | 'FRAUD' | 'LOST_DOCUMENT' | 'VEHICLE_ACCIDENT' | 'PROPERTY_DAMAGE' | 'OTHER'
export type IncidentStatus = 'FILED' | 'ASSIGNED' | 'UNDER_INVESTIGATION' | 'RESOLVED' | 'CLOSED'
export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface IncidentEntry {
  id: string
  case_number: string
  tourist_id: string | null
  trip_id: string | null
  category: IncidentCategory
  description: string
  location_text: string | null
  latitude: string | null
  longitude: string | null
  incident_occurred_at: string | null
  priority: IncidentPriority
  status: IncidentStatus
  assigned_officer_id: string | null
  assigned_officer_name: string | null
  assigned_officer_role?: string
  assigned_at: string | null
  resolution_notes: string | null
  resolved_at: string | null
  filed_at: string
  full_name: string | null
  phone: string | null
  govt_id_suffix?: string | null
  trip_title?: string | null
  // On-device COCO-SSD detection over the tourist's attached photo (see
  // frontend/tourist/src/lib/incidentVision.ts) — shown as-is, exactly
  // what their device detected, not reinterpreted server-side.
  photo_url: string | null
  detected_tags: Array<{ class: string; score: number }> | null
}

export interface AssignableOfficer {
  id: string
  name: string
  role: string
  district: string
}

const govtApi = {
  getDashboard: () =>
    api.get<APIResponse<GovtDashboard>>('/govt/dashboard'),

  getActiveSOS: (params?: { status?: string; category?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<SOSWithDetails>>('/govt/sos/active', { params }),

  assignRescue: (sosId: string, data: { teamId?: string; volunteerId?: string; notes?: string }) =>
    api.patch<APIResponse<{ assignment: unknown; sosStatus: string; rescuerKind: 'TEAM' | 'VOLUNTEER' }>>(
      `/govt/sos/${sosId}/assign`, data
    ),

  getNearbyRescuers: (sosId: string) =>
    api.get<APIResponse<NearbyRescuer[]>>(`/govt/sos/${sosId}/nearby-rescuers`),

  getActiveRescuers: () =>
    api.get<APIResponse<ActiveRescuer[]>>('/govt/active-rescuers'),

  getAnomalies: () =>
    api.get<APIResponse<AnomalyEntry[]>>('/govt/anomalies'),

  resolveAnomaly: (id: string) =>
    api.patch<APIResponse<AnomalyEntry>>(`/govt/anomalies/${id}/resolve`),

  getIncidentQueue: (params?: { status?: IncidentStatus; category?: IncidentCategory; assignedToMe?: boolean; unassigned?: boolean; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<IncidentEntry>>('/govt/incidents', { params }),

  getIncident: (id: string) =>
    api.get<APIResponse<IncidentEntry>>(`/govt/incidents/${id}`),

  getAssignableOfficers: () =>
    api.get<APIResponse<AssignableOfficer[]>>('/govt/incidents/officers'),

  assignIncident: (id: string, officerId?: string) =>
    api.patch<APIResponse<IncidentEntry>>(`/govt/incidents/${id}/assign`, officerId ? { officerId } : {}),

  updateIncidentStatus: (id: string, data: { status: IncidentStatus; resolutionNotes?: string; priority?: IncidentPriority }) =>
    api.patch<APIResponse<IncidentEntry>>(`/govt/incidents/${id}/status`, data),

  // Same direct-navigation reasoning as getIncidentReportUrl above.
  getEfirReportUrl: (incidentId: string) => {
    const token = useAuthStore.getState().token
    return `${API_URL}/govt/incidents/${incidentId}/report?token=${encodeURIComponent(token || '')}`
  },

  resolveSOS: (sosId: string, data: { resolutionNotes?: string; overrideReason?: string }) =>
    api.patch<APIResponse<SOSWithDetails>>(`/govt/sos/${sosId}/resolve`, data),

  verifyHandoffRelay: (sosId: string, code: string) =>
    api.post<APIResponse<SOSWithDetails>>(`/govt/sos/${sosId}/verify-handoff`, { code }),

  getLiveTourists: () =>
    api.get<APIResponse<LiveTourist[]>>('/govt/tourists/live'),

  getRiskOverview: () =>
    api.get<APIResponse<RiskOverviewEntry[]>>('/govt/risk-overview'),

  getRiskModelInfo: () =>
    api.get<APIResponse<RiskModelInfo | null>>('/govt/risk-model/info'),

  getRescueTeams: () =>
    api.get<APIResponse<RescueTeam[]>>('/govt/rescue-teams'),

  updateTeamStatus: (id: string, status: string) =>
    api.patch<APIResponse<RescueTeam>>(`/govt/rescue-teams/${id}/status`, { status }),

  getAllVolunteers: () =>
    api.get<APIResponse<Volunteer[]>>('/govt/volunteers'),

  createVolunteer: (data: CreateVolunteerPayload) =>
    api.post<APIResponse<{ volunteer: Volunteer; temporaryPassword: string }>>('/govt/volunteers', data),

  getPendingVolunteers: () =>
    api.get<APIResponse<Volunteer[]>>('/govt/volunteers/pending'),

  verifyVolunteer: (id: string) =>
    api.patch<APIResponse<Volunteer>>(`/govt/volunteers/${id}/verify`),

  rejectVolunteer: (id: string) =>
    api.patch<APIResponse<Volunteer>>(`/govt/volunteers/${id}/reject`),

  getAnalytics: (period?: string) =>
    api.get<APIResponse<AnalyticsResponse>>('/govt/analytics', { params: { period } }),

  // Direct navigation, not an axios blob fetch + synthetic anchor click —
  // blob: URLs have a real Chromium quirk where the `download` attribute's
  // filename is sometimes ignored and the file lands in history under the
  // blob's internal UUID instead. Navigating straight to the API URL lets
  // the browser use the server's real Content-Disposition header. The
  // ?token= query param exists because a plain navigation can't carry an
  // Authorization header — see backend/src/middleware/auth.js.
  getExportUrl: (period?: string) => {
    const token = useAuthStore.getState().token
    return `${API_URL}/govt/analytics/export?period=${period || '30d'}&token=${encodeURIComponent(token || '')}`
  },

  // Same direct-navigation reasoning as getExportUrl above — only available
  // once the backend confirms the SOS is RESOLVED or FALSE_ALARM (400 otherwise).
  getIncidentReportUrl: (sosId: string) => {
    const token = useAuthStore.getState().token
    return `${API_URL}/govt/sos/${sosId}/report?token=${encodeURIComponent(token || '')}`
  },

  scanCheckpoint: (data: { token: string; checkpointName: string; district?: string; latitude?: number; longitude?: number }) =>
    api.post<APIResponse<CheckpointScanResult>>('/govt/checkpoint/scan', data),

  getRecentCheckpointScans: (limit = 20) =>
    api.get<APIResponse<RecentCheckpointScan[]>>('/govt/checkpoint/recent', { params: { limit } }),

  postDestinationNews: (destinationId: string, data: PostNewsPayload) =>
    api.post<APIResponse<unknown>>(`/govt/destinations/${destinationId}/news`, data),
}

export default govtApi
