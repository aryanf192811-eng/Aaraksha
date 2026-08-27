// src/api/dataRights.api.ts
// Digital Personal Data Protection Act, 2023 (DPDP) rights — access,
// correction (already served by tourist.api.ts#updateMe), erasure, and
// grievance redressal, made real rather than a privacy-policy paragraph.
import api from './client'
import { useAuthStore } from '../store/auth.store'
import type { APIResponse } from '../types/api.types'

const API_URL = import.meta.env.VITE_API_URL

export interface PrivacyNotice {
  categories: Array<{ data: string; purpose: string }>
  rights: Array<{ right: string; how: string }>
}

export interface DeletionRequest {
  id: string
  status: 'PENDING' | 'COMPLETED' | 'DENIED'
  reason: string | null
  requested_at: string
  processed_at: string | null
}

export interface DeletionResult {
  status: 'COMPLETED' | 'DENIED'
  reason: string | null
}

const dataRightsApi = {
  getPrivacyNotice: () =>
    api.get<APIResponse<PrivacyNotice>>('/tourists/me/privacy-notice'),

  getMyDeletionRequests: () =>
    api.get<APIResponse<DeletionRequest[]>>('/tourists/me/deletion-requests'),

  requestDeletion: () =>
    api.post<APIResponse<DeletionResult>>('/tourists/me/deletion-request'),

  // Same direct-navigation reasoning as passport.api.ts — a real file
  // download with a real Content-Disposition header, not a blob fetch.
  getExportUrl: () => {
    const token = useAuthStore.getState().token
    return `${API_URL}/tourists/me/data-export?token=${encodeURIComponent(token || '')}`
  },
}

export default dataRightsApi
