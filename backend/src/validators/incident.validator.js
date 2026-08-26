// src/validators/incident.validator.js
'use strict'
const { z } = require('zod')
const { INCIDENT_CATEGORIES, INCIDENT_STATUSES, INCIDENT_PRIORITIES } = require('../constants/enums')

const FileIncidentSchema = z.object({
  tripId:             z.string().uuid().optional().nullable(),
  category:           z.enum(Object.values(INCIDENT_CATEGORIES)),
  description:        z.string().min(10).max(2000),
  locationText:       z.string().max(255).optional().nullable(),
  latitude:           z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude:          z.coerce.number().min(-180).max(180).optional().nullable(),
  // Reported after the fact more often than not — allow any timestamp up
  // to now, not just "right now" like an SOS trigger.
  incidentOccurredAt: z.string().datetime().optional().nullable(),
})

const AssignIncidentSchema = z.object({
  officerId: z.string().uuid().optional(),
})

const UpdateIncidentStatusSchema = z.object({
  status:          z.enum(Object.values(INCIDENT_STATUSES)),
  resolutionNotes: z.string().max(2000).optional().nullable(),
  priority:        z.enum(Object.values(INCIDENT_PRIORITIES)).optional(),
})

module.exports = { FileIncidentSchema, AssignIncidentSchema, UpdateIncidentStatusSchema }
