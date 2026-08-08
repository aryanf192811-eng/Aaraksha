// src/api/review.api.ts
import api from './client'
import type { APIResponse } from '../types/api.types'

export interface DestinationReview {
  id: string
  destination_id: string
  tourist_id: string
  tourist_name: string
  trip_id: string | null
  rating: number
  review_text: string | null
  photo_urls: string[]
  video_url: string | null
  actual_cost_inr: number | null
  time_spent_hours: number | null
  crowd_level: 'LOW' | 'MEDIUM' | 'HIGH' | null
  cleanliness_rating: number | null
  felt_safe: 'YES' | 'NO' | 'SOMEWHAT' | null
  transport_rating: number | null
  food_availability_rating: number | null
  accessibility_rating: number | null
  liked_text: string | null
  disliked_text: string | null
  tips_text: string | null
  visited_date: string | null
  created_at: string
}

export interface ReviewAggregate {
  review_count: number
  avg_rating: string | null
  avg_cost_inr: string | null
  avg_time_spent_hours: string | null
  common_crowd_level: string | null
  felt_safe_count: number
}

export interface CreateReviewPayload {
  tripId?: string
  rating: number
  reviewText?: string
  videoUrl?: string
  actualCostInr?: number
  timeSpentHours?: number
  crowdLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
  cleanlinessRating?: number
  feltSafe?: 'YES' | 'NO' | 'SOMEWHAT'
  transportRating?: number
  foodAvailabilityRating?: number
  accessibilityRating?: number
  likedText?: string
  dislikedText?: string
  tipsText?: string
  visitedDate?: string
  photos?: File[]
}

const reviewApi = {
  getForDestination: (destinationId: string) =>
    api.get<APIResponse<{ reviews: DestinationReview[]; total: number; aggregate: ReviewAggregate }>>(
      `/destinations/${destinationId}/reviews`
    ),

  create: (destinationId: string, data: CreateReviewPayload) => {
    const form = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'photos' || value === undefined || value === null) return
      form.append(key, String(value))
    })
    ;(data.photos || []).forEach((file) => form.append('photos', file))

    // The axios instance sets a default 'application/json' Content-Type
    // header — axios does NOT automatically override an already-present
    // header for FormData bodies (verified: without this, the browser
    // sent literal 'application/json' and multer received no file at
    // all). Explicitly unsetting it here lets the browser generate the
    // correct 'multipart/form-data; boundary=...' itself.
    return api.post<APIResponse<DestinationReview>>(`/destinations/${destinationId}/reviews`, form, {
      headers: { 'Content-Type': undefined },
    })
  },
}

export default reviewApi
