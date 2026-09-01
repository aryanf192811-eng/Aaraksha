// src/simulators/ntnChannel.js
// A deterministic, dependency-free software model of an NTN (Non-Terrestrial
// Network / 3GPP Release-17 direct-to-device satellite) channel. No real
// satellite, modem, or RF stack is involved -- this exists so Aaraksha's SOS
// pipeline can be demonstrated end-to-end over a satellite-shaped fallback
// path today, without gambling a live demo on OpenAirInterface/Open5GS/RF
// simulators, none of which a browser PWA could reach anyway.
//
// Ranges below are illustrative simulation values, informed by documented
// 3GPP Release-17 NTN system characteristics and propagation assumptions
// (LEO round-trip signalling delay commonly discussed in the ~500-700ms
// range; degraded terrain/elevation-angle scenarios plausibly push latency
// and loss higher) -- these are NOT measured satellite-link telemetry, and
// 3GPP does not publish one universal real-world number per terrain type.
// Treat every figure here as "informed by," never "equal to," a real link.
'use strict'

const { NTN_SCENARIOS } = require('../constants/enums')

const SCENARIO_PROFILES = Object.freeze({
  [NTN_SCENARIOS.CLEAR_SKY]: {
    satelliteVisible: true,
    signalPct:      [78, 92],
    latencyMs:      [520, 650],
    packetLossPct:  [0, 2],
  },
  [NTN_SCENARIOS.MOUNTAIN_VALLEY]: {
    satelliteVisible: true,
    signalPct:      [35, 50],
    latencyMs:      [650, 820],
    packetLossPct:  [5, 12],
  },
  [NTN_SCENARIOS.NO_VISIBILITY]: {
    satelliteVisible: false,
    signalPct:      [0, 0],
    latencyMs:      [0, 0],
    packetLossPct:  [100, 100],
  },
})

const DEFAULT_SCENARIO = NTN_SCENARIOS.CLEAR_SKY
const SATELLITE_ID = 'ARAK-LEO-1'

function randomInRange([min, max]) {
  return Math.round(min + Math.random() * (max - min))
}

// One randomized telemetry snapshot for the given scenario. Falls back to
// CLEAR_SKY for an unrecognized/omitted scenario rather than throwing --
// this backs a status-display endpoint, not a validated write path.
function sampleChannel(scenario) {
  const profile = SCENARIO_PROFILES[scenario] || SCENARIO_PROFILES[DEFAULT_SCENARIO]
  return {
    satelliteId:      SATELLITE_ID,
    scenario:         SCENARIO_PROFILES[scenario] ? scenario : DEFAULT_SCENARIO,
    satelliteVisible: profile.satelliteVisible,
    signalPct:        randomInRange(profile.signalPct),
    latencyMs:         randomInRange(profile.latencyMs),
    packetLossPct:     randomInRange(profile.packetLossPct),
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Simulates actually sending one packet over the sampled channel state.
// No visibility -> immediate failure, no delay. Otherwise waits out the
// simulated latency (capped so a demo never feels stuck) then rolls the
// simulated packet-loss odds.
const MAX_SIMULATED_DELAY_MS = 1200

async function attemptUplink(channelState) {
  if (!channelState.satelliteVisible) {
    return { delivered: false, delayMs: 0 }
  }
  const delayMs = Math.min(channelState.latencyMs, MAX_SIMULATED_DELAY_MS)
  await sleep(delayMs)
  const lost = Math.random() * 100 < channelState.packetLossPct
  return { delivered: !lost, delayMs }
}

module.exports = { sampleChannel, attemptUplink, SCENARIO_PROFILES, SATELLITE_ID }
