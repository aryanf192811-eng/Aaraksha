// src/lib/socket.ts
// Handshake auth shape verified against backend src/socket/index.js —
// { token } for tourist/govt, { guardianToken } for the guardian portal.
import { io, Socket } from 'socket.io-client'

let _socket: Socket | null = null

export function getSocket(): Socket | null {
  return _socket
}

export function connectSocket(role: 'tourist' | 'govt' | 'guardian', tokenOrGuardianToken: string): Socket {
  if (_socket?.connected) return _socket

  const auth =
    role === 'guardian'
      ? { guardianToken: tokenOrGuardianToken }
      : { token: tokenOrGuardianToken }

  _socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth,
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  })

  _socket.on('connect', () => console.debug('[Socket] Connected:', _socket?.id))
  _socket.on('disconnect', (reason) => console.debug('[Socket] Disconnected:', reason))
  _socket.on('connect_error', (err) => console.error('[Socket] Connection error:', err.message))

  return _socket
}

export function disconnectSocket() {
  if (_socket) { _socket.disconnect(); _socket = null }
}
