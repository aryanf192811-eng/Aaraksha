// src/api/news.api.ts
import api from './client'
import type { APIResponse } from '../types/api.types'

export interface DestinationNews {
  id: string
  destination_id: string
  destination_name?: string
  category: 'WEATHER' | 'ROAD_CLOSURE' | 'EVENT' | 'ADVISORY' | 'FESTIVAL' | 'OTHER'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  headline: string
  body: string | null
  source: string
  published_at: string
}

const newsApi = {
  getForTrip: (tripId: string) =>
    api.get<APIResponse<DestinationNews[]>>(`/trips/${tripId}/news`),

  getForDestination: (destinationId: string) =>
    api.get<APIResponse<DestinationNews[]>>(`/destinations/${destinationId}/news`),
}

export default newsApi
