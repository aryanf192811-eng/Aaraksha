// src/constants/enums.js
'use strict'

const TRAVEL_TYPES = Object.freeze({
  SOLO: 'SOLO',
  FAMILY: 'FAMILY',
  FRIENDS: 'FRIENDS',
  ADVENTURE: 'ADVENTURE',
  PILGRIMAGE: 'PILGRIMAGE',
  BUSINESS: 'BUSINESS',
})

const TRIP_STATUSES = Object.freeze({
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
})

const SOS_CATEGORIES = Object.freeze({
  MEDICAL: 'MEDICAL',
  LOST: 'LOST',
  TRAPPED: 'TRAPPED',
  DISASTER: 'DISASTER',
  MISSING: 'MISSING',
  CRIME: 'CRIME',
  OTHER: 'OTHER',
})

const SOS_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  ASSIGNED: 'ASSIGNED',
  RESOLVED: 'RESOLVED',
  FALSE_ALARM: 'FALSE_ALARM',
})

const SOS_TRIGGER_TYPES = Object.freeze({
  MANUAL: 'MANUAL',
  DEAD_MANS_SWITCH: 'DEAD_MANS_SWITCH',
  SMS_INBOUND: 'SMS_INBOUND',
})

const DMS_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  TRIGGERED: 'TRIGGERED',
  RESOLVED: 'RESOLVED',
})

const CHECKIN_TYPES = Object.freeze({
  MANUAL: 'MANUAL',
  DMS_RESET: 'DMS_RESET',
  AUTO: 'AUTO',
  SMS: 'SMS',
})

const GOVT_ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  DISTRICT_ADMIN: 'DISTRICT_ADMIN',
  TOURISM_OFFICER: 'TOURISM_OFFICER',
  POLICE: 'POLICE',
  MEDICAL: 'MEDICAL',
  // A field-only role — this account's entire experience is the checkpoint
  // scanner (see ALLOWED_CHECKPOINT_ROLES in the govt frontend and the
  // requireGovtRole gates in govt.routes.js). Distinct from POLICE, which
  // can also staff a checkpoint but retains full command-center access.
  CHECKPOINT_OFFICER: 'CHECKPOINT_OFFICER',
})

const GOVT_ID_TYPES = Object.freeze({
  AADHAAR: 'AADHAAR',
  PASSPORT: 'PASSPORT',
  VOTER_ID: 'VOTER_ID',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
})

const CONNECTIVITY = Object.freeze({
  NONE: 'NONE',
  POOR: 'POOR',
  MODERATE: 'MODERATE',
  GOOD: 'GOOD',
  EXCELLENT: 'EXCELLENT',
})

const DIFFICULTY = Object.freeze({
  EASY: 'EASY',
  MODERATE: 'MODERATE',
  HARD: 'HARD',
  EXTREME: 'EXTREME',
})

const ZONE_TYPES = Object.freeze({
  SAFE: 'SAFE',
  CAUTION: 'CAUTION',
  HIGH_RISK: 'HIGH_RISK',
  RESTRICTED: 'RESTRICTED',
  ILP_REQUIRED: 'ILP_REQUIRED',
})

const WEATHER_CONDITIONS = Object.freeze({
  CLEAR: 'CLEAR',
  CLOUDY: 'CLOUDY',
  RAIN: 'RAIN',
  HEAVY_RAIN: 'HEAVY_RAIN',
  STORM: 'STORM',
  SNOW: 'SNOW',
  FOG: 'FOG',
})

const WEATHER_RISK = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  EXTREME: 'EXTREME',
})

const TEAM_TYPES = Object.freeze({
  MOUNTAIN: 'MOUNTAIN',
  MEDICAL: 'MEDICAL',
  POLICE: 'POLICE',
  SDRF: 'SDRF',
  COAST_GUARD: 'COAST_GUARD',
})

const TEAM_STATUSES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  DEPLOYED: 'DEPLOYED',
  OFF_DUTY: 'OFF_DUTY',
})

const ASSIGNMENT_STATUSES = Object.freeze({
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  RESOLVED: 'RESOLVED',
})

const SCAM_CATEGORIES = Object.freeze({
  FAKE_GUIDE: 'FAKE_GUIDE',
  OVERCHARGING: 'OVERCHARGING',
  THEFT: 'THEFT',
  HARASSMENT: 'HARASSMENT',
  UNSAFE_AREA: 'UNSAFE_AREA',
  OTHER: 'OTHER',
})

const ACTIVITY_TYPES = Object.freeze({
  TRANSPORT: 'TRANSPORT',
  STAY: 'STAY',
  ACTIVITY: 'ACTIVITY',
  MEAL: 'MEAL',
  OTHER: 'OTHER',
})

