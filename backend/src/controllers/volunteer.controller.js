// src/controllers/volunteer.controller.js
'use strict'

const volunteerService = require('../services/volunteer.service')
const handoffService = require('../services/handoff.service')
const { sendSuccess } = require('../utils/response')

// POST /api/volunteers/register
const register = async (req, res, next) => {
  try {
    const result = await volunteerService.registerVolunteer(req.validatedBody)
    sendSuccess(res, result, 'Registration successful — pending verification', 201)
  } catch (err) { next(err) }
}

// POST /api/volunteers/login
const login = async (req, res, next) => {
  try {
    const result = await volunteerService.loginVolunteer(req.validatedBody)
    sendSuccess(res, result, 'Login successful')
  } catch (err) { next(err) }
}

// GET /api/volunteers/me
const getProfile = async (req, res, next) => {
  try {
    sendSuccess(res, req.volunteer)
  } catch (err) { next(err) }
}

// PATCH /api/volunteers/me/status
const updateStatus = async (req, res, next) => {
  try {
    const { status, latitude, longitude } = req.validatedBody
    const updated = await volunteerService.updateStatus(req.volunteer.id, status, latitude, longitude)
    sendSuccess(res, updated, `Status updated to ${status}`)
  } catch (err) { next(err) }
}

// GET /api/volunteers/me/dispatches
const getMyDispatches = async (req, res, next) => {
  try {
    const dispatches = await volunteerService.getMyDispatches(req.volunteer.id)
    sendSuccess(res, dispatches)
  } catch (err) { next(err) }
}

// PATCH /api/volunteers/dispatches/:id/status
const updateDispatchStatus = async (req, res, next) => {
  try {
    const updated = await volunteerService.updateDispatchStatus(req.params.id, req.volunteer.id, req.validatedBody.status)
    sendSuccess(res, updated, 'Dispatch updated')
  } catch (err) { next(err) }
}

// GET /api/volunteers/me/active-assignment
const getActiveAssignment = async (req, res, next) => {
  try {
    const assignment = await volunteerService.getActiveAssignment(req.volunteer.id)
    sendSuccess(res, assignment)
  } catch (err) { next(err) }
}

// PATCH /api/volunteers/me/location
const updateLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.validatedBody
    const result = await volunteerService.updateRescuerLocation(req.volunteer.id, latitude, longitude)
    sendSuccess(res, result)
  } catch (err) { next(err) }
}

// PATCH /api/volunteers/me/assignment/status
const updateAssignmentStatus = async (req, res, next) => {
  try {
    const updated = await volunteerService.updateAssignmentStatus(req.volunteer.id, req.validatedBody.status)
    sendSuccess(res, updated, `Status updated to ${req.validatedBody.status}`)
  } catch (err) { next(err) }
}

// POST /api/volunteers/me/assignment/verify-handoff
const verifyHandoff = async (req, res, next) => {
  try {
    const updated = await handoffService.verifyHandoffAsVolunteer(req.volunteer.id, req.validatedBody.code)
    sendSuccess(res, updated, 'Handoff verified')
  } catch (err) { next(err) }
}

// POST /api/volunteers/me/assignment/exit — decline (still ASSIGNED) or
// cancel (already EN_ROUTE/ARRIVED); the service derives which one applies.
const exitAssignment = async (req, res, next) => {
  try {
    const updated = await volunteerService.exitAssignment(req.volunteer.id, req.validatedBody.reason)
    sendSuccess(res, updated, `Assignment ${updated.status.toLowerCase()}`)
  } catch (err) { next(err) }
}

module.exports = {
  register, login, getProfile, updateStatus, getMyDispatches, updateDispatchStatus,
  getActiveAssignment, updateLocation, updateAssignmentStatus, verifyHandoff, exitAssignment,
}
