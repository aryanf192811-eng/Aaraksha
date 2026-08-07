// src/api/packing.api.ts
// FIELD NAMES: verified against backend src/services/packing.service.js
// and src/services/gemini.service.js
import api from './client'
import type { APIResponse, PackingItem } from '../types/api.types'

const packingApi = {
  generate: (tripId: string) =>
    api.post<APIResponse<{ items: PackingItem[]; source: 'GEMINI_AI' | 'OFFLINE_FALLBACK' }>>(
      '/packing/generate',
      { tripId }
    ),
}

export default packingApi
