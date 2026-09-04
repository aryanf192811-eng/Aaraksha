// src/api/news.api.ts
import api from './client'
import type { APIResponse, PaginatedResponse } from '../types/api.types'

export interface DestinationNews {
  id: string
  destination_id: string
  destination_name?: string
  destination_state?: string
  category: 'WEATHER' | 'ROAD_CLOSURE' | 'EVENT' | 'ADVISORY' | 'FESTIVAL' | 'OTHER'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  headline: string
  body: string | null
  source: string
  published_at: string
}

export interface NewsFeedFilters {
  state?: string
  severity?: DestinationNews['severity']
  category?: DestinationNews['category']
  page?: number
  limit?: number
}

const newsApi = {
  getForTrip: (tripId: string) =>
    api.get<APIResponse<DestinationNews[]>>(`/trips/${tripId}/news`),

  getForDestination: (destinationId: string) =>
    api.get<APIResponse<DestinationNews[]>>(`/destinations/${destinationId}/news`),

  // General, filterable feed across every destination — backs the /news page.
  getAll: (params?: NewsFeedFilters) =>
    api.get<PaginatedResponse<DestinationNews>>('/destinations/news', { params }),
}

export default newsApi
