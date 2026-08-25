// src/api/scam.api.ts
// FIELD NAMES: verified against backend src/validators/scam.validator.js
import api from './client'
import type { APIResponse, ScamReport } from '../types/api.types'

export interface CreateScamReportPayload {
  destinationId: string
  category: string           // FAKE_GUIDE|OVERCHARGING|THEFT|HARASSMENT|UNSAFE_AREA|OTHER
  description: string        // min 10 chars
  incidentDate?: string | null
}

export interface ScamHotspot {
  destination_id: string
  name: string
  state: string
  recent_count: number
  last_reported_at: string
  top_category: string
}

const scamApi = {
  createReport: (data: CreateScamReportPayload) =>
    api.post<APIResponse<ScamReport>>('/scam-reports', data),

  getByDestination: (destinationId: string) =>
    api.get<APIResponse<{
      reports: ScamReport[]
      aggregate: { total: number; byCategory: Record<string, number> }
    }>>(`/scam-reports/${destinationId}`),

  getHotspots: () =>
    api.get<APIResponse<ScamHotspot[]>>('/scam-reports/hotspots'),
}

export default scamApi
