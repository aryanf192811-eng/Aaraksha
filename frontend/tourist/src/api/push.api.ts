// src/api/push.api.ts
import api from './client'
import type { APIResponse } from '../types/api.types'

export interface PushSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const pushApi = {
  getVapidPublicKey: () =>
    api.get<APIResponse<{ publicKey: string | null }>>('/push/vapid-public-key'),

  subscribe: (data: PushSubscriptionPayload) =>
    api.post<APIResponse<null>>('/push/subscribe', data),

  unsubscribe: (endpoint: string) =>
    api.delete('/push/subscribe', { data: { endpoint } }),
}

export default pushApi
