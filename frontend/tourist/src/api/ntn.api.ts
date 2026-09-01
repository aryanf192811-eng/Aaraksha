// src/api/ntn.api.ts
// FIELD NAMES: verified against backend src/validators/ntn.validator.js
import api from './client'
import type { APIResponse, SOSEvent } from '../types/api.types'

export type NTNScenario = 'CLEAR_SKY' | 'MOUNTAIN_VALLEY' | 'NO_VISIBILITY'

export interface NTNChannelState {
  satelliteId: string
  scenario: NTNScenario
  satelliteVisible: boolean
  signalPct: number
  latencyMs: number
  packetLossPct: number
}

export interface NTNUplinkPayload {
  scenario: NTNScenario
  latitude: number
  longitude: number
  category?: string
  message?: string | null
  batteryPct?: number | null
  tripId?: string | null
  locationAccuracyM?: number | null
  isStaleLocation?: boolean
}

export interface NTNUplinkResult {
  delivered: boolean
  sosEvent: SOSEvent | null
  channel: NTNChannelState
}

const ntnApi = {
  getStatus: (scenario: NTNScenario = 'CLEAR_SKY') =>
    api.get<APIResponse<NTNChannelState>>('/ntn/status', { params: { scenario } }),

  sendUplink: (data: NTNUplinkPayload) =>
    api.post<APIResponse<NTNUplinkResult>>('/ntn/uplink', data),
}

export default ntnApi
