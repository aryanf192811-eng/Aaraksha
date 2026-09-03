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
  // Display-only count of govt-verified local providers at this stop --
  // full LocalOperator objects live on the destination record itself
  // (see Destination.localOperators in api.types.ts), fetched separately
  // when the stop is opened in StopDetailSheet.
  localOperatorsCount?: number
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

  // Part 1 -- natural-language trip intake. Only ever pre-fills the
  // structured form; never skips straight to a result.
  extractIntent: (text: string) =>
    api.post<APIResponse<{
      fromCity: string | null; region: string | null; days: number | null; budgetInr: number | null
      interests: Interest[]; transportPref: TransportMode[]; understood: boolean
    }>>('/travel-planner/extract-intent', { text }),

  // Part 2 -- AI-assisted adjustment of an ALREADY-COMMITTED trip.
  // adjustTrip only ever returns a proposal; nothing is written until
  // applyTripAdjustment is called explicitly. See travelPlanner.service.js
  // for why applyTripAdjustment takes only stop IDENTITY (orderedStopIds +
  // days) and never a client-supplied cost -- the server always
  // recomputes totalCostInr itself.
  // `after` has no externalLegs -- unlike a fresh build-journey result,
  // an adjustment to an already-committed trip has no fresh "how you got
  // to Guwahati" leg to show, only the NE-internal itinerary that changed.
  adjustTrip: (tripId: string, freeText: string) =>
    api.post<APIResponse<
      | { understood: false; message: string }
      | {
          understood: true
          before: { totalCostInr: number; days: number; stopNames: string[]; tsiScore: number | null }
          after: Omit<BuildJourneyResult, 'externalLegs'> & { daysUsedForScoring: number }
          skippedManualStops: number
        }
    >>(`/travel-planner/trips/${tripId}/adjust`, { freeText }),

  applyTripAdjustment: (tripId: string, orderedStopIds: string[], days: number) =>
    api.post<APIResponse<{ id: string; stops: unknown[]; budget_inr: number; tsi_score: number | null }>>(
      `/travel-planner/trips/${tripId}/apply-adjustment`, { orderedStopIds, days }
    ),

  // For StopDetailSheet.tsx -- every curated leg between one specific
  // stop pair (not just the single representative one build-journey
  // scores with), plus the destination's review summary.
  getRoutesBetween: (fromId: string, toId: string) =>
    api.get<APIResponse<{
      routes: JourneyLeg[]
      reviewSummary: { avgRating: number | null; avgCostInr: number | null; reviewCount: number; sampleTips: string[]; commonFeltSafe: string | null } | null
    }>>('/travel-planner/routes-between', { params: { from: fromId, to: toId } }),
}

export default travelPlannerApi
