// src/constants/enums.ts
// CRITICAL: These values MUST match backend src/constants/enums.js and
// src/constants/events.js exactly. Any mismatch causes API validation
// failures (Zod 400 errors) or silently-missed Socket.IO events.
// Verified field-for-field against the live backend source, not assumed.

export const TRAVEL_TYPES = {
  SOLO:       'SOLO',
  FAMILY:     'FAMILY',
  FRIENDS:    'FRIENDS',
  ADVENTURE:  'ADVENTURE',
  PILGRIMAGE: 'PILGRIMAGE',
  BUSINESS:   'BUSINESS',
} as const
export type TravelType = typeof TRAVEL_TYPES[keyof typeof TRAVEL_TYPES]

export const TRIP_STATUSES = {
  PLANNED:   'PLANNED',
  ACTIVE:    'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const
export type TripStatus = typeof TRIP_STATUSES[keyof typeof TRIP_STATUSES]

export const SOS_CATEGORIES = {
  MEDICAL:  'MEDICAL',
  LOST:     'LOST',
  TRAPPED:  'TRAPPED',
  DISASTER: 'DISASTER',
  MISSING:  'MISSING',
  CRIME:    'CRIME',
  OTHER:    'OTHER',
} as const
export type SOSCategory = typeof SOS_CATEGORIES[keyof typeof SOS_CATEGORIES]

export const SOS_STATUSES = {
  ACTIVE:      'ACTIVE',
  ASSIGNED:    'ASSIGNED',
  RESOLVED:    'RESOLVED',
  FALSE_ALARM: 'FALSE_ALARM',
} as const
export type SOSStatus = typeof SOS_STATUSES[keyof typeof SOS_STATUSES]

export const SOS_TRIGGER_TYPES = {
  MANUAL:           'MANUAL',
  DEAD_MANS_SWITCH: 'DEAD_MANS_SWITCH',
  SMS_INBOUND:      'SMS_INBOUND',
} as const
export type SOSTriggerType = typeof SOS_TRIGGER_TYPES[keyof typeof SOS_TRIGGER_TYPES]

export const DMS_STATUSES = {
  ACTIVE:    'ACTIVE',
  PAUSED:    'PAUSED',
  TRIGGERED: 'TRIGGERED',
  RESOLVED:  'RESOLVED',
} as const
export type DMSStatus = typeof DMS_STATUSES[keyof typeof DMS_STATUSES]

export const CHECKIN_TYPES = {
  MANUAL:    'MANUAL',
  DMS_RESET: 'DMS_RESET',
  AUTO:      'AUTO',
} as const
export type CheckinType = typeof CHECKIN_TYPES[keyof typeof CHECKIN_TYPES]

export const GOVT_ROLES = {
  SUPER_ADMIN:         'SUPER_ADMIN',
  DISTRICT_ADMIN:      'DISTRICT_ADMIN',
  TOURISM_OFFICER:     'TOURISM_OFFICER',
  POLICE:              'POLICE',
  MEDICAL:             'MEDICAL',
  CHECKPOINT_OFFICER:  'CHECKPOINT_OFFICER',
} as const
export type GovtRole = typeof GOVT_ROLES[keyof typeof GOVT_ROLES]

export const GOVT_ID_TYPES = {
  AADHAAR:         'AADHAAR',
  PASSPORT:        'PASSPORT',
  VOTER_ID:        'VOTER_ID',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
} as const
export type GovtIdType = typeof GOVT_ID_TYPES[keyof typeof GOVT_ID_TYPES]

export const CONNECTIVITY = {
  NONE:      'NONE',
  POOR:      'POOR',
  MODERATE:  'MODERATE',
  GOOD:      'GOOD',
  EXCELLENT: 'EXCELLENT',
} as const
export type Connectivity = typeof CONNECTIVITY[keyof typeof CONNECTIVITY]

export const DIFFICULTY = {
  EASY:     'EASY',
  MODERATE: 'MODERATE',
  HARD:     'HARD',
  EXTREME:  'EXTREME',
} as const
export type Difficulty = typeof DIFFICULTY[keyof typeof DIFFICULTY]

export const ZONE_TYPES = {
  SAFE:         'SAFE',
  CAUTION:      'CAUTION',
  HIGH_RISK:    'HIGH_RISK',
  RESTRICTED:   'RESTRICTED',
  ILP_REQUIRED: 'ILP_REQUIRED',
} as const
export type ZoneType = typeof ZONE_TYPES[keyof typeof ZONE_TYPES]

export const WEATHER_CONDITIONS = {
  CLEAR:      'CLEAR',
  CLOUDY:     'CLOUDY',
  RAIN:       'RAIN',
  HEAVY_RAIN: 'HEAVY_RAIN',
  STORM:      'STORM',
  SNOW:       'SNOW',
  FOG:        'FOG',
} as const
export type WeatherCondition = typeof WEATHER_CONDITIONS[keyof typeof WEATHER_CONDITIONS]

export const WEATHER_RISK = {
  LOW:      'LOW',
  MODERATE: 'MODERATE',
  HIGH:     'HIGH',
  EXTREME:  'EXTREME',
} as const
export type WeatherRisk = typeof WEATHER_RISK[keyof typeof WEATHER_RISK]

export const TEAM_TYPES = {
  MOUNTAIN:    'MOUNTAIN',
  MEDICAL:     'MEDICAL',
  POLICE:      'POLICE',
  SDRF:        'SDRF',
  COAST_GUARD: 'COAST_GUARD',
} as const
export type TeamType = typeof TEAM_TYPES[keyof typeof TEAM_TYPES]

export const TEAM_STATUSES = {
  AVAILABLE: 'AVAILABLE',
  DEPLOYED:  'DEPLOYED',
  OFF_DUTY:  'OFF_DUTY',
} as const
export type TeamStatus = typeof TEAM_STATUSES[keyof typeof TEAM_STATUSES]

export const ASSIGNMENT_STATUSES = {
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED:  'ARRIVED',
  RESOLVED: 'RESOLVED',
} as const
export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[keyof typeof ASSIGNMENT_STATUSES]

export const SCAM_CATEGORIES = {
  FAKE_GUIDE:   'FAKE_GUIDE',
  OVERCHARGING: 'OVERCHARGING',
  THEFT:        'THEFT',
  HARASSMENT:   'HARASSMENT',
  UNSAFE_AREA:  'UNSAFE_AREA',
  OTHER:        'OTHER',
} as const
export type ScamCategory = typeof SCAM_CATEGORIES[keyof typeof SCAM_CATEGORIES]

export const ACTIVITY_TYPES = {
  TRANSPORT: 'TRANSPORT',
  STAY:      'STAY',
  ACTIVITY:  'ACTIVITY',
  MEAL:      'MEAL',
  OTHER:     'OTHER',
} as const
export type ActivityType = typeof ACTIVITY_TYPES[keyof typeof ACTIVITY_TYPES]

export const PACKING_CATEGORIES = {
  CLOTHING:    'CLOTHING',
  DOCUMENTS:   'DOCUMENTS',
  MEDICINE:    'MEDICINE',
  ELECTRONICS: 'ELECTRONICS',
  SAFETY:      'SAFETY',
  FOOD:        'FOOD',
  OTHER:       'OTHER',
} as const
export type PackingCategory = typeof PACKING_CATEGORIES[keyof typeof PACKING_CATEGORIES]

export const NOTIFICATION_TIERS = {
  TIER_1: 1, // Notify immediately
  TIER_2: 2, // Notify after 60 seconds
} as const
export type NotificationTier = typeof NOTIFICATION_TIERS[keyof typeof NOTIFICATION_TIERS]

// Frontend-only display labels — mirrors the label strings tsi.service.js
// generates (calculateTSI()'s score-band labels), not a raw backend enum.
export const TSI_LABELS = {
  LOW:      'Low Risk',
  MODERATE: 'Moderate Risk',
  HIGH:     'High Risk',
  EXTREME:  'Extreme Risk',
} as const

// Socket.IO event names — verified against backend src/constants/events.js.
// Includes the full set (the original spec omitted SOS_STATUS_UPDATED,
// GUARDIAN_ETA_UPDATE, and the client->server GOVT_JOIN_DISTRICT event).
export const SOCKET_EVENTS = {
  // Server -> Govt Dashboard room
  SOS_RECEIVED:       'SOS_RECEIVED',
  SOS_STATUS_UPDATED: 'SOS_STATUS_UPDATED',
  SOS_RESOLVED:       'SOS_RESOLVED',
  RESCUE_ASSIGNED:    'RESCUE_ASSIGNED',
  DMS_TRIGGERED:      'DMS_TRIGGERED',
  TSI_BULK_UPDATE:    'TSI_BULK_UPDATE',
  LIVE_MAP_UPDATE:    'LIVE_MAP_UPDATE',
  // Also fans out to the tourist + guardian rooms — same event name, three
  // rooms (see backend/src/socket/emitters.js#emitRescuerLocationUpdate).
  RESCUER_LOCATION_UPDATE: 'RESCUER_LOCATION_UPDATE',
  RESCUER_STATUS_UPDATE:   'RESCUER_STATUS_UPDATE',
  RESCUER_ASSIGNMENT_CANCELLED: 'RESCUER_ASSIGNMENT_CANCELLED',
  TOURIST_ANOMALY_DETECTED: 'TOURIST_ANOMALY_DETECTED',
  TOURIST_ANOMALY_RESOLVED: 'TOURIST_ANOMALY_RESOLVED',
  INCIDENT_FILED:           'INCIDENT_FILED',
  INCIDENT_STATUS_UPDATED:  'INCIDENT_STATUS_UPDATED',

  // Server -> Tourist room (tourist:{touristId})
  TSI_UPDATED:        'TSI_UPDATED',
  DMS_WARNING:        'DMS_WARNING',
  DMS_TRIGGERED_OWN:  'DMS_TRIGGERED_OWN',
  CHECKIN_CONFIRMED:  'CHECKIN_CONFIRMED',

  // Server -> Guardian room (guardian:{guardianToken})
  GUARDIAN_STATUS_CHANGE:   'GUARDIAN_STATUS_CHANGE',
  GUARDIAN_LOCATION_UPDATE: 'GUARDIAN_LOCATION_UPDATE',
  GUARDIAN_SOS_ALERT:       'GUARDIAN_SOS_ALERT',
  GUARDIAN_ETA_UPDATE:      'GUARDIAN_ETA_UPDATE',

  // Client -> Server (govt dashboard joining a district-scoped room)
  GOVT_JOIN_DISTRICT: 'GOVT_JOIN_DISTRICT',
} as const
export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS]

export const SOCKET_ROOMS = {
  GOVT_DASHBOARD: 'govt:dashboard',
  govtDistrict: (district: string) => `govt:district:${district}`,
  tourist:      (touristId: string) => `tourist:${touristId}`,
  guardian:     (guardianToken: string) => `guardian:${guardianToken}`,
} as const