const PACKING_CATEGORIES = Object.freeze({
  CLOTHING: 'CLOTHING',
  DOCUMENTS: 'DOCUMENTS',
  MEDICINE: 'MEDICINE',
  ELECTRONICS: 'ELECTRONICS',
  SAFETY: 'SAFETY',
  FOOD: 'FOOD',
  OTHER: 'OTHER',
})

const NOTIFICATION_TIERS = Object.freeze({
  TIER_1: 1,  // Notify immediately
  TIER_2: 2,  // Notify after 60 seconds
})

// Matches rescue_teams.status exactly (AVAILABLE/DEPLOYED/OFF_DUTY) now that
// a volunteer can be manually assigned to an SOS the same way a team is —
// DEPLOYED keeps an assigned rescuer from being shown as available for a
// second SOS, or matched by the automatic proximity broadcast, while
// they're already out on one.
const VOLUNTEER_STATUSES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  DEPLOYED: 'DEPLOYED',
  OFF_DUTY: 'OFF_DUTY',
})

// A volunteers row can represent either a self-registered citizen or an
// individual member of an official govt rescue team (linked via
// volunteers.team_id) — same login, same app, same dispatch/assignment
// machinery either way. See migration 010_unify_rescuers.
const RESCUER_TYPES = Object.freeze({
  VOLUNTEER: 'VOLUNTEER',
  OFFICIAL: 'OFFICIAL',
})

// Mirrors rescue_assignments.status (ASSIGNED/EN_ROUTE/ARRIVED/RESOLVED),
// with DECLINED added — unlike an official team, a volunteer alert is a
// broadcast to many people at once, so "this one isn't coming" is a real,
// expected outcome, not an edge case.
const VOLUNTEER_DISPATCH_STATUSES = Object.freeze({
  ALERTED: 'ALERTED',
  RESPONDED: 'RESPONDED',
  COMPLETED: 'COMPLETED',
  DECLINED: 'DECLINED',
})

// Always-on rule-based safety net (see migration 011_safety_anomalies) —
// distinct from an SOS: an anomaly means "this needs a human to check in
// on," not "an emergency is confirmed." INACTIVITY = no location update in
// too long for an active trip; ROUTE_DEVIATION = last known position is
// far from every planned stop.
const ANOMALY_TYPES = Object.freeze({
  INACTIVITY: 'INACTIVITY',
  ROUTE_DEVIATION: 'ROUTE_DEVIATION',
})
const ANOMALY_STATUSES = Object.freeze({
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
})

// E-FIR-style triage workflow (see migration 012_incident_reports) — an
// after-the-fact report a tourist files (theft, harassment, fraud...), not
// a live emergency. Distinct from SCAM_CATEGORIES, which tags a
// crowd-sourced community warning (scam_reports) rather than a formal,
// officer-routed case.
const INCIDENT_CATEGORIES = Object.freeze({
  THEFT: 'THEFT',
  HARASSMENT: 'HARASSMENT',
  ASSAULT: 'ASSAULT',
  FRAUD: 'FRAUD',
  LOST_DOCUMENT: 'LOST_DOCUMENT',
  VEHICLE_ACCIDENT: 'VEHICLE_ACCIDENT',
  PROPERTY_DAMAGE: 'PROPERTY_DAMAGE',
  OTHER: 'OTHER',
})

// A real investigation ladder, not a binary open/closed — mirrors what an
// actual police case file moves through: filed, picked up by an officer,
// actively worked, then resolved or administratively closed (e.g. the
// tourist withdrew the complaint, or it was a duplicate).
const INCIDENT_STATUSES = Object.freeze({
  FILED: 'FILED',
  ASSIGNED: 'ASSIGNED',
  UNDER_INVESTIGATION: 'UNDER_INVESTIGATION',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
})

const INCIDENT_PRIORITIES = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
})

module.exports = {
  TRAVEL_TYPES, TRIP_STATUSES, SOS_CATEGORIES, SOS_STATUSES, SOS_TRIGGER_TYPES,
  DMS_STATUSES, CHECKIN_TYPES, GOVT_ROLES, GOVT_ID_TYPES, CONNECTIVITY, DIFFICULTY,
  ZONE_TYPES, WEATHER_CONDITIONS, WEATHER_RISK, TEAM_TYPES, TEAM_STATUSES,
  ASSIGNMENT_STATUSES, SCAM_CATEGORIES, ACTIVITY_TYPES, PACKING_CATEGORIES,
  NOTIFICATION_TIERS, VOLUNTEER_STATUSES, VOLUNTEER_DISPATCH_STATUSES, RESCUER_TYPES,
  ANOMALY_TYPES, ANOMALY_STATUSES, INCIDENT_CATEGORIES, INCIDENT_STATUSES, INCIDENT_PRIORITIES,
}
