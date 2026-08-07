// src/api/client.ts
// Guardian portal has no login — every call is either public (guardian view
// by token) or unauthenticated by design, so there's no JWT to attach and no
// auth store to depend on (unlike the tourist/govt portals).
import axios from 'axios'
import type { APIError } from '../types/api.types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiErr = error.response?.data as APIError
    if (apiErr?.errors?.length) {
      return apiErr.errors.map(e => `${e.field}: ${e.message}`).join('\n')
    }
    return apiErr?.message || error.message || 'An error occurred'
  }
  return 'An unexpected error occurred'
}

export default api
