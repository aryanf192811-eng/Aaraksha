// src/controllers/message.controller.js
'use strict'

const messageService = require('../services/message.service')
const { sendSuccess } = require('../utils/response')

// req.query.limit arrives as a raw string (or undefined) -- clamp it to a
// sane integer range here rather than letting an unvalidated value reach
// the repository's SQL LIMIT parameter.
function parseLimit(raw) {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return 50
  return Math.min(n, 100)
}

// GET /api/tourists/me/guardian-messages
const getGuardianThreadAsTourist = async (req, res, next) => {
  try {
    const messages = await messageService.getGuardianThreadForTourist(req.tourist.id, parseLimit(req.query.limit))
    sendSuccess(res, messages)
  } catch (err) { next(err) }
}

// POST /api/tourists/me/guardian-messages
const sendGuardianMessageAsTourist = async (req, res, next) => {
  try {
    const message = await messageService.sendGuardianMessageAsTourist(req.tourist.id, req.validatedBody.body)
    sendSuccess(res, message, 'Message sent', 201)
  } catch (err) { next(err) }
}

// GET /api/tourists/guardian/:token/messages
const getGuardianThreadAsGuardian = async (req, res, next) => {
  try {
    const messages = await messageService.getGuardianThreadForGuardian(req.params.token, req.query.pin, parseLimit(req.query.limit))
    sendSuccess(res, messages)
  } catch (err) { next(err) }
}

// POST /api/tourists/guardian/:token/messages
const sendGuardianMessageAsGuardian = async (req, res, next) => {
  try {
    const message = await messageService.sendGuardianMessageAsGuardian(req.params.token, req.query.pin, req.validatedBody.body)
    sendSuccess(res, message, 'Message sent', 201)
  } catch (err) { next(err) }
}

// GET /api/sos/:id/messages
const getRescueThreadAsTourist = async (req, res, next) => {
  try {
    const messages = await messageService.getRescueThreadAsTourist(req.tourist.id, req.params.id, parseLimit(req.query.limit))
    sendSuccess(res, messages)
  } catch (err) { next(err) }
}

// POST /api/sos/:id/messages
const sendRescueMessageAsTourist = async (req, res, next) => {
  try {
    const message = await messageService.sendRescueMessageAsTourist(req.tourist.id, req.params.id, req.validatedBody.body)
    sendSuccess(res, message, 'Message sent', 201)
  } catch (err) { next(err) }
}

// GET /api/volunteers/me/assignment/messages
const getRescueThreadAsVolunteer = async (req, res, next) => {
  try {
    const messages = await messageService.getRescueThreadAsVolunteer(req.volunteer.id, parseLimit(req.query.limit))
    sendSuccess(res, messages)
  } catch (err) { next(err) }
}

// POST /api/volunteers/me/assignment/messages
const sendRescueMessageAsVolunteer = async (req, res, next) => {
  try {
    const message = await messageService.sendRescueMessageAsVolunteer(req.volunteer.id, req.validatedBody.body)
    sendSuccess(res, message, 'Message sent', 201)
  } catch (err) { next(err) }
}

module.exports = {
  getGuardianThreadAsTourist, sendGuardianMessageAsTourist,
  getGuardianThreadAsGuardian, sendGuardianMessageAsGuardian,
  getRescueThreadAsTourist, sendRescueMessageAsTourist,
  getRescueThreadAsVolunteer, sendRescueMessageAsVolunteer,
}
