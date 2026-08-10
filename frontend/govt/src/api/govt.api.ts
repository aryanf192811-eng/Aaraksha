// src/api/govt.api.ts
// FIELD NAMES: verified against backend src/services/govt.service.js and
// src/repositories/{sos,rescue}.repository.js. getRiskOverview/getAnalytics
// are typed from the real return shapes (the original spec left these as
// `unknown` — traced the actual repository methods instead).
import api from './client'
import { useAuthStore } from '../store/auth.store'
import type {
  APIResponse, PaginatedResponse, GovtDashboard, SOSWithDetails, RescueTeam, LiveTourist,
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

export interface PostNewsPayload {
  category: 'WEATHER' | 'ROAD_CLOSURE' | 'EVENT' | 'ADVISORY' | 'FESTIVAL' | 'OTHER'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  headline: string
  body?: string
  source?: string
}

const govtApi = {
  getDashboard: () =>
    api.get<APIResponse<GovtDashboard>>('/govt/dashboard'),

  getActiveSOS: (params?: { status?: string; category?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<SOSWithDetails>>('/govt/sos/active', { params }),

  assignRescue: (sosId: string, data: { teamId: string; notes?: string }) =>
    api.patch<APIResponse<{ assignment: unknown; sosStatus: string; teamStatus: string }>>(
      `/govt/sos/${sosId}/assign`, data
    ),

  resolveSOS: (sosId: string, data: { resolutionNotes?: string }) =>
    api.patch<APIResponse<SOSWithDetails>>(`/govt/sos/${sosId}/resolve`, data),

  getLiveTourists: () =>
    api.get<APIResponse<LiveTourist[]>>('/govt/tourists/live'),

  getRiskOverview: () =>
    api.get<APIResponse<RiskOverviewEntry[]>>('/govt/risk-overview'),

  getRescueTeams: () =>
    api.get<APIResponse<RescueTeam[]>>('/govt/rescue-teams'),

  updateTeamStatus: (id: string, status: string) =>
    api.patch<APIResponse<RescueTeam>>(`/govt/rescue-teams/${id}/status`, { status }),

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

  scanCheckpoint: (data: { token: string; checkpointName: string; district?: string; latitude?: number; longitude?: number }) =>
    api.post<APIResponse<CheckpointScanResult>>('/govt/checkpoint/scan', data),

  getRecentCheckpointScans: (limit = 20) =>
    api.get<APIResponse<RecentCheckpointScan[]>>('/govt/checkpoint/recent', { params: { limit } }),

  postDestinationNews: (destinationId: string, data: PostNewsPayload) =>
    api.post<APIResponse<unknown>>(`/govt/destinations/${destinationId}/news`, data),
}

export default govtApi
