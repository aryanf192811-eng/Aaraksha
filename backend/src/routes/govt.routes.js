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
  // Force-close without a verified handoff code -- the audited escape
  // hatch for a genuine edge case (tourist unconscious, phone destroyed).
  // A reason is required specifically when this is present, not
  // unconditionally, so the normal (verified) resolve path stays a plain
  // one-field form.
  overrideReason: z.string().min(10).max(1000).optional(),
})
// Deliberately requires a real reason, same posture as ResolveSOSSchema's
// overrideReason -- this is an audited, hard-to-reach action, not a casual
// tap-away option.
const ConfirmFraudulentSchema = z.object({
  reason: z.string().min(10, 'Explain the finding (at least 10 characters)').max(1000),
})
const DecideAppealSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  resolutionNotes: z.string().max(1000).optional(),
})
const ResolveClusterSchema = z.object({
  decision: z.enum(['CONFIRMED_INCIDENT', 'CONFIRMED_ABUSE', 'DISMISS']),
  resolutionNotes: z.string().max(1000).optional(),
})
const VerifyHandoffSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
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

// E-FIRs are legal case records (evidence photos, investigation notes) --
// narrower than the general command-center set. Matches exactly the role
// list incident.repository.js#findAssignableOfficers already uses for who
// can be handed a case: POLICE as the natural investigating role, plus
// DISTRICT_ADMIN/SUPER_ADMIN for oversight and reassignment. Before this,
// every incident route below used COMMAND_CENTER_ROLES, so a
// TOURISM_OFFICER or MEDICAL account -- neither ever assignable as an
// investigating officer -- could still read case details/evidence photos
// and move a case through its status ladder. Found in a security-access
// review; those two roles keep every other command-center route (SOS,
// analytics, risk overview) they legitimately need, just not this one.
const INVESTIGATING_ROLES = [GOVT_ROLES.SUPER_ADMIN, GOVT_ROLES.DISTRICT_ADMIN, GOVT_ROLES.POLICE]

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
router.post('/sos/:id/verify-handoff', requireGovtRole(...COMMAND_CENTER_ROLES), validate(VerifyHandoffSchema), ctrl.verifyHandoffRelay)
router.get('/sos/:id/report',      requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.downloadIncidentReport)
router.get('/anomalies',           requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getAnomalies)
router.patch('/anomalies/:id/resolve', requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.resolveAnomaly)
router.get('/incidents',           requireGovtRole(...INVESTIGATING_ROLES), ctrl.getIncidentQueue)
router.get('/incidents/officers',  requireGovtRole(...INVESTIGATING_ROLES), ctrl.getAssignableOfficers)
router.get('/incidents/:id',       requireGovtRole(...INVESTIGATING_ROLES), ctrl.getIncident)
router.get('/incidents/:id/report', requireGovtRole(...INVESTIGATING_ROLES), ctrl.downloadEfirReport)
router.patch('/incidents/:id/assign', requireGovtRole(...INVESTIGATING_ROLES), validate(AssignIncidentSchema), ctrl.assignIncident)
router.patch('/incidents/:id/status', requireGovtRole(...INVESTIGATING_ROLES), validate(UpdateIncidentStatusSchema), ctrl.updateIncidentStatus)
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
// Missing this same role gate every sibling route above has meant any
// authenticated govt account -- including a CHECKPOINT_OFFICER, whose
// entire intended access is the scan endpoints above -- could read tourist
// name+phone across every checkpoint scan nationwide. Found in Phase 9's
// security audit; the surrounding comment already documented the intended
// scope (command-center roles only), the route just never enforced it.
router.get('/checkpoint/recent',   requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getRecentCheckpointScans)
router.post('/destinations/:id/news', requireGovtRole(...COMMAND_CENTER_ROLES), validate(PostNewsSchema), ctrl.postDestinationNews)
router.get('/volunteers',              requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getAllVolunteers)
router.post('/volunteers',             requireGovtRole(...COMMAND_CENTER_ROLES), validate(CreateVolunteerByGovtSchema), ctrl.createVolunteer)
router.get('/volunteers/pending',      requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getPendingVolunteers)
router.patch('/volunteers/:id/verify', requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.verifyVolunteer)
router.patch('/volunteers/:id/reject', requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.rejectVolunteer)

// Trust score / appeals -- scoped tighter than COMMAND_CENTER_ROLES.
// Deciding someone's account restriction (or overturning it) is a
// district-level judgment call, not something every operator role should
// be able to unilaterally do.
const TRUST_REVIEW_ROLES = [GOVT_ROLES.SUPER_ADMIN, GOVT_ROLES.DISTRICT_ADMIN]
router.post('/sos/:id/confirm-fraudulent', requireGovtRole(...TRUST_REVIEW_ROLES), validate(ConfirmFraudulentSchema), ctrl.confirmFraudulentSOS)
router.get('/trust-appeals',               requireGovtRole(...TRUST_REVIEW_ROLES), ctrl.getPendingAppeals)
router.post('/trust-appeals/:id/decide',   requireGovtRole(...TRUST_REVIEW_ROLES), validate(DecideAppealSchema), ctrl.decideAppeal)

// Any operator can SEE a flagged cluster (it's an SOS-priority signal,
// belongs on the dashboard for everyone); only TRUST_REVIEW_ROLES can
// resolve one, since a CONFIRMED_ABUSE decision applies a trust
// consequence to real accounts -- same district-level judgment gate as
// the trust-appeals review above.
router.get('/sos-clusters',              requireGovtRole(...COMMAND_CENTER_ROLES), ctrl.getOpenClusters)
router.post('/sos-clusters/:id/resolve', requireGovtRole(...TRUST_REVIEW_ROLES), validate(ResolveClusterSchema), ctrl.resolveCluster)

module.exports = router
