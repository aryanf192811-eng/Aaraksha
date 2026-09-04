// src/api/destination.api.ts
// FIELD NAMES: verified against backend src/services/destination.service.js
import api from './client'
import type { APIResponse, Destination, ScamReport, CuratedItinerary } from '../types/api.types'

// Live per-zone tourist density — same aggregation govt.service.js's
// Command Center dashboard uses, exposed read-only to the tourist app too.
export interface RiskOverviewEntry {
  destinationId: string | null
  city: string
  state: string
  zoneType: string
  connectivity: string
  total: number
  solo: number
  highRisk: number
  weather: { weather_condition?: string; weather_risk?: string; temp_celsius?: number } | null
  altitudeM: number | null
  difficulty: string | null
  nearestHospitalName: string | null
  nearestHospitalKm: string | null
  govtAdvisory: string | null
  description: string | null
  ilpRequired: boolean
}

const destinationApi = {
  getAll: (params?: { state?: string; zoneType?: string; search?: string }) =>
    api.get<APIResponse<Destination[]>>('/destinations', { params }),

  getById: (id: string) =>
    api.get<APIResponse<Destination & {
      scamReports: ScamReport[]
      scamAggregate: { total: number; byCategory: Record<string, number> }
    }>>(`/destinations/${id}`),

  getRiskOverview: () =>
    api.get<APIResponse<RiskOverviewEntry[]>>('/destinations/risk-overview'),

  getCuratedItineraries: (region: string) =>
    api.get<APIResponse<CuratedItinerary[]>>('/destinations/curated-itineraries', { params: { region } }),
}

export default destinationApi
