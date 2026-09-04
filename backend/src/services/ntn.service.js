// src/services/ntn.service.js
// Orchestrates the simulated NTN (satellite) SOS path: sample the channel,
// attempt an uplink, always record the attempt, and on delivery hand off to
// the same canonical SOS pipeline the tourist's own manual trigger uses
// (sos.service.js#createSOS) rather than re-implementing notification/
// cluster/fan-out logic a third time. See AGENTS.md / the NTN plan for why
// this stays a software simulator, never a real satellite/RF integration.
'use strict'

const { NTNRepository } = require('../repositories/ntn.repository')
const { sampleChannel, attemptUplink } = require('../simulators/ntnChannel')
const { createSOS } = require('./sos.service')
const { emitNTNChannelStatus } = require('../socket/emitters')
const { SOS_TRIGGER_TYPES } = require('../constants/enums')
const logger = require('../utils/logger')

function getChannelStatus(scenario) {
  return sampleChannel(scenario)
}

function getRecentMessages(limit, days) {
  return new NTNRepository().findRecent(limit, days)
}

async function sendViaNTN(touristId, sosData, scenario) {
  const channel = sampleChannel(scenario)
  const { delivered } = await attemptUplink(channel)

  const repo = new NTNRepository()
  let sosEvent = null

  if (delivered) {
    sosEvent = await createSOS(touristId, { ...sosData, triggerType: SOS_TRIGGER_TYPES.NTN_SATELLITE })
  }

  const message = await repo.create({
    touristId,
    sosEventId:    sosEvent?.id,
    satelliteId:   channel.satelliteId,
    scenario:      channel.scenario,
    signalPct:     channel.signalPct,
    latencyMs:     channel.latencyMs,
    packetLossPct: channel.packetLossPct,
    status:        delivered ? 'DELIVERED' : 'FAILED',
  })

  emitNTNChannelStatus(message)
  logger.info({ touristId, scenario: channel.scenario, delivered, sosId: sosEvent?.id }, 'NTN uplink attempt')

  return { delivered, sosEvent, channel }
}

module.exports = { getChannelStatus, sendViaNTN, getRecentMessages }
