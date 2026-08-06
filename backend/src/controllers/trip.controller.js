// src/controllers/trip.controller.js
'use strict'

const tripService = require('../services/trip.service')
const { sendSuccess, sendPaginated } = require('../utils/response')
const { parsePaginationParams } = require('../utils/pagination')

const createTrip = async (req, res, next) => {
  try {
    const trip = await tripService.createTrip(req.tourist.id, req.validatedBody, req.tourist)
    sendSuccess(res, trip, 'Trip created', 201)
  } catch (err) { next(err) }
}

const getMyTrips = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query)
    const { rows, total } = await tripService.getMyTrips(req.tourist.id, { ...req.query, limit, offset })
    sendPaginated(res, rows, total, page, limit)
  } catch (err) { next(err) }
}

const getTripById = async (req, res, next) => {
  try {
    const trip = await tripService.getTrip(req.params.id, req.tourist.id)
    sendSuccess(res, trip)
  } catch (err) { next(err) }
}

const updateTrip = async (req, res, next) => {
  try {
    const trip = await tripService.updateTrip(req.params.id, req.tourist.id, req.validatedBody, req.tourist)
    sendSuccess(res, trip, 'Trip updated')
  } catch (err) { next(err) }
}

const updateTripStatus = async (req, res, next) => {
  try {
    const trip = await tripService.updateTripStatus(req.params.id, req.tourist.id, req.validatedBody.status)
    sendSuccess(res, trip, `Trip status updated to ${req.validatedBody.status}`)
  } catch (err) { next(err) }
}

const updateChecklist = async (req, res, next) => {
  try {
    const trip = await tripService.updateChecklist(req.params.id, req.tourist.id, req.validatedBody.packingChecklist)
    sendSuccess(res, trip, 'Checklist updated')
  } catch (err) { next(err) }
}

const deleteTrip = async (req, res, next) => {
  try {
    await tripService.deleteTrip(req.params.id, req.tourist.id)
    res.status(204).end()
  } catch (err) { next(err) }
}

const getPublicTrip = async (req, res, next) => {
  try {
    const trip = await tripService.getPublicTrip(req.params.token)
    sendSuccess(res, trip)
  } catch (err) { next(err) }
}

module.exports = { createTrip, getMyTrips, getTripById, updateTrip, updateTripStatus, updateChecklist, deleteTrip, getPublicTrip }
