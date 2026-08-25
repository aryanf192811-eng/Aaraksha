// src/controllers/trip.controller.js
'use strict'

const tripService = require('../services/trip.service')
const newsService = require('../services/news.service')
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

const getInviteCode = async (req, res, next) => {
  try {
    const inviteCode = await tripService.getOrCreateInviteCode(req.params.id, req.tourist.id)
    sendSuccess(res, { inviteCode })
  } catch (err) { next(err) }
}

const joinTrip = async (req, res, next) => {
  try {
    const trip = await tripService.joinTripByCode(req.tourist.id, req.validatedBody.inviteCode)
    sendSuccess(res, trip, 'Joined trip', 201)
  } catch (err) { next(err) }
}

const getTripMembers = async (req, res, next) => {
  try {
    const result = await tripService.getTripMembers(req.params.id, req.tourist.id)
    sendSuccess(res, result)
  } catch (err) { next(err) }
}

const leaveTrip = async (req, res, next) => {
  try {
    await tripService.leaveTrip(req.params.id, req.tourist.id)
    res.status(204).end()
  } catch (err) { next(err) }
}

const getTripNews = async (req, res, next) => {
  try {
    const news = await newsService.getNewsForTrip(req.params.id, req.tourist.id)
    sendSuccess(res, news)
  } catch (err) { next(err) }
}

const getSafetyAdvisory = async (req, res, next) => {
  try {
    const advisory = await tripService.getSafetyAdvisory(req.params.id, req.tourist.id)
    sendSuccess(res, advisory)
  } catch (err) { next(err) }
}

module.exports = {
  createTrip, getMyTrips, getTripById, updateTrip, updateTripStatus, updateChecklist, deleteTrip, getPublicTrip,
  getInviteCode, joinTrip, getTripMembers, leaveTrip, getTripNews, getSafetyAdvisory,
}
