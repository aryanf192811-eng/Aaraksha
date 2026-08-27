// src/api/incident.api.ts
// FIELD NAMES: verified against backend src/validators/incident.validator.js
// E-FIR-style triage workflow — an after-the-fact report (theft,
// harassment...) routed to a govt officer for investigation. Distinct from
// scam.api.ts, which posts a crowd-sourced community warning with no
// officer or case number attached.
import api from './client'
import type { APIResponse } from '../types/api.types'

export type IncidentCategory = 'THEFT' | 'HARASSMENT' | 'ASSAULT' | 'FRAUD' | 'LOST_DOCUMENT' | 'VEHICLE_ACCIDENT' | 'PROPERTY_DAMAGE' | 'OTHER'
export type IncidentStatus = 'FILED' | 'ASSIGNED' | 'UNDER_INVESTIGATION' | 'RESOLVED' | 'CLOSED'

export interface FileIncidentPayload {
  tripId?: string | null
  category: IncidentCategory
  description: string
  locationText?: string | null
  incidentOccurredAt?: string | null
  // The photo itself, plus the on-device COCO-SSD detection result for
  // it (see lib/incidentVision.ts) — sent as a JSON string because
  // multipart forms can't carry a nested array field directly.
  photo?: File | null
  detectedTagsJson?: string | null
}

export interface DetectedTag { class: string; score: number }

export interface IncidentReport {
  id: string
  case_number: string
  category: IncidentCategory
  description: string
  location_text: string | null
  incident_occurred_at: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  status: IncidentStatus
  assigned_officer_name: string | null
  resolution_notes: string | null
  filed_at: string
  photo_url: string | null
  detected_tags: DetectedTag[] | null
}

const incidentApi = {
  fileIncident: (data: FileIncidentPayload) => {
    const form = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'photo' || value === undefined || value === null) return
      form.append(key, String(value))
    })
    if (data.photo) form.append('photo', data.photo)

    // Same reasoning as review.api.ts#create — axios won't override an
    // already-present Content-Type header for a FormData body, so it has
    // to be explicitly unset for the browser to generate the correct
    // 'multipart/form-data; boundary=...' itself.
    return api.post<APIResponse<IncidentReport>>('/incidents', form, {
      headers: { 'Content-Type': undefined },
    })
  },

  getMyIncidents: () =>
    api.get<APIResponse<IncidentReport[]>>('/incidents/me'),
}

export default incidentApi
