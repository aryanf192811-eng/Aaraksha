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

    // Tourist or Govt — require JWT
    if (token) {
      try {
        const payload = jwt.verify(token, config.jwt.secret)
        socket.data.role = payload.role
        if (payload.role === 'tourist')   socket.data.touristId   = payload.id
        if (payload.role === 'govt')      socket.data.govtUserId  = payload.id
        if (payload.role === 'volunteer') socket.data.volunteerId = payload.id
        return next()
      } catch (err) {
        logger.debug({ err: err.message }, 'Socket auth failed — connecting without auth')
        socket.data.role = 'anonymous'
        return next()
      }
    }

    socket.data.role = 'anonymous'
    next()
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
