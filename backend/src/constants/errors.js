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

  // Generic
  NOT_FOUND:           'Resource not found',
  VALIDATION_FAILED:   'Validation failed',
  INTERNAL_ERROR:      'Internal server error',
  DB_CONFLICT:         'A record with this value already exists',
  DB_FOREIGN_KEY:      'Referenced record does not exist',
})

module.exports = { ERRORS }
