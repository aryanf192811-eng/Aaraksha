// src/socket/index.js
'use strict'

const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const config = require('../config/env')
const { SOCKET_ROOMS } = require('../constants/events')
const logger = require('../utils/logger')

let _io = null

function getIO() {
  if (!_io) throw new Error('Socket.IO not initialized — call initSocket(server) first')
  return _io
}

function initSocket(server) {
  _io = new Server(server, {
    cors: {
      origin: [config.cors.touristUrl, config.cors.govtUrl, config.cors.guardianUrl,
               ...(config.cors.volunteerUrl ? [config.cors.volunteerUrl] : []),
               'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout:  60000,
    pingInterval: 25000,
  })

  // Auth middleware — runs before every connection
  _io.use((socket, next) => {
    const { token, guardianToken } = socket.handshake.auth

    // Guardian connection — no JWT, just a guardian token
    if (guardianToken) {
      socket.data.role          = 'guardian'
      socket.data.guardianToken = guardianToken
      return next()
    }

    // Tourist, Govt, or Volunteer — require JWT. Every frontend always sends
    // one of `token`/`guardianToken` (no caller ever connects intentionally
    // credential-less), so a missing or invalid token is always a real auth
    // failure, not a legitimate anonymous/public connection. Previously this
    // fell through to `role: 'anonymous'` and still called `next()` — the
    // socket connected "successfully" but joined zero rooms, so a tab with
    // an expired token silently stopped receiving every real-time SOS/
    // rescue/DMS update for the rest of its life with no visible signal.
    // Rejecting here instead surfaces a `connect_error` the client can
    // detect and act on (e.g. prompt re-login).
    if (token) {
      try {
        const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] })
        socket.data.role = payload.role
        if (payload.role === 'tourist')   socket.data.touristId   = payload.id
        if (payload.role === 'govt')      socket.data.govtUserId  = payload.id
        if (payload.role === 'volunteer') socket.data.volunteerId = payload.id
        return next()
      } catch (err) {
        logger.debug({ err: err.message }, 'Socket auth failed — rejecting connection')
        return next(new Error('AUTH_INVALID'))
      }
    }

    logger.debug('Socket connection attempted with no credentials — rejecting')
    next(new Error('AUTH_REQUIRED'))
  })

  _io.on('connection', (socket) => {
    const { role, touristId, govtUserId, guardianToken, volunteerId } = socket.data

    logger.debug({ socketId: socket.id, role }, 'Socket connected')

    switch (role) {
      case 'govt':
        socket.join(SOCKET_ROOMS.GOVT_DASHBOARD)
        // Allow govt to join district-specific rooms
        socket.on('GOVT_JOIN_DISTRICT', (district) => {
          if (district && typeof district === 'string') {
            socket.join(SOCKET_ROOMS.govtDistrict(district))
            logger.debug({ govtUserId, district }, 'Govt joined district room')
          }
        })
        break
      case 'tourist':
        if (touristId) socket.join(SOCKET_ROOMS.tourist(touristId))
        break
      case 'guardian':
        if (guardianToken) socket.join(SOCKET_ROOMS.guardian(guardianToken))
        break
      case 'volunteer':
        if (volunteerId) socket.join(SOCKET_ROOMS.volunteer(volunteerId))
        break
    }

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, role, reason }, 'Socket disconnected')
    })

    socket.on('error', (err) => {
      logger.error({ err: err.message, socketId: socket.id }, 'Socket error')
    })
  })

  logger.info('Socket.IO initialized')
  return _io
}

module.exports = { initSocket, getIO }
