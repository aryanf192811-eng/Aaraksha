// src/routes/govt.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/govt.controller')
const { authenticateGovt, requireGovtRole } = require('../middleware/auth')
const { GOVT_ROLES } = require('../constants/enums')
const { PostNewsSchema } = require('../validators/news.validator')
const { CreateVolunteerByGovtSchema } = require('../validators/volunteer.validator')
const { AssignIncidentSchema, UpdateIncidentStatusSchema } = require('../validators/incident.validator')
const { validate } = require('../middleware/validate')
const { z } = require('zod')
const { TEAM_STATUSES } = require('../constants/enums')

// Exactly one of teamId/volunteerId — matches the DB-level
// rescue_assignments_one_assignee CHECK constraint (migration 010), so a
// malformed request is rejected here rather than surfacing as a raw
// constraint-violation 500 further down.
const AssignRescueSchema = z.object({
  teamId:      z.string().uuid().optional(),
  volunteerId: z.string().uuid().optional(),
  notes:       z.string().max(1000).optional().nullable(),
}).refine(d => !!d.teamId !== !!d.volunteerId, {
  message: 'Provide exactly one of teamId or volunteerId', path: ['teamId'],
})
const ResolveSOSSchema = z.object({
  resolutionNotes: z.string().min(3).max(1000).optional(),
})
const UpdateTeamStatusSchema = z.object({
  status: z.enum(Object.values(TEAM_STATUSES)),
})
const ScanCheckpointSchema = z.object({
  token:           z.string().min(1),
  checkpointName:  z.string().min(2).max(255),
  district:        z.string().max(100).optional().nullable(),
  latitude:        z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude:       z.coerce.number().min(-180).max(180).optional().nullable(),
})

// Every role except CHECKPOINT_OFFICER — that account's entire access is
// the scanner endpoints below, nothing on the command-center side. Computed
// once rather than repeated per-route so a future new role doesn't need to
// be remembered at every call site.
const COMMAND_CENTER_ROLES = Object.values(GOVT_ROLES).filter(r => r !== GOVT_ROLES.CHECKPOINT_OFFICER)

router.use(authenticateGovt)

router.get('/dashboard',           requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getDashboard)
router.get('/tourists/live',       requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getLiveTourists)
router.get('/risk-overview',       requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getRiskOverview)
router.get('/risk-model/info',     requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getRiskModelInfo)
router.get('/analytics',           requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getAnalytics)
router.get('/analytics/export',    requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.exportAnalyticsReport)
router.get('/sos/active',          requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getActiveSOS)
router.get('/sos/:id/nearby-rescuers', requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getNearbyRescuers)
router.get('/active-rescuers',     requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getActiveRescuers)
router.patch('/sos/:id/assign',    requireGovtRole(...COMMAND_CENTER_ROLES), validate(AssignRescueSchema),     ctrl.assignRescue)
router.patch('/sos/:id/resolve',   requireGovtRole(...COMMAND_CENTER_ROLES), validate(ResolveSOSSchema),       ctrl.resolveSOS)
router.get('/sos/:id/report',      requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.downloadIncidentReport)
router.get('/anomalies',           requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getAnomalies)
router.patch('/anomalies/:id/resolve', requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.resolveAnomaly)
router.get('/incidents',           requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getIncidentQueue)
router.get('/incidents/officers',  requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getAssignableOfficers)
router.get('/incidents/:id',       requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getIncident)
router.get('/incidents/:id/report', requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.downloadEfirReport)
router.patch('/incidents/:id/assign', requireGovtRole(...COMMAND_CENTER_ROLES), validate(AssignIncidentSchema), ctrl.assignIncident)
router.patch('/incidents/:id/status', requireGovtRole(...COMMAND_CENTER_ROLES), validate(UpdateIncidentStatusSchema), ctrl.updateIncidentStatus)
router.get('/rescue-teams',        requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getRescueTeams)
router.patch('/rescue-teams/:id/status', requireGovtRole(...COMMAND_CENTER_ROLES), validate(UpdateTeamStatusSchema), ctrl.updateTeamStatus)
// Checkpoint scanning is a ground-level action — SUPER_ADMIN as a
// superuser override, POLICE and TOURISM_OFFICER as roles that can staff a
// checkpoint alongside their normal command-center access, and the
// dedicated CHECKPOINT_OFFICER role whose only access is this. DISTRICT_ADMIN
// /MEDICAL are desk/oversight roles and don't perform scans, but can still
// view the log below.
router.post('/checkpoint/scan',
  requireGovtRole(GOVT_ROLES.SUPER_ADMIN, GOVT_ROLES.POLICE, GOVT_ROLES.TOURISM_OFFICER, GOVT_ROLES.CHECKPOINT_OFFICER),
  validate(ScanCheckpointSchema), ctrl.scanCheckpoint)
router.get('/checkpoint/recent',   ctrl.getRecentCheckpointScans)
router.post('/destinations/:id/news', requireGovtRole(...COMMAND_CENTER_ROLES), validate(PostNewsSchema), ctrl.postDestinationNews)
router.get('/volunteers',              requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getAllVolunteers)
router.post('/volunteers',             requireGovtRole(...COMMAND_CENTER_ROLES), validate(CreateVolunteerByGovtSchema), ctrl.createVolunteer)
router.get('/volunteers/pending',      requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getPendingVolunteers)
router.patch('/volunteers/:id/verify', requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.verifyVolunteer)
router.patch('/volunteers/:id/reject', requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.rejectVolunteer)

module.exports = router
