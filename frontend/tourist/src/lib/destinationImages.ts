// src/lib/destinationImages.ts
// Curated HD photography per seeded NE India destination (backend/scripts/seed.js).
// Unsplash CDN — verified reachable; each photo matches the destination's real
// character (Kaziranga -> rhino, Cherrapunji -> waterfalls, Tawang -> monastery).
const DESTINATION_PHOTOS: Record<string, string> = {
  TAWANG:      '1691723815489-9d4cda571baf', // Buddhist monastery, snow peaks
  SHILLONG:    '1629465659213-d28388bc05ff', // misty green hills
  CHERRAPUNJI: '1620358594775-050d831306a3', // waterfalls between rocky cliffs
  SOHRA:       '1620358594775-050d831306a3',
  KAZIRANGA:   '1541414779316-956a5084c0d4', // one-horned rhino, grassland
  DZUKOU:      '1659809665546-f8b909e4d51f', // green valley meadow, clouds
  ZIRO:        '1551651437-f293403584ec',    // rice terraces
  LOKTAK:      '1784715595775-09dc6de0678c', // floating huts on lake
  PELLING:     '1616942986550-ea6469c08530', // snowy Himalayan village
  MAJULI:      '1758622354183-829e31592235', // river island at sunset
  LONGWA:      '1665043413574-422332646cce', // misty Nagaland hills
}

const FALLBACK_PHOTO = '1671404478922-a50366b728d0' // dramatic cloud-covered peaks

export function getDestinationImage(cityName: string | undefined | null, opts?: { w?: number; q?: number }): string {
  const w = opts?.w ?? 1200
  const q = opts?.q ?? 80
  const key = Object.keys(DESTINATION_PHOTOS).find(k =>
    (cityName || '').toUpperCase().includes(k)
  )
  const photoId = key ? DESTINATION_PHOTOS[key] : FALLBACK_PHOTO
  return `https://images.unsplash.com/photo-${photoId}?w=${w}&q=${q}&auto=format&fit=crop`
}

// Hero-grade banner photo — sharp snow-capped Himalayan range, used for the
// landing page hero and any full-bleed section not tied to one city.
// Verified reachable directly (not routed through getDestinationImage's
// fuzzy name match) since it's not standing in for any one destination.
export const HERO_PHOTO = 'https://images.unsplash.com/photo-1616942986550-ea6469c08530?w=1920&q=85&auto=format&fit=crop'
