// src/api/travelPlanner.api.ts
// FIELD NAMES: verified against backend src/validators/travelPlanner.validator.js
import api from './client'
import type { APIResponse } from '../types/api.types'

export type Interest = 'NATURE' | 'ADVENTURE' | 'CULTURE' | 'WILDLIFE' | 'RELAXATION'
export type TransportMode = 'TRAIN' | 'FLIGHT' | 'BUS' | 'SHARED_TAXI'

export interface JourneyLeg {
  fromName: string
  toName: string
  mode: string
  durationMinutes: number | null
  costMinInr: number | null
  costMaxInr: number | null
  notes: string | null
  estimated: boolean
}

export interface JourneyStop {
  id: string
  name: string
  state: string
  lat: string
  lng: string
  matchedInterests: string[]
  popularityIndex: number
  reviewSummary: {
    avgRating: number | null
    avgCostInr: number | null
    reviewCount: number
    sampleTips: string[]
    commonFeltSafe: string | null
  } | null
}

export interface JourneyItinerary {
  orderedStops: JourneyStop[]
  legs: JourneyLeg[]
  totalCostInr: number
  daysNeeded: number
  scores: { overall: number; budget: number; duration: number; safety: number; interestMatch: number; backtracking: number }
  safety: { stopRisks: unknown[]; worstStop: { city: string; label: string } | null }
  localSpendEstimated: boolean
}

export interface BuildJourneyResult {
  externalLegs: { outbound: JourneyLeg; return: JourneyLeg }
  itinerary: JourneyItinerary
  totalCostInr: number
  whyThisRoute: string[]
  narrativeSource: 'GEMINI_AI' | 'TEMPLATED_FALLBACK'
}

export interface BuildJourneyPayload {
  fromCity: string
  region: string
  days: number
  budgetInr?: number | null
  travelType?: string
  interests?: Interest[]
  transportPref?: TransportMode[]
}

const travelPlannerApi = {
  buildJourney: (data: BuildJourneyPayload) =>
    api.post<APIResponse<BuildJourneyResult>>('/travel-planner/build-journey', data),

  askFollowUp: (question: string, currentContext: BuildJourneyPayload & { stopNames?: string[] }) =>
    api.post<APIResponse<
      | { understood: false; message: string }
      | (BuildJourneyResult & { understood: true; appliedContext: BuildJourneyPayload })
    >>('/travel-planner/ask', { question, currentContext }),

  commitJourney: (data: { title: string; startDate: string; endDate: string; travelType?: string; totalCostInr: number; itinerary: JourneyItinerary }) =>
    api.post<APIResponse<{ id: string }>>('/travel-planner/commit', data),
}

export default travelPlannerApi
