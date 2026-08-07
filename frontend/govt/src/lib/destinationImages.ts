// src/lib/destinationImages.ts
// Curated HD photography per seeded NE India destination (backend/scripts/seed.js).
// Unsplash CDN — verified reachable; each photo matches the destination's real
// character (Kaziranga -> rhino, Cherrapunji -> waterfalls, Tawang -> monastery).
// Mirrors frontend/tourist/src/lib/destinationImages.ts — kept in sync manually
// since each portal is an independent Vite app.
const DESTINATION_PHOTOS: Record<string, string> = {
  TAWANG:      '1691723815489-9d4cda571baf',
  SHILLONG:    '1629465659213-d28388bc05ff',
  CHERRAPUNJI: '1620358594775-050d831306a3',
  SOHRA:       '1620358594775-050d831306a3',
  KAZIRANGA:   '1541414779316-956a5084c0d4',
  DZUKOU:      '1659809665546-f8b909e4d51f',
  ZIRO:        '1551651437-f293403584ec',
  LOKTAK:      '1784715595775-09dc6de0678c',
  PELLING:     '1616942986550-ea6469c08530',
  MAJULI:      '1758622354183-829e31592235',
  LONGWA:      '1665043413574-422332646cce',
}

const FALLBACK_PHOTO = '1671404478922-a50366b728d0'

export function getDestinationImage(cityName: string | undefined | null, opts?: { w?: number; q?: number }): string {
  const w = opts?.w ?? 800
  const q = opts?.q ?? 80
  const key = Object.keys(DESTINATION_PHOTOS).find(k =>
    (cityName || '').toUpperCase().includes(k)
  )
  const photoId = key ? DESTINATION_PHOTOS[key] : FALLBACK_PHOTO
  return `https://images.unsplash.com/photo-${photoId}?w=${w}&q=${q}&auto=format&fit=crop`
}
