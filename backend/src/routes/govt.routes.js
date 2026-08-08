// src/routes/govt.routes.js
'use strict'

const router = require('express').Router()
const ctrl   = require('../controllers/govt.controller')
const { authenticateGovt, requireGovtRole } = require('../middleware/auth')
const { GOVT_ROLES } = require('../constants/enums')
const { PostNewsSchema } = require('../validators/news.validator')
const { validate } = require('../middleware/validate')
const { z } = require('zod')
const { TEAM_STATUSES } = require('../constants/enums')

const AssignRescueSchema = z.object({
  teamId: z.string().uuid(),
  notes:  z.string().max(1000).optional().nullable(),
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
})

router.use(authenticateGovt)

router.get('/dashboard',           ctrl.getDashboard)
router.get('/tourists/live',       ctrl.getLiveTourists)
router.get('/risk-overview',       ctrl.getRiskOverview)
router.get('/analytics',           ctrl.getAnalytics)
router.get('/analytics/export',    ctrl.exportAnalyticsReport)
router.get('/sos/active',          ctrl.getActiveSOS)
router.patch('/sos/:id/assign',    validate(AssignRescueSchema),     ctrl.assignRescue)
router.patch('/sos/:id/resolve',   validate(ResolveSOSSchema),       ctrl.resolveSOS)
router.get('/rescue-teams',        ctrl.getRescueTeams)
router.patch('/rescue-teams/:id/status', validate(UpdateTeamStatusSchema), ctrl.updateTeamStatus)
// Checkpoint scanning is a ground-level action — SUPER_ADMIN as a
// superuser override, POLICE and TOURISM_OFFICER as the roles that
// actually staff an ILP/entry checkpoint. DISTRICT_ADMIN/MEDICAL are
// desk/oversight roles and don't perform scans, but can still view the log.
router.post('/checkpoint/scan',
  requireGovtRole(GOVT_ROLES.SUPER_ADMIN, GOVT_ROLES.POLICE, GOVT_ROLES.TOURISM_OFFICER),
  validate(ScanCheckpointSchema), ctrl.scanCheckpoint)
router.get('/checkpoint/recent',   ctrl.getRecentCheckpointScans)
router.post('/destinations/:id/news', validate(PostNewsSchema), ctrl.postDestinationNews)

module.exports = router
