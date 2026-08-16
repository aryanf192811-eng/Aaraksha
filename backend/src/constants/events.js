// src/constants/events.js
// All Socket.IO event names. Import this constant — never type event strings raw.
'use strict'

const SOCKET_EVENTS = Object.freeze({
  // Server → Govt Dashboard room
  SOS_RECEIVED:        'SOS_RECEIVED',
  SOS_STATUS_UPDATED:  'SOS_STATUS_UPDATED',
  SOS_RESOLVED:        'SOS_RESOLVED',
  RESCUE_ASSIGNED:     'RESCUE_ASSIGNED',
  DMS_TRIGGERED:       'DMS_TRIGGERED',
  TSI_BULK_UPDATE:     'TSI_BULK_UPDATE',
  LIVE_MAP_UPDATE:     'LIVE_MAP_UPDATE',
  // A volunteer moved a dispatch forward (RESPONDED/COMPLETED/DECLINED) —
  // lets operators see volunteer activity alongside official rescue teams.
  VOLUNTEER_ASSIGNMENT_UPDATED: 'VOLUNTEER_ASSIGNMENT_UPDATED',

  // Server → Tourist room (tourist:{touristId})
  TSI_UPDATED:         'TSI_UPDATED',
  DMS_WARNING:         'DMS_WARNING',
  DMS_TRIGGERED_OWN:  'DMS_TRIGGERED_OWN',
  CHECKIN_CONFIRMED:   'CHECKIN_CONFIRMED',
  WEATHER_RISK_INCREASED: 'WEATHER_RISK_INCREASED',
  GROUP_SOS_ALERT:     'GROUP_SOS_ALERT',
  DESTINATION_NEWS_CRITICAL: 'DESTINATION_NEWS_CRITICAL',

  // Server → Guardian room (guardian:{guardianToken})
  GUARDIAN_STATUS_CHANGE:    'GUARDIAN_STATUS_CHANGE',
  GUARDIAN_LOCATION_UPDATE:  'GUARDIAN_LOCATION_UPDATE',
  GUARDIAN_SOS_ALERT:        'GUARDIAN_SOS_ALERT',
  GUARDIAN_ETA_UPDATE:       'GUARDIAN_ETA_UPDATE',

  // Server → Volunteer room (volunteer:{volunteerId})
  VOLUNTEER_SOS_ALERT:        'VOLUNTEER_SOS_ALERT',

  // Client → Server (from govt dashboard)
  GOVT_JOIN_DISTRICT: 'GOVT_JOIN_DISTRICT',
})

const SOCKET_ROOMS = Object.freeze({
  GOVT_DASHBOARD: 'govt:dashboard',
  govtDistrict: (district) => `govt:district:${district}`,
  tourist:       (touristId) => `tourist:${touristId}`,
  guardian:      (guardianToken) => `guardian:${guardianToken}`,
  volunteer:     (volunteerId) => `volunteer:${volunteerId}`,
})

module.exports = { SOCKET_EVENTS, SOCKET_ROOMS }
