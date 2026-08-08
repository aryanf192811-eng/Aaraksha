// src/api/checkpoint.api.ts
import api from './client'
import type { APIResponse } from '../types/api.types'

export interface CheckpointQR {
  token: string
  qrDataUri: string
  expiresInSeconds: number
}

const checkpointApi = {
  getCheckpointQR: () =>
    api.get<APIResponse<CheckpointQR>>('/tourists/checkpoint-qr'),
}

export default checkpointApi
