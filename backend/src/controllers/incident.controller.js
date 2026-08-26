// src/controllers/incident.controller.js — tourist-facing E-FIR filing
'use strict'
const incidentService = require('../services/incident.service')
const { sendSuccess } = require('../utils/response')

const fileIncident = async (req, res, next) => {
  try {
    const incident = await incidentService.fileIncident(req.tourist.id, req.validatedBody)
    sendSuccess(res, incident, 'Incident report filed', 201)
  } catch (err) { next(err) }
}

const getMyIncidents = async (req, res, next) => {
  try { sendSuccess(res, await incidentService.getMyIncidents(req.tourist.id)) }
  catch (err) { next(err) }
}

const getIncident = async (req, res, next) => {
  try { sendSuccess(res, await incidentService.getIncident(req.params.id, req.tourist.id)) }
  catch (err) { next(err) }
}

module.exports = { fileIncident, getMyIncidents, getIncident }
