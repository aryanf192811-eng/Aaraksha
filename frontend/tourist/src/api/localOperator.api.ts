// src/api/localOperator.api.ts
// Trust Economy loop (migration 029) — plain JSON, unlike review.api.ts's
// destination reviews, since a provider review carries no photos.
import api from './client'
import type { APIResponse, LocalOperatorReview } from '../types/api.types'

export interface OperatorReviewAggregate {
  reviewCount: number
  avgRating: number | null
}

export interface CreateOperatorReviewPayload {
  tripId?: string
  rating: number
  reviewText?: string
}

const localOperatorApi = {
  getReviews: (operatorId: string) =>
    api.get<APIResponse<{ reviews: LocalOperatorReview[]; total: number; aggregate: OperatorReviewAggregate }>>(
      `/local-operators/${operatorId}/reviews`
    ),

  createReview: (operatorId: string, data: CreateOperatorReviewPayload) =>
    api.post<APIResponse<LocalOperatorReview & { touristLocalPoints: number | null; pointsAwarded: number }>>(
      `/local-operators/${operatorId}/reviews`, data
    ),
}

export default localOperatorApi
