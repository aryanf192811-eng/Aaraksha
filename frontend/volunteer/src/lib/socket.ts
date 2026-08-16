// src/lib/socket.ts
// Handshake auth shape verified against backend src/socket/index.js —
// { token } for tourist/govt/volunteer, { guardianToken } for guardian.
import { io, Socket } from 'socket.io-client'

let _socket: Socket | null = null

export function getSocket(): Socket | null {
  return _socket
}

export function connectSocket(token: string): Socket {
  if (_socket?.connected) return _socket

  _socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token },
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
