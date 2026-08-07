// src/api/govt.api.ts
// FIELD NAMES: verified against backend src/services/govt.service.js and
// src/repositories/{sos,rescue}.repository.js. getRiskOverview/getAnalytics
// are typed from the real return shapes (the original spec left these as
// `unknown` — traced the actual repository methods instead).
import api from './client'
import type {
  APIResponse, PaginatedResponse, GovtDashboard, SOSWithDetails, RescueTeam, LiveTourist,
} from '../types/api.types'

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

  exportAnalyticsReport: (period?: string) =>
    api.get('/govt/analytics/export', { params: { period }, responseType: 'blob' }),
}

export default govtApi
