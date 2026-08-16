// src/services/notification/notification.service.js
// Orchestrates who to notify, when, and with what message.
'use strict'

const { sendSMS } = require('./sms.service')
const config = require('../../config/env')
const logger = require('../../utils/logger')

function buildSOSMessage(tourist, sos) {
  const time = new Date(sos.created_at || Date.now()).toLocaleTimeString('en-IN')
  const trackUrl = `${config.cors.guardianUrl}/track/${tourist.guardian_token}`
  const category = sos.category || 'EMERGENCY'
  const stale = sos.is_stale_location ? ' (last known location — may be old)' : ''
  return [
    `🆘 AARAKSHA ALERT`,
    `${tourist.full_name} triggered an SOS at ${time}`,
    `Type: ${category}${sos.message ? ' — ' + sos.message : ''}`,
    `Location: https://maps.google.com/?q=${sos.latitude},${sos.longitude}${stale}`,
    `Track live: ${trackUrl}`,
    `Blood group: ${tourist.blood_group || 'Unknown'}`,
    `ID suffix: ...${tourist.govt_id_suffix}`,
  ].join('\n')
}

// Notifies all emergency contacts after an SOS.
// Tier 1: immediate. Tier 2: after 60 seconds.
async function notifyOnSOS(tourist, sos) {
  const contacts = Array.isArray(tourist.emergency_contacts) ? tourist.emergency_contacts : []
  if (contacts.length === 0) {
    logger.warn({ touristId: tourist.id, sosId: sos.id }, 'SOS fired but no emergency contacts configured')
    return []
  }

  const message = buildSOSMessage(tourist, sos)
  const notified = []

  const tier1 = contacts.filter(c => c.tier === 1 || !c.tier)
  const tier2 = contacts.filter(c => c.tier === 2)

  // Tier 1: send now
  for (const contact of tier1) {
    const result = await sendSMS(contact.phone, message)
    notified.push({ phone: contact.phone, tier: 1, method: result.sent ? 'SMS' : 'FAILED', notifiedAt: new Date().toISOString() })
  }

  // Tier 2: send after 60 seconds (fire and forget)
  if (tier2.length > 0) {
    setTimeout(() => {
      Promise.all(tier2.map(async (contact) => {
        const result = await sendSMS(contact.phone, message)
        logger.info({ phone: contact.phone, sent: result.sent }, 'Tier-2 SOS notification sent')
      })).catch(err => logger.error({ err }, 'Tier-2 notification batch failed'))
    }, 60_000)
  }

  return notified
}

// DMS warning: notify tourist directly that their DMS is about to trigger
async function notifyDMSWarning(tourist, dms) {
  const minutesLeft = Math.ceil((new Date(dms.next_trigger_at) - Date.now()) / 60_000)
  const checkInUrl = `${config.cors.touristUrl}/checkin`
  const message = [
    `⏰ AARAKSHA: Check-in required`,
    `Your Dead Man's Switch triggers in ${minutesLeft} minutes.`,
    `If you don't check in, an SOS will be sent to your emergency contacts and authorities.`,
    `Check in now: ${checkInUrl}`,
  ].join('\n')

  await sendSMS(tourist.phone, message)
  logger.info({ touristId: tourist.id, dmsId: dms.id, minutesLeft }, 'DMS warning SMS sent')
}

// Volunteer SOS broadcast — no tiering (unlike emergency contacts, every
// volunteer alerted gets the same message at the same time; the "who
// responds" part is left to them, not a tier order).
function buildVolunteerAlertMessage(tourist, sos, distanceKm) {
  const category = sos.category || 'EMERGENCY'
  return [
    `🆘 AARAKSHA — Nearby SOS (${distanceKm.toFixed(1)} km away)`,
    `${tourist.full_name?.split(' ')[0] || 'A tourist'} needs help — ${category}`,
    `Location: https://maps.google.com/?q=${sos.latitude},${sos.longitude}`,
    `Open the Volunteer app to respond.`,
  ].join('\n')
}

async function notifyVolunteersOnSOS(volunteers, tourist, sos) {
  const notified = []
  for (const volunteer of volunteers) {
    const message = buildVolunteerAlertMessage(tourist, sos, volunteer.distanceKm)
    const result = await sendSMS(volunteer.phone, message)
    notified.push({ volunteerId: volunteer.id, method: result.sent ? 'SMS' : 'FAILED' })
  }
  return notified
}

async function notifyETAExceeded(contact, tourist, stop) {
  const message = [
    `⚠️ AARAKSHA: Late arrival alert`,
    `${tourist.full_name} was expected at ${stop.city} by now but hasn't checked in.`,
    `Last known location: https://maps.google.com/?q=${stop.lat},${stop.lng}`,
    `This is an automated alert — they may simply have bad connectivity.`,
    `Track them: ${config.cors.guardianUrl}/track/${tourist.guardian_token}`,
  ].join('\n')

  await sendSMS(contact.phone, message)
}

module.exports = { notifyOnSOS, notifyDMSWarning, notifyETAExceeded, notifyVolunteersOnSOS }
