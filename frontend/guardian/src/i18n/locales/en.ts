// src/i18n/locales/en.ts
// Source-of-truth key structure for Guardian Portal.
export default {
  brand: {
    title: 'Aaraksha',
    portal: 'Guardian Portal',
    tagline: 'Aaraksha · Smart Tourism · Safe Journey',
  },
  common: {
    language: 'Language',
    defaultTraveler: 'Traveler',
    loading: 'Loading tracking data...',
  },
  notFound: {
    title: 'Tracking link not found',
    desc: 'Ask the traveler to share a valid Guardian tracking link.',
  },
  pin: {
    title: 'Enter the tracking PIN',
    desc: 'The traveler shared a 4-digit PIN with you separately from this link — enter it to open live tracking.',
    unlock: 'Unlock tracking',
    unlocking: 'Unlocking...',
    placeholder: '••••',
  },
  error: {
    shareNewLink: 'Ask the traveler to share a new tracking link.',
  },
  status: {
    safe: {
      headline: '{{name}} is safe',
      sub: 'Last check-in received',
      badge: 'SAFE',
    },
    sos: {
      headline: '{{name}} needs help!',
      sub: 'Emergency services have been notified',
      badge: 'SOS',
    },
    assigned: {
      headline: 'Help is on the way to {{name}}',
      sub: 'A rescue team has been dispatched',
      badge: 'HELP DISPATCHED',
    },
    warning: {
      headline: "{{name}}'s check-in is due",
      sub: 'Waiting for next check-in',
      badge: 'CHECK-IN DUE',
    },
    noSignal: {
      headline: 'No signal from {{name}}',
      sub: 'Last location shown below',
      badge: 'NO SIGNAL',
    },
    confirmed: {
      headline: 'Help has reached {{name}}',
      sub: 'Confirmed in person — the case is being closed',
      badge: 'CONFIRMED',
    },
  },
  sos: {
    category: 'Category: {{category}}',
    triggeredAt: 'Triggered at {{time}}',
  },
  assigned: {
    verifiedBy: 'Verified by {{name}}',
    dispatched: '{{name}} dispatched',
    defaultTeam: 'Rescue team',
    volunteerPrefix: 'Local Volunteer · ',
    confirmedAt: 'Confirmed at {{time}}',
    confirmed: 'Confirmed',
    eta: 'ETA ~{{eta}}',
    onTheWay: 'On the way',
    navigating: ' · 🧭 Navigating to them',
    delayedTitle: 'Response times can vary in this terrain — help is still on the way.',
    delayedAction: 'Message them if you need an update.',
    rescuerCancelled: "The assigned rescuer couldn't continue — government is reassigning.",
  },
  map: {
    recenter: 'Recenter on traveler',
    openInMaps: 'Open in Maps',
    locationNotAvailable: 'Location not available',
    lastSeen: 'Last seen {{time}}',
    livePosition: 'Live position',
    dispatchBase: 'Dispatch base',
  },
  cards: {
    lastSeen: 'Last Seen',
    battery: 'Battery',
    destination: 'Destination',
    unknown: 'Unknown',
    tsi: 'Travel Safety Index',
    medicalInfo: 'Medical Info',
    bloodGroup: 'Blood Group:',
    messageTraveler: 'Message {{name}}',
    autoRefresh: 'Updated {{time}} · Auto-refreshes every 30s',
  },
  messages: {
    empty: "No messages yet — send a note and it'll reach their app right away.",
    placeholder: 'Type a message…',
    send: 'Send',
    sender: {
      TOURIST: 'Traveler',
      GUARDIAN: 'You',
      VOLUNTEER: 'Rescuer',
      TEAM: 'Rescue Team',
    },
  },
  enums: {
    sosCategory: {
      MEDICAL: 'Medical',
      LOST: 'Lost',
      TRAPPED: 'Trapped',
      DISASTER: 'Disaster',
      MISSING: 'Missing',
      CRIME: 'Crime',
      OTHER: 'Other',
    },
    tsiLabel: {
      LOW: 'Low Risk',
      MODERATE: 'Moderate Risk',
      HIGH: 'High Risk',
      EXTREME: 'Extreme Risk',
    },
  },
}
