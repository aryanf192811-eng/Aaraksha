// src/api/destination.api.ts
// FIELD NAMES: verified against backend src/services/destination.service.js
import api from './client'
import type { APIResponse, Destination, ScamReport } from '../types/api.types'

const destinationApi = {
  getAll: (params?: { state?: string; zoneType?: string; search?: string }) =>
    api.get<APIResponse<Destination[]>>('/destinations', { params }),

  getById: (id: string) =>
    api.get<APIResponse<Destination & {
      scamReports: ScamReport[]
      scamAggregate: { total: number; byCategory: Record<string, number> }
    }>>(`/destinations/${id}`),
}

export default destinationApi
