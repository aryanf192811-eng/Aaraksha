// src/lib/localPoints.ts
// "Vocal for Local" badge tiers — a single source of truth computed
// client-side from tourist.local_points (see migration 030), since no
// other portal needs this and a raw point count is all the backend
// exposes. 10 points per review (localOperatorReview.service.js), so the
// thresholds below land at 2 / 5 / 10 real reviews — reachable live in a
// demo, not a months-long grind.
export interface LocalPointsTier {
  key: 'NONE' | 'EXPLORER' | 'CHAMPION' | 'LEGEND'
  emoji: string
  labelKey: string
  minPoints: number
}

export const LOCAL_POINTS_TIERS: LocalPointsTier[] = [
  { key: 'LEGEND',   emoji: '🏆', labelKey: 'profile.localTierLegend',  minPoints: 100 },
  { key: 'CHAMPION', emoji: '🌟', labelKey: 'profile.localTierChampion', minPoints: 50 },
  { key: 'EXPLORER', emoji: '🌱', labelKey: 'profile.localTierExplorer', minPoints: 20 },
  { key: 'NONE',     emoji: '',   labelKey: 'profile.localTierNone',    minPoints: 0 },
]

export function getLocalPointsTier(points: number): LocalPointsTier {
  return LOCAL_POINTS_TIERS.find((t) => points >= t.minPoints) ?? LOCAL_POINTS_TIERS[LOCAL_POINTS_TIERS.length - 1]
}

export function getNextLocalPointsTier(points: number): LocalPointsTier | null {
  const higher = [...LOCAL_POINTS_TIERS].reverse().find((t) => t.minPoints > points)
  return higher ?? null
}
