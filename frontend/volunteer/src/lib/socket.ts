// src/lib/socket.ts
// Handshake auth shape verified against backend src/socket/index.js —
// { token } for tourist/govt/volunteer, { guardianToken } for guardian.
import { io, Socket } from 'socket.io-client'

let _socket: Socket | null = null
let _identity: string | null = null

export function getSocket(): Socket | null {
  return _socket
}

export function connectSocket(token: string): Socket {
  if (_socket?.connected && _identity === token) return _socket

  // A cached socket can outlive the session it was built for -- this app's
  // logout doesn't reload the page, so without this check a same-tab
  // logout+login would keep broadcasting into the PREVIOUS volunteer's room
  // (the guard above would just hand back the still-connected old socket).
  if (_socket) _socket.disconnect()

  _identity = token
  _socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    // Rural/mountain connectivity gaps are the expected case for this app,
    // not the exception -- the old 10-attempt cap gave up permanently
    // after well under a minute of continuous failure, with no recovery
    // short of a page reload.
    reconnectionAttempts: Infinity,
  })

  _socket.on('connect', () => console.debug('[Socket] Connected:', _socket?.id))
  _socket.on('disconnect', (reason) => console.debug('[Socket] Disconnected:', reason))
  _socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message)
    // The backend rejects (rather than silently anonymizing) a missing or
    // expired token. With unlimited reconnection attempts, retrying with
    // that same stale credential would otherwise loop forever hammering
    // the server -- stop until a fresh connectSocket() call (e.g. after
    // re-login) supplies a new token.
    if (err.message === 'AUTH_INVALID' || err.message === 'AUTH_REQUIRED') _socket?.disconnect()
  })

  return _socket
}

export function disconnectSocket() {
  if (_socket) { _socket.disconnect(); _socket = null }
  _identity = null
}
