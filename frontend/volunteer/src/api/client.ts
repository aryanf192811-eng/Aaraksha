// src/api/client.ts
import axios from 'axios'
import type { AxiosError, AxiosResponse } from 'axios'
import { useAuthStore } from '../store/auth.store'
import type { APIError } from '../types/api.types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<APIError>) => {
    if (error.response?.status === 401) {
      // PrivateRoute (main.tsx) already reacts to isAuthenticated and
      // redirects declaratively — no navigation needed here. A hard
      // `window.location.href` reload used to race the auth store's async
      // persist write, which could bounce home<->auth forever on a stale
      // token (see tourist app's client.ts for the full failure mode).
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

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
