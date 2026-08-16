// src/lib/osrm.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getRoute } from './osrm'

const mockOsrmResponse = {
  code: 'Ok',
  routes: [{
    distance: 1226.9,
    duration: 186.2,
    geometry: {
      type: 'LineString',
      coordinates: [[91.736153, 26.144276], [91.7375, 26.1452], [91.740048, 26.149991]],
    },
  }],
}

describe('getRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('flips OSRM [lng,lat] geometry to [lat,lng] for Leaflet, and converts m/s to km/min', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockOsrmResponse) }))

    const route = await getRoute(26.1445, 91.7362, 26.15, 91.74)

    expect(route).not.toBeNull()
    expect(route!.coordinates[0]).toEqual([26.144276, 91.736153])
    expect(route!.coordinates).toHaveLength(3)
    expect(route!.distanceKm).toBeCloseTo(1.2269, 4)
    expect(route!.durationMin).toBeCloseTo(3.1033, 3)
  })

  it('returns null on a network failure rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const route = await getRoute(26.1445, 91.7362, 26.15, 91.74)
    expect(route).toBeNull()
  })

  it('returns null on a non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))
    const route = await getRoute(26.1445, 91.7362, 26.15, 91.74)
    expect(route).toBeNull()
  })

  it('returns null when the response has no route (e.g. no road connection found)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ code: 'NoRoute', routes: [] }) }))
    const route = await getRoute(26.1445, 91.7362, 26.15, 91.74)
    expect(route).toBeNull()
  })
})
