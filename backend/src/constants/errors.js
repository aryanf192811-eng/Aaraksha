// src/constants/errors.js
'use strict'

const ERRORS = Object.freeze({
  // Auth
  PHONE_TAKEN:         'Phone number already registered',
  EMAIL_TAKEN:         'Email already registered',
  INVALID_CREDENTIALS: 'Invalid phone or password',
  INVALID_TOKEN:       'Invalid or expired token',
  ACCOUNT_INACTIVE:    'Account is deactivated',
  UNAUTHORIZED:        'Authentication required',
  FORBIDDEN:           'Insufficient permissions',

  // Govt ID
  GOVTID_INVALID_TYPE:   'Invalid government ID type',
  GOVTID_INVALID_FORMAT: 'Government ID number format is invalid for the selected type',
  GOVTID_CHECKSUM_FAILED: 'This Aadhaar number fails the standard UIDAI checksum — please re-check the digits',
  GOVTID_TAKEN:          'A tourist is already registered with this government ID',

  // Trip
  TRIP_NOT_FOUND:         'Trip not found or access denied',
  TRIP_ALREADY_ACTIVE:    'You already have an active trip. Complete or cancel it first.',
  INVALID_TRIP_TRANSITION:'Invalid status transition',
  TRIP_DATE_INVALID:      'End date must be after start date',

  // Group trip
  INVITE_CODE_INVALID:    'Invite code not found or trip is no longer joinable',
  CANNOT_JOIN_OWN_TRIP:   'You already own this trip',
  ALREADY_TRIP_MEMBER:    'You are already part of this trip',

  // SOS
  SOS_NOT_FOUND:    'SOS event not found or access denied',
  SOS_ALREADY_CLOSED: 'This SOS is already closed',

  // Rescue handoff verification
  HANDOFF_ALREADY_ISSUED: 'A verification code has already been issued for this SOS',
  HANDOFF_NOT_ELIGIBLE:   'A verification code can only be issued once help has been requested',
  HANDOFF_CODE_INVALID:   'Code not found, already used, or expired. Ask the tourist to generate a new one.',
  HANDOFF_TOO_FAR:        'Too far from the tourist\'s last known location to confirm handoff',
  HANDOFF_NOT_VERIFIED:   'This rescue hasn\'t been verified yet — the rescuer must confirm the handoff code with the tourist, or a supervisor must provide an override reason to force-close it',
  HANDOFF_NO_ASSIGNMENT:  'No active assignment to verify a handoff for',

  // DMS
  DMS_ALREADY_ACTIVE: 'You already have an active Dead Man\'s Switch. Pause or resolve it first.',
  DMS_NOT_FOUND:      'Active Dead Man\'s Switch not found',
  DMS_INTERVAL_RANGE: 'Interval must be between 15 and 480 minutes',

  // Rescue
  TEAM_NOT_FOUND:      'Rescue team not found',
  TEAM_NOT_AVAILABLE:  'Rescue team is not available — status must be AVAILABLE to assign',

  // Destination
  DESTINATION_NOT_FOUND: 'Destination not found',

  // Reviews
  REVIEW_ALREADY_EXISTS: 'You have already reviewed this destination',

  // Guardian
  GUARDIAN_TOKEN_INVALID: 'Tracking link not found or expired',

  // Messaging
  MESSAGE_NOT_YOUR_SOS:       'This SOS doesn\'t belong to you',
  MESSAGE_NO_ACTIVE_RESCUER:  'No active rescuer assigned to this SOS — nobody to message yet',
  MESSAGE_NOT_YOUR_ASSIGNMENT:'You\'re not the currently assigned rescuer for this SOS',
  MESSAGE_SOS_CLOSED:         'This rescue is closed — you can still read the conversation, but new messages can\'t be sent',
  MESSAGE_TEAM_NOT_SUPPORTED: 'Official rescue teams don\'t have in-app messaging yet — use the phone number shown instead',
  MESSAGE_NO_ASSIGNMENT:      'No active rescue assignment — the case may have been resolved, declined, or reassigned since you last checked',

  // Volunteer
  VOLUNTEER_PHONE_TAKEN:   'Phone number already registered as a volunteer',
  VOLUNTEER_GOVTID_TAKEN:  'A volunteer is already registered with this government ID',
  VOLUNTEER_NOT_FOUND:     'Volunteer not found',
  VOLUNTEER_NOT_VERIFIED:  'Your account is pending verification — you\'ll be notified once approved',
  VOLUNTEER_INACTIVE:      'Volunteer account is deactivated',
  DISPATCH_NOT_FOUND:      'Dispatch not found or access denied',
  DISPATCH_ALREADY_CLOSED: 'This dispatch is already resolved',
  VOLUNTEER_NOT_AVAILABLE: 'Volunteer is not available — status must be AVAILABLE to assign',
  ASSIGNMENT_NOT_FOUND:    'Assignment not found or access denied',
  ASSIGNMENT_ALREADY_VERIFIED: 'You already verified the handoff with the tourist — this case is being closed, it can\'t be declined or cancelled now',
  ANOMALY_NOT_FOUND:       'Anomaly not found or already resolved',
  INCIDENT_NOT_FOUND:      'Incident report not found or access denied',
  INCIDENT_ALREADY_CLOSED: 'This incident report is already resolved or closed',

  // Generic
  NOT_FOUND:           'Resource not found',
  VALIDATION_FAILED:   'Validation failed',
  INTERNAL_ERROR:      'Internal server error',
  DB_CONFLICT:         'A record with this value already exists',
  DB_FOREIGN_KEY:      'Referenced record does not exist',
})

module.exports = { ERRORS }
