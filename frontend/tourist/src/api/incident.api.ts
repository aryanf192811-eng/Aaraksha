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
}

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
}

const incidentApi = {
  fileIncident: (data: FileIncidentPayload) =>
    api.post<APIResponse<IncidentReport>>('/incidents', data),

  getMyIncidents: () =>
    api.get<APIResponse<IncidentReport[]>>('/incidents/me'),
}

export default incidentApi
